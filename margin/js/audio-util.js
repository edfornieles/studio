// Small generated WAV files: silence (to unlock audio on iOS) and a test tone.

export function wavBlob(seconds = 0.5, freq = 0, sampleRate = 22050, volume = 0.3) {
  const n = Math.round(seconds * sampleRate);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 400, (n - i) / 400);
    const s = freq ? Math.sin((2 * Math.PI * freq * i) / sampleRate) * volume * fade : 0;
    v.setInt16(44 + i * 2, s * 32767, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

let silentUrl = null;
export const silentWavUrl = () => (silentUrl ||= URL.createObjectURL(wavBlob(0.25)));
