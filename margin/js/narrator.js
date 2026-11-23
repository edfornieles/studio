// Two narration engines with the same interface:
//   speak(text, opts) -> Promise that resolves when the chunk finishes
//                        ('cancelled' if stopped), rejects on failure
//   stop(), prepare(text), unlock() [call inside the tap handler]
//   supportsPause: if true, pause()/resume() keep the position mid-chunk.
//
// DeviceVoice uses the browser's speechSynthesis. RemoteVoice plays audio
// files from a TTS server (see docs/tts-backend.md) through one persistent
// <audio> element, which is what iOS needs for lock-screen controls and
// background playback.

import { silentWavUrl } from './audio-util.js';

// iOS: put the page's audio session in "playback" mode so it isn't muted by
// the ring/silent switch, and route audio as media. Must run in a tap handler.
let sessionAudio = null;
export function unlockAudioSession(log) {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
      navigator.audioSession.type = 'playback';
      log('audio', 'audioSession.type = playback');
    }
  } catch (e) { log('audio', 'audioSession failed: ' + e.message); }
  if (!sessionAudio) {
    sessionAudio = new Audio();
    sessionAudio.setAttribute('playsinline', '');
    sessionAudio.src = silentWavUrl();
  }
  sessionAudio.play().then(() => log('audio', 'silent unlock played')).catch(e => log('audio', 'silent unlock blocked: ' + e.message));
}

export class DeviceVoice {
  constructor(log) {
    this.log = log;
    this.synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.current = null; // keep a reference: Safari can garbage-collect utterances mid-speech
    this.supportsPause = false;
    this.kind = 'device';
  }
  get available() { return !!this.synth; }
  voices() { return this.synth ? this.synth.getVoices() : []; }
  unlock() {}
  prepare() {}

  speak(text, { voice, rate = 1, pitch = 1 } = {}) {
    if (!this.synth) return Promise.reject(new Error('This browser has no built-in speech. Use Safari or Chrome, or a narrator server.'));
    return new Promise((resolve, reject) => {
      const s = this.synth;
      const u = new SpeechSynthesisUtterance(text);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
      u.rate = rate; u.pitch = pitch; u.volume = 1;
      let started = false, finished = false, idle = 0;
      const done = (fn, arg) => {
        if (finished) return;
        finished = true;
        clearTimeout(startDog); clearInterval(endDog);
        if (this.current?.u === u) this.current = null;
        fn(arg);
      };
      u.onstart = () => { started = true; };
      u.onend = () => done(resolve, 'ended');
      u.onerror = e => {
        if (e.error === 'interrupted' || e.error === 'canceled') done(resolve, 'cancelled');
        else { this.log('speech', 'error: ' + e.error); done(reject, new Error('device-voice:' + e.error)); }
      };
      // Watchdog 1: queued but never started (a common silent iOS failure).
      const startDog = setTimeout(() => {
        if (started || finished) return;
        if (s.speaking) { started = true; return; }
        this.log('speech', 'no onstart after 6s; speaking=' + s.speaking + ' pending=' + s.pending);
        try { s.cancel(); } catch { /* ignore */ }
        done(reject, new Error('silent'));
      }, 6000);
      // Watchdog 2: finished speaking but onend never fired (Safari quirk).
      const endDog = setInterval(() => {
        if (!started || finished) return;
        idle = !s.speaking && !s.pending ? idle + 1 : 0;
        if (idle >= 2) { this.log('speech', 'missed onend; continuing'); done(resolve, 'ended'); }
      }, 700);
      this.current = { u, cancel: () => done(resolve, 'cancelled') };
      // Only cancel when something is queued: cancel() immediately followed by
      // speak() can swallow the new utterance on iOS.
      if (s.speaking || s.pending) s.cancel();
      s.speak(u);
    });
  }

  stop() {
    const c = this.current;
    this.current = null;
    if (this.synth && (this.synth.speaking || this.synth.pending)) this.synth.cancel();
    c?.cancel();
  }
}

export class RemoteVoice {
  constructor(log, getStore) {
    this.log = log;
    this.getStore = getStore;
    this.el = new Audio();
    this.el.setAttribute('playsinline', '');
    this.el.preload = 'auto';
    this.cache = new Map(); // key -> Promise<objectURL>
    this.supportsPause = true;
    this.kind = 'remote';
    this.endpoint = '';
    this.voice = '';
    this.current = null;
  }
  configure({ endpoint, voice }) {
    if (endpoint !== this.endpoint || voice !== this.voice) this.clearCache();
    this.endpoint = endpoint || '';
    this.voice = voice || '';
  }
  get available() { return !!this.endpoint; }

  unlock() {
    // Playing anything on this element inside a tap lets later chunks start
    // programmatically (including from the lock screen) on iOS.
    if (this.unlocked || this.current) return;
    this.el.src = silentWavUrl();
    this.el.play().then(() => { this.unlocked = true; this.log('remote', 'audio element unlocked'); })
      .catch(e => this.log('remote', 'unlock blocked: ' + e.message));
  }

  clearCache() {
    for (const p of this.cache.values()) p.then(u => URL.revokeObjectURL(u)).catch(() => {});
    this.cache.clear();
  }

  fetchAudio(text) {
    const key = (this.voice || 'default') + '|' + text;
    let p = this.cache.get(key);
    if (p) return p;
    p = (async () => {
      const store = this.getStore();
      let blob = await store?.audioGet('tts|' + key);
      if (!blob) {
        const t0 = performance.now();
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg, audio/*' },
          body: JSON.stringify({ text, voice: this.voice || undefined, format: 'mp3' }),
        });
        if (!res.ok) throw new Error('narrator server ' + res.status + ' ' + (await res.text().catch(() => '')).slice(0, 120));
        blob = await res.blob();
        if (!/^audio\//.test(blob.type)) throw new Error('narrator server returned ' + (blob.type || 'unknown type') + ', not audio');
        this.log('remote', `fetched ${blob.size}B in ${Math.round(performance.now() - t0)}ms`);
        store?.audioPut('tts|' + key, blob);
      }
      return URL.createObjectURL(blob);
    })();
    p.catch(() => this.cache.delete(key));
    this.cache.set(key, p);
    // Keep memory bounded: drop the oldest object URLs.
    while (this.cache.size > 40) {
      const [k, old] = this.cache.entries().next().value;
      this.cache.delete(k);
      old.then(u => URL.revokeObjectURL(u)).catch(() => {});
    }
    return p;
  }

  prepare(text) { if (this.endpoint) this.fetchAudio(text).catch(() => {}); }

  speak(text, { rate = 1 } = {}) {
    if (!this.endpoint) return Promise.reject(new Error('No narrator server configured.'));
    return new Promise((resolve, reject) => {
      let finished = false;
      const el = this.el;
      const done = (fn, arg) => {
        if (finished) return;
        finished = true;
        el.onended = el.onerror = null;
        if (this.current?.token === token) this.current = null;
        fn(arg);
      };
      const token = {};
      this.current = { token, cancel: () => done(resolve, 'cancelled') };
      this.fetchAudio(text).then(url => {
        if (finished) return;
        el.onended = () => done(resolve, 'ended');
        el.onerror = () => done(reject, new Error('audio playback error ' + (el.error?.code || '')));
        el.src = url;
        el.playbackRate = rate;
        el.defaultPlaybackRate = rate;
        return el.play();
      }).catch(e => done(reject, e));
    });
  }

  pause() { this.el.pause(); }
  resume() { return this.el.play(); }
  get midChunk() { return !!this.current; }
  stop() {
    const c = this.current;
    this.current = null;
    this.el.pause();
    c?.cancel();
  }
}
