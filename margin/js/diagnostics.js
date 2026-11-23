// Event log + environment report, shown in the "Playback diagnostics" panel
// and copyable so an iPhone failure can be reported precisely.

const entries = [];
let sink = null;
const t0 = Date.now();

export function log(cat, msg) {
  const e = { t: ((Date.now() - t0) / 1000).toFixed(1), cat, msg: String(msg) };
  entries.push(e);
  if (entries.length > 300) entries.shift();
  if (sink) sink(entries);
}

export function onLog(fn) { sink = fn; fn(entries); }

export function environment(device) {
  const voices = device.voices();
  const en = voices.filter(v => /^en/i.test(v.lang));
  return {
    userAgent: navigator.userAgent,
    standalone: !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches),
    secureContext: window.isSecureContext,
    speechSynthesis: device.available,
    voices: voices.length,
    englishVoices: en.map(v => `${v.name} (${v.lang})${v.localService ? '' : ' [network]'}`),
    audioSessionApi: 'audioSession' in navigator ? navigator.audioSession.type : 'unsupported',
    mediaSession: 'mediaSession' in navigator,
    indexedDB: 'indexedDB' in window,
    visibility: document.visibilityState,
  };
}

export function report(device, extra = {}) {
  const env = environment(device);
  const lines = ['Margin diagnostics ' + new Date().toISOString()];
  for (const [k, v] of Object.entries({ ...env, ...extra })) lines.push(`${k}: ${Array.isArray(v) ? v.join('; ') || '(none)' : v}`);
  lines.push('', 'Log:');
  for (const e of entries) lines.push(`${e.t}s [${e.cat}] ${e.msg}`);
  return lines.join('\n');
}
