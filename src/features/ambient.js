/**
 * Ambient Hub: binaural beats (use headphones) and soft noise, generated
 * locally with WebAudio - nothing is downloaded or recorded.
 */
export const AMBIENT_PRESETS = [
  { id: 'focus', label: 'Focus', kind: 'binaural', carrier: 200, beat: 15, hint: 'Beta 15 Hz - headphones' },
  { id: 'calm', label: 'Calm', kind: 'binaural', carrier: 180, beat: 10, hint: 'Alpha 10 Hz - headphones' },
  { id: 'sleep', label: 'Sleep', kind: 'binaural', carrier: 150, beat: 3, hint: 'Delta 3 Hz - headphones' },
  { id: 'rain', label: 'Rain', kind: 'noise', color: 'white', cutoff: 2400, hint: 'Soft rain-like noise' },
  { id: 'brown', label: 'Deep hum', kind: 'noise', color: 'brown', cutoff: 600, hint: 'Brown noise' },
];

/** Left/right ear frequencies for a binaural preset. */
export function binauralFrequencies(preset) {
  return { left: preset.carrier, right: preset.carrier + preset.beat };
}

export function clampVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(1, Math.max(0, n));
}

function noiseBuffer(ctx, color) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (color === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white * 0.5;
    }
  }
  return buffer;
}

let current = null; // { ctx, master, nodes, presetId }
const listeners = new Set();
let volume = 0.3;

function emit() {
  listeners.forEach((fn) => fn(getAmbientState()));
}

export function getAmbientState() {
  return { playing: !!current, presetId: current?.presetId ?? null, volume };
}

export function subscribeAmbient(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function stopAmbient() {
  if (!current) return;
  const { ctx, nodes } = current;
  nodes.forEach((n) => {
    try {
      n.stop?.();
    } catch {
      /* already stopped */
    }
  });
  ctx.close?.().catch(() => {});
  current = null;
  emit();
}

export function setAmbientVolume(v) {
  volume = clampVolume(v);
  if (current) current.master.gain.value = volume;
  emit();
}

export function startAmbient(presetId) {
  const preset = AMBIENT_PRESETS.find((p) => p.id === presetId);
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!preset || !Ctx) return false;
  stopAmbient();
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  const nodes = [];
  if (preset.kind === 'binaural') {
    const { left, right } = binauralFrequencies(preset);
    [[left, -1], [right, 1]].forEach(([freq, pan]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (panner.pan) panner.pan.value = pan;
      osc.connect(panner).connect(master);
      osc.start();
      nodes.push(osc);
    });
  } else {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, preset.color);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset.cutoff;
    src.connect(filter).connect(master);
    src.start();
    nodes.push(src);
  }
  ctx.resume?.();
  current = { ctx, master, nodes, presetId: preset.id };
  emit();
  return true;
}
