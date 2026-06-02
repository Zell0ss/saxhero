// music.js — SaxHero note model (ES module port from design bundle)

const LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
export const LETTER_BY_IDX = ["C", "D", "E", "F", "G", "A", "B"];
const E4_ABS = 4 * 7 + LETTERS.E;

export function stepOf(letter, octave) {
  return octave * 7 + LETTERS[letter] - E4_ABS;
}

export const BASE_OCT_UPPER = 4;
export const BASE_OCT_LOWER = 5;

export function parseToken(tok) {
  if (tok === "-") return { type: "rest" };
  if (tok === "|") return { type: "bar" };
  const m = /^([A-Ga-g])([#b]?)([,']*)$/.exec(tok);
  if (!m) return null;
  const rawLetter = m[1];
  const letter = rawLetter.toUpperCase();
  const acc = m[2];
  let octave = rawLetter === letter ? BASE_OCT_UPPER : BASE_OCT_LOWER;
  for (const ch of m[3]) octave += ch === "," ? -1 : 1;
  return { type: "note", letter, acc, octave, pitch: letter + acc + octave, step: stepOf(letter, octave) };
}

export function parseStrip(text) {
  const out = [];
  (text || "").trim().split(/\s+/).filter(Boolean).forEach((tok) => {
    const p = parseToken(tok);
    if (p && p.type !== "bar") out.push(p);
  });
  return out;
}

export function tokenForEvent(ev) {
  if (ev.type === "rest" || ev.isRest) return "-";
  let letter = ev.octave >= BASE_OCT_LOWER ? ev.letter.toLowerCase() : ev.letter;
  let marks = "";
  if (ev.octave > BASE_OCT_LOWER) marks = "'".repeat(ev.octave - BASE_OCT_LOWER);
  else if (ev.octave < BASE_OCT_UPPER) marks = ",".repeat(BASE_OCT_UPPER - ev.octave);
  return letter + (ev.acc || "") + marks;
}

export function serialize(events, beatsPerBar) {
  const parts = [];
  let acc = 0;
  events.forEach((ev) => {
    parts.push(tokenForEvent(ev));
    acc += durBeats(ev);
    if (beatsPerBar && acc >= beatsPerBar - 1e-6) { acc = 0; parts.push("|"); }
  });
  if (parts[parts.length - 1] === "|") parts.pop();
  return parts.join(" ");
}

export const LADDER = [
  { key: "16", beats: 0.25, glyph: "𝅘𝅥𝅯", name: "semicorchea" },
  { key: "8",  beats: 0.5,  glyph: "♪",        name: "corchea" },
  { key: "4",  beats: 1,    glyph: "♩",         name: "negra" },
  { key: "2",  beats: 2,    glyph: "𝅗𝅥",   name: "blanca" },
  { key: "1",  beats: 4,    glyph: "𝅝",   name: "redonda" },
];
export const LADDER_INDEX = Object.fromEntries(LADDER.map((d, i) => [d.key, i]));

export function durBeats(ev) {
  const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
  let b = base.beats;
  if (ev.dotted) b *= 1.5;
  if (ev.triplet) b *= 2 / 3;
  return b;
}

export function durLabel(ev) {
  const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
  let n = base.name;
  if (ev.dotted) n += " con puntillo";
  if (ev.triplet) n += " (tresillo)";
  return n;
}

export function durGlyph(ev) {
  const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
  return base.glyph + (ev.dotted ? "·" : "");
}

const REST_GLYPHS = { "16": "𝄽", "8": "𝄼", "4": "𝄻", "2": "𝄺", "1": "𝄹" };
export function restGlyph(ev) { return REST_GLYPHS[ev.base ?? "4"] || REST_GLYPHS["4"]; }

export function makeEvent(parsed, prev) {
  if (!parsed) return null;
  const base = { base: prev?.base ?? "4", dotted: prev?.dotted ?? false, triplet: prev?.triplet ?? false };
  if (parsed.type === "rest") return { isRest: true, ...base };
  return { isRest: false, letter: parsed.letter, acc: parsed.acc, octave: parsed.octave, pitch: parsed.pitch, step: parsed.step, ...base };
}

export function reconcile(text, oldEvents) {
  const parsed = parseStrip(text);
  return parsed.map((p, i) => {
    const old = oldEvents && oldEvents[i];
    const carry = old ? { base: old.base, dotted: old.dotted, triplet: old.triplet } : undefined;
    return makeEvent(p, carry);
  });
}

export const ROWS = [
  { id: "O",  group: "octave", label: "Octava" },
  { id: "L1", group: "left",   label: "Izq. índice" },
  { id: "L2", group: "left",   label: "Izq. medio" },
  { id: "L3", group: "left",   label: "Izq. anular" },
  { id: "L4", group: "left",   pinky: true, label: "Izq. meñique" },
  { id: "R1", group: "right",  label: "Der. índice" },
  { id: "R2", group: "right",  label: "Der. medio" },
  { id: "R3", group: "right",  label: "Der. anular" },
  { id: "R4", group: "right",  pinky: true, label: "Der. meñique" },
];

export const SHAPE = {
  C: ["L2"], "C#": [], Db: [], D: ["L1","L2","L3","R1","R2","R3"],
  "D#": ["L1","L2","L3","R1","R2","R3"], Eb: ["L1","L2","L3","R1","R2","R3"],
  E: ["L1","L2","L3","R1","R2"], F: ["L1","L2","L3","R1"],
  "F#": ["L1","L2","L3","R2"], Gb: ["L1","L2","L3","R2"],
  G: ["L1","L2","L3"], "G#": ["L1","L2","L3"], Ab: ["L1","L2","L3"],
  A: ["L1","L2"], "A#": ["L1","R1"], Bb: ["L1","R1"], B: ["L1"],
};

export function fingering(ev) {
  if (!ev || ev.isRest) return [];
  const pc = ev.letter + (ev.acc || "");
  const step = ev.step;
  if (step <= -2) {
    const stack = ["L1","L2","L3","R1","R2","R3"];
    if (ev.letter === "C") return [...stack, "R4"];
    return [...stack, "L4"];
  }
  let keys = (SHAPE[pc] || SHAPE[ev.letter] || []).slice();
  if (step >= 6) keys = ["O", ...keys];
  return keys;
}

export function registerName(ev) {
  if (!ev || ev.isRest) return "";
  if (ev.step <= -2) return "Registro grave";
  if (ev.step >= 6) return "Registro agudo · octava";
  return "Registro medio";
}

export function blankSong() {
  return { title: "", bpm: 90, beats_per_bar: 4, stars: 1, cover_image: null, key_name: "" };
}

export function totalBeats(events) {
  return events.reduce((s, e) => s + durBeats(e), 0);
}
