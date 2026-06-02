/* Sax practice demo — song data + alto-sax fingerings.
   A short étude in D major, upper register (octave key engaged on every note),
   so the matrix shows the full red/yellow/blue colour spread. */
(function () {
  // step: diatonic staff position. Treble: E4 = 0, each line/space = 1 step.
  // E4=0 F4=1 G4=2 A4=3 B4=4 C5=5 D5=6 E5=7 F5=8 G5=9 A5=10 B5=11
  // Lines at even steps (E4,G4,B4,D5,F5). All notes here are stem-down (step>4).

  // Fingering rows, top -> bottom. group drives colour.
  // L4 = left pinky (low B / Bb / C# table), R4 = right pinky (low C / Eb).
  const ROWS = [
    { id: "O",  group: "octave" },
    { id: "L1", group: "left" },
    { id: "L2", group: "left" },
    { id: "L3", group: "left" },
    { id: "L4", group: "left",  pinky: true },
    { id: "R1", group: "right" },
    { id: "R2", group: "right" },
    { id: "R3", group: "right" },
    { id: "R4", group: "right", pinky: true },
  ];

  // Which keys are pressed per written pitch.
  // Upper register => octave on. Low register (coda) => octave off, pinkies appear.
  const FINGER = {
    // upper register (octave key engaged)
    "D5": ["O", "L1", "L2", "L3", "R1", "R2", "R3"],
    "E5": ["O", "L1", "L2", "L3", "R1", "R2"],
    "F#5":["O", "L1", "L2", "L3", "R2"],
    "G5": ["O", "L1", "L2", "L3"],
    "A5": ["O", "L1", "L2"],
    "B5": ["O", "L1"],
    // low register (no octave key)
    "A4": ["L1", "L2"],
    "G4": ["L1", "L2", "L3"],
    "F#4":["L1", "L2", "L3", "R2"],
    "E4": ["L1", "L2", "L3", "R1", "R2"],
    "D4": ["L1", "L2", "L3", "R1", "R2", "R3"],
    "C4": ["L1", "L2", "L3", "R1", "R2", "R3", "R4"],       // low C — right pinky
    "B3": ["L1", "L2", "L3", "R1", "R2", "R3", "L4"],       // low B — left pinky
    "Bb3":["L1", "L2", "L3", "R1", "R2", "R3", "L4"],       // low Bb — left pinky (= A#)
    "A#3":["L1", "L2", "L3", "R1", "R2", "R3", "L4"],       // same key as Bb
  };

  // beat = onset (in quarter-note beats), dur in beats. beam = group id for 8th beams.
  // pitch = key into FINGER; name/acc = display; step = staff position.
  const N = (pitch, name, acc, step, beat, dur, beam) =>
    ({ pitch, name, acc, step, beat, dur, beam: beam || null });

  const NOTES = [
    // Bar 1
    N("D5",  "D", "",  6, 0,   1),
    N("F#5", "F", "#", 8, 1,   1),
    N("A5",  "A", "", 10, 2,   0.5, "a"),
    N("G5",  "G", "",  9, 2.5, 0.5, "a"),
    N("F#5", "F", "#", 8, 3,   0.5, "b"),
    N("E5",  "E", "",  7, 3.5, 0.5, "b"),
    // Bar 2
    N("F#5", "F", "#", 8, 4,   1),
    N("D5",  "D", "",  6, 5,   1),
    N("F#5", "F", "#", 8, 6,   2),          // half
    // Bar 3
    N("A5",  "A", "", 10, 8,   1),
    N("B5",  "B", "", 11, 9,   0.5, "c"),
    N("A5",  "A", "", 10, 9.5, 0.5, "c"),
    N("G5",  "G", "",  9, 10,  1),
    N("F#5", "F", "#", 8, 11,  1),
    // Bar 4
    N("G5",  "G", "",  9, 12,  1),
    N("F#5", "F", "#", 8, 13,  0.5, "d"),
    N("E5",  "E", "",  7, 13.5,0.5, "d"),
    N("D5",  "D", "",  6, 14,  2),          // half

    // Bar 5 — descend into the low register (octave key releases)
    N("A4",  "A", "",  3, 16,  1),
    N("G4",  "G", "",  2, 17,  1),
    N("F#4", "F", "#", 1, 18,  1),
    N("E4",  "E", "",  0, 19,  1),
    // Bar 6 — low pinky-key passage: C (R pinky), B / Bb / A# (L pinky table)
    N("D4",  "D", "", -1, 20,  1),
    N("C4",  "C", "", -2, 21,  1),          // low C — right pinky
    N("Bb3", "B", "b",-3, 22,  0.5, "e"),   // low Bb — left pinky
    N("A#3", "A", "#",-4, 22.5,0.5, "e"),   // = A# (same key)
    N("B3",  "B", "", -3, 23,  1),          // low B — left pinky
  ];

  const END = 24;       // total beats
  const BARLINES = [4, 8, 12, 16, 20]; // internal barlines (in beats)

  window.SAX = { ROWS, FINGER, NOTES, END, BARLINES, title: "Estudio en Re mayor" };
})();
