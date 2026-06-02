/* ============================================================
   music.js — SaxHero Compositor model layer
   - Note-strip parser  (e.g. "C E G c | A, F# -")
   - Pitch -> treble staff step
   - Alto-sax fingering (simplified standard chart, brand rows)
   - Duration ladder + glyphs
   - Demo songs
   No audio. Pure data so the editor can redraw live.
   ============================================================ */
(function () {
  "use strict";

  /* ---- pitch math -------------------------------------------------- */
  // Diatonic letter index, C-based.
  const LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const LETTER_BY_IDX = ["C", "D", "E", "F", "G", "A", "B"];
  // Treble clef: E4 = staff step 0, each diatonic step = +1 (line/space).
  // step = (octave*7 + letterIndex) - (4*7 + 2)
  const E4_ABS = 4 * 7 + LETTERS.E; // 30
  function stepOf(letter, octave) {
    return octave * 7 + LETTERS[letter] - E4_ABS;
  }

  /* ---- note-strip parser ------------------------------------------
     Token grammar (space-separated):
       note   = [A-Ga-g] [#b]? [,']*
                UPPER = base octave 4, lower = octave 5,
                ',' lowers an octave each, "'" raises an octave each.
       rest   = "-"
       barline= "|"  (accepted, used only as a visual hint; bars are
                      auto-drawn from the time signature)
  -------------------------------------------------------------------*/
  const BASE_OCT_UPPER = 4; // uppercase letters live here
  const BASE_OCT_LOWER = 5; // lowercase one octave up

  function parseToken(tok) {
    if (tok === "-") return { type: "rest" };
    if (tok === "|") return { type: "bar" };
    const m = /^([A-Ga-g])([#b]?)([,']*)$/.exec(tok);
    if (!m) return null;
    const rawLetter = m[1];
    const letter = rawLetter.toUpperCase();
    const acc = m[2]; // '', '#', 'b'
    let octave = rawLetter === letter ? BASE_OCT_UPPER : BASE_OCT_LOWER;
    for (const ch of m[3]) octave += ch === "," ? -1 : 1;
    return {
      type: "note",
      letter,
      acc,
      octave,
      pitch: letter + acc + octave, // e.g. "F#4"
      step: stepOf(letter, octave),
    };
  }

  // Parse a strip into a flat list of {type:'note'|'rest', ...}. Barlines dropped.
  function parseStrip(text) {
    const out = [];
    (text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((tok) => {
        const p = parseToken(tok);
        if (p && p.type !== "bar") out.push(p);
      });
    return out;
  }

  /* ---- serialize events back to a strip (no durations) ------------- */
  function tokenForEvent(ev) {
    if (ev.type === "rest" || ev.isRest) return "-";
    let letter = ev.octave >= BASE_OCT_LOWER ? ev.letter.toLowerCase() : ev.letter;
    let marks = "";
    if (ev.octave > BASE_OCT_LOWER) marks = "'".repeat(ev.octave - BASE_OCT_LOWER);
    else if (ev.octave < BASE_OCT_UPPER) marks = ",".repeat(BASE_OCT_UPPER - ev.octave);
    return letter + (ev.acc || "") + marks;
  }
  function serialize(events, beatsPerBar) {
    // re-insert a "|" every beatsPerBar of duration for readability
    const parts = [];
    let acc = 0;
    events.forEach((ev) => {
      parts.push(tokenForEvent(ev));
      acc += ev.dur || 1;
      if (beatsPerBar && acc >= beatsPerBar - 1e-6) {
        acc = 0;
        parts.push("|");
      }
    });
    if (parts[parts.length - 1] === "|") parts.pop();
    return parts.join(" ");
  }

  /* ---- duration model ---------------------------------------------
     Base ladder in beats (quarter = 1). Dot multiplies x1.5,
     triplet multiplies x2/3 (the displayed value of one note of an
     eighth-triplet etc.). We store {base, dotted, triplet} and derive dur.
  -------------------------------------------------------------------*/
  const LADDER = [
    { key: "16", beats: 0.25, glyph: "\uD834\uDD61", name: "semicorchea" }, // 𝅘𝅥𝅯
    { key: "8", beats: 0.5, glyph: "\u266A", name: "corchea" }, // ♪
    { key: "4", beats: 1, glyph: "\u2669", name: "negra" }, // ♩
    { key: "2", beats: 2, glyph: "\uD834\uDD5E", name: "blanca" }, // 𝅗𝅥
    { key: "1", beats: 4, glyph: "\uD834\uDD5D", name: "redonda" }, // 𝅝
  ];
  const LADDER_INDEX = Object.fromEntries(LADDER.map((d, i) => [d.key, i]));

  function durBeats(ev) {
    const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
    let b = base.beats;
    if (ev.dotted) b *= 1.5;
    if (ev.triplet) b *= 2 / 3;
    return b;
  }

  // Pretty label for a duration combo.
  function durLabel(ev) {
    const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
    let n = base.name;
    if (ev.dotted) n += " con puntillo";
    if (ev.triplet) n += " (tresillo)";
    return n;
  }
  function durGlyph(ev) {
    const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
    return base.glyph + (ev.dotted ? "\u00B7" : ""); // middle dot for puntillo
  }
  const REST_GLYPHS = {
    "16": "\uD834\uDD3D",
    "8": "\uD834\uDD3C",
    "4": "\uD834\uDD3B", // quarter rest
    "2": "\uD834\uDD3A",
    "1": "\uD834\uDD39",
  };
  function restGlyph(ev) {
    return REST_GLYPHS[ev.base ?? "4"] || REST_GLYPHS["4"];
  }

  /* ---- build a full event from a parsed note, w/ default duration --- */
  function makeEvent(parsed, prev) {
    if (!parsed) return null;
    const base = {
      base: prev?.base ?? "4",
      dotted: prev?.dotted ?? false,
      triplet: prev?.triplet ?? false,
    };
    if (parsed.type === "rest") {
      return { isRest: true, ...base };
    }
    return {
      isRest: false,
      letter: parsed.letter,
      acc: parsed.acc,
      octave: parsed.octave,
      pitch: parsed.pitch,
      step: parsed.step,
      ...base,
    };
  }

  /* ---- reconcile: parse text into events, preserving durations ----- */
  // Keeps dur/dotted/triplet for positions that still exist so typing
  // later notes does not wipe earlier rhythm edits.
  function reconcile(text, oldEvents) {
    const parsed = parseStrip(text);
    return parsed.map((p, i) => {
      const old = oldEvents && oldEvents[i];
      const carry = old ? { base: old.base, dotted: old.dotted, triplet: old.triplet } : undefined;
      return makeEvent(p, carry);
    });
  }

  /* ---- alto-sax fingering (simplified standard chart) --------------
     Rows mirror the player's diagram:
       O octave, L1/L2/L3 left main, L4 left pinky,
       R1/R2/R3 right main, R4 right pinky.
     baseShape = main keys by pitch-class (the shape repeats an octave
     up with the octave key engaged). Lowest bell notes add a pinky.
     Octave key engages from D5 (step >= 6) upward, like the player.
  -------------------------------------------------------------------*/
  const ROWS = [
    { id: "O", group: "octave", label: "Octava" },
    { id: "L1", group: "left", label: "Izq. \u00edndice" },
    { id: "L2", group: "left", label: "Izq. medio" },
    { id: "L3", group: "left", label: "Izq. anular" },
    { id: "L4", group: "left", pinky: true, label: "Izq. me\u00f1ique" },
    { id: "R1", group: "right", label: "Der. \u00edndice" },
    { id: "R2", group: "right", label: "Der. medio" },
    { id: "R3", group: "right", label: "Der. anular" },
    { id: "R4", group: "right", pinky: true, label: "Der. me\u00f1ique" },
  ];

  // Pitch-class -> main keys (middle register shape).
  const SHAPE = {
    C: ["L2"],
    "C#": [],
    Db: [],
    D: ["L1", "L2", "L3", "R1", "R2", "R3"],
    "D#": ["L1", "L2", "L3", "R1", "R2", "R3"],
    Eb: ["L1", "L2", "L3", "R1", "R2", "R3"],
    E: ["L1", "L2", "L3", "R1", "R2"],
    F: ["L1", "L2", "L3", "R1"],
    "F#": ["L1", "L2", "L3", "R2"],
    Gb: ["L1", "L2", "L3", "R2"],
    G: ["L1", "L2", "L3"],
    "G#": ["L1", "L2", "L3"],
    Ab: ["L1", "L2", "L3"],
    A: ["L1", "L2"],
    "A#": ["L1", "R1"], // "one-and-one" Bb
    Bb: ["L1", "R1"],
    B: ["L1"],
  };

  function fingering(ev) {
    if (!ev || ev.isRest) return [];
    const pc = ev.letter + (ev.acc || "");
    const step = ev.step;
    // Lowest bell notes (C4 and below): full stack + a pinky key.
    if (step <= -2) {
      const stack = ["L1", "L2", "L3", "R1", "R2", "R3"];
      if (ev.letter === "C") return [...stack, "R4"]; // low C, right pinky
      // low B / Bb / A# -> left pinky table
      return [...stack, "L4"];
    }
    let keys = (SHAPE[pc] || SHAPE[ev.letter] || []).slice();
    if (step >= 6) keys = ["O", ...keys]; // upper register: octave key
    return keys;
  }

  function registerName(ev) {
    if (!ev || ev.isRest) return "";
    if (ev.step <= -2) return "Registro grave";
    if (ev.step >= 6) return "Registro agudo \u00b7 octava";
    return "Registro medio";
  }

  /* ---- demo songs --------------------------------------------------- */
  // each: id, title, bpm, beatsPerBar, stars, cover(dataURL|null), keyName, strip
  const DEMOS = [
    {
      id: "demo-remayor",
      title: "Estudio en Re mayor",
      bpm: 92,
      beatsPerBar: 4,
      stars: 2,
      cover: null,
      keyName: "Re",
      strip: "d f# a g | f# e f# d | f# f# | a b a g | f# g f# e | d",
    },
    {
      id: "demo-otonal",
      title: "Balada oto\u00f1al",
      bpm: 68,
      beatsPerBar: 3,
      stars: 1,
      cover: null,
      keyName: "Sol",
      strip: "g a b | c b a | g e | d g | b a g",
    },
    {
      id: "demo-vientosur",
      title: "Viento del sur",
      bpm: 120,
      beatsPerBar: 4,
      stars: 4,
      cover: null,
      keyName: "La",
      strip: "a c' e' c' | b a g# a | e c' b a | g# e e' -",
    },
    {
      id: "demo-grave",
      title: "Marcha grave",
      bpm: 84,
      beatsPerBar: 4,
      stars: 3,
      cover: null,
      keyName: "Do",
      strip: "c, e, g, c | b, a, g, e, | d, g, c -",
    },
    {
      id: "demo-saltos",
      title: "Saltos cromáticos",
      bpm: 104,
      beatsPerBar: 4,
      stars: 5,
      cover: null,
      keyName: "Crom.",
      strip: "c c# d d# e f | f# g g# a a# b | c' -",
    },
  ];

  function blankSong() {
    return {
      id: "song-" + Math.random().toString(36).slice(2, 9),
      title: "",
      bpm: 90,
      beatsPerBar: 4,
      stars: 1,
      cover: null,
      keyName: "",
      strip: "",
    };
  }

  // total beats of an events array
  function totalBeats(events) {
    return events.reduce((s, e) => s + durBeats(e), 0);
  }

  window.MUS = {
    LETTERS, LETTER_BY_IDX, stepOf,
    parseToken, parseStrip, serialize, tokenForEvent,
    LADDER, LADDER_INDEX, durBeats, durLabel, durGlyph, restGlyph,
    makeEvent, reconcile,
    ROWS, SHAPE, fingering, registerName,
    DEMOS, blankSong, totalBeats,
    BASE_OCT_UPPER, BASE_OCT_LOWER,
  };
})();
