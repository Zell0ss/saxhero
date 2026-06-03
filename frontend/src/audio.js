import * as Tone from 'tone';

let synth = null;
let clickSynth = null;
let _started = false;

export async function start() {
  if (_started) return;
  await Tone.start();
  synth = new Tone.AMSynth({
    harmonicity: 2,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.08, sustain: 0.5, release: 0.3 },
    modulationEnvelope: { attack: 0.05, decay: 0.1, sustain: 1, release: 0.3 },
    volume: -6,
  }).toDestination();
  clickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
    volume: -8,
  }).toDestination();
  _started = true;
}

export function playNote(ev, durationSec) {
  if (!synth) return;
  const pitch = ev.letter + (ev.acc || '') + ev.octave;
  const durTone = Math.max(0.05, durationSec * 0.88);
  try {
    synth.triggerAttackRelease(pitch, durTone);
  } catch {
    // invalid pitch — ignore
  }
}

export function playClick() {
  if (!clickSynth) return;
  clickSynth.triggerAttackRelease('C2', '16n');
}

export function dispose() {
  synth?.dispose();
  clickSynth?.dispose();
  synth = null;
  clickSynth = null;
  _started = false;
}
