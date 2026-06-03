# SaxHero Fase 4 — Fingering Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the alto saxophone key diagram (left column) and scrolling fingering bars to the Player, including the bis key for Bb.

**Architecture:** Three targeted edits to three existing files. music.js gets the bis key data. studio.css gets four new classes. Player.jsx gets two new components (PlayerKeyColumn fixed, Bars moving-in-track) plus geometry constant additions. No new files needed.

**Tech Stack:** React, SVG, existing CSS tokens (--c-octave, --c-left, --c-right), music.js fingering() function.

---

## File Map

| File | Action |
|---|---|
| `frontend/src/music.js` | Add LB to ROWS; update Bb/A# in SHAPE |
| `frontend/src/studio.css` | Append 4 new CSS rules |
| `frontend/src/components/Player.jsx` | New constants + Staff edit + 2 new components + JSX wiring |

---

## Task 1: Update music.js — add bis key

**Files:**
- Modify: `frontend/src/music.js` lines 106–125

- [ ] **Step 1: Update ROWS — insert LB between L1 and L2**

Find this block in `frontend/src/music.js`:

```js
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
```

Replace with:

```js
export const ROWS = [
  { id: "O",  group: "octave", label: "Octava" },
  { id: "L1", group: "left",   label: "Izq. índice" },
  { id: "LB", group: "left",   bis: true, label: "Bis (Bb)" },
  { id: "L2", group: "left",   label: "Izq. medio" },
  { id: "L3", group: "left",   label: "Izq. anular" },
  { id: "L4", group: "left",   pinky: true, label: "Izq. meñique" },
  { id: "R1", group: "right",  label: "Der. índice" },
  { id: "R2", group: "right",  label: "Der. medio" },
  { id: "R3", group: "right",  label: "Der. anular" },
  { id: "R4", group: "right",  pinky: true, label: "Der. meñique" },
];
```

- [ ] **Step 2: Update SHAPE — fix Bb/A# to use bis key**

Find this line in SHAPE:

```js
  "A#": ["L1","R1"], Bb: ["L1","R1"], B: ["L1"],
```

Replace with:

```js
  "A#": ["L1","LB"], Bb: ["L1","LB"], B: ["L1"],
```

- [ ] **Step 3: Verify fingering() needs no changes**

Run in the repo root:

```bash
node -e "
import('/data/saxhero/frontend/src/music.js').then(m => {
  const bb = { isRest:false, letter:'B', acc:'b', octave:4, step: m.stepOf('B',4) };
  console.log('Bb4:', JSON.stringify(m.fingering(bb)));
  const d5 = { isRest:false, letter:'D', acc:'', octave:5, step: m.stepOf('D',5) };
  console.log('D5:', JSON.stringify(m.fingering(d5)));
})" 2>/dev/null || echo "Note: node ESM test not applicable — verify manually in build"
```

Expected Bb4: `["L1","LB"]`. Expected D5: `["O","L1","L2","L3","R1","R2","R3"]`.

(If node ESM fails, the build in Task 4 is sufficient verification.)

- [ ] **Step 4: Commit**

```bash
cd /data/saxhero
git add frontend/src/music.js
git commit -m "feat: add bis key (LB) to ROWS; fix Bb/A# fingering"
```

---

## Task 2: Add CSS for key column and bars

**Files:**
- Modify: `frontend/src/studio.css` (append at end)

- [ ] **Step 1: Append the following CSS at the very end of `frontend/src/studio.css`**

```css
/* =========================================================
   PLAYER — key column + fingering bars (Phase 4)
   ========================================================= */
.player-keycol {
  position: absolute; top: 0; left: 0;
  z-index: 6; pointer-events: none;
}
.player-bars { position: absolute; top: 0; left: 0; }
.player-bar {
  position: absolute;
  border-radius: 4px;
  opacity: 0.7;
}
.player-bar.active {
  opacity: 1;
  filter: brightness(1.25);
}
```

- [ ] **Step 2: Commit**

```bash
cd /data/saxhero
git add frontend/src/studio.css
git commit -m "feat: CSS for player key column and fingering bars"
```

---

## Task 3: Update Player.jsx — constants, Staff, PlayerKeyColumn, Bars

**Files:**
- Modify: `frontend/src/components/Player.jsx`

This task makes 5 targeted edits to Player.jsx.

- [ ] **Step 1: Expand the C constants object and fix NAME_Y**

Find:
```js
const C = {
  STAGE_W:    1060,
  STAGE_H:    600,
  PPB:        150,   // px per beat
  PLAYHEAD:   168,   // x of playhead inside stage
  STEP_PX:    8,     // px per staff step
  STAFF_BASE: 187,   // y of E4 (step 0)
  NAME_Y:     265,   // y baseline for note names
};
```

Replace with:
```js
const C = {
  STAGE_W:    1060,
  STAGE_H:    600,
  PPB:        150,    // px per beat
  PLAYHEAD:   168,    // x of playhead inside stage
  STEP_PX:    8,      // px per staff step
  STAFF_BASE: 187,    // y of E4 (step 0)
  NAME_Y:     240,    // y baseline for note names (raised to fit matrix below)
  COL_W:      146,    // width of fixed key-column on the left
  MATRIX_TOP: 286,    // y of first row in the fingering matrix
  ROW_PITCH:  24,     // vertical px between matrix rows
  BAR_H:      14,     // height of each fingering bar
  BAR_GAP:    5,      // horizontal margin inside each beat's bar
};
```

- [ ] **Step 2: Update Staff to start lines after the key column**

Find in the `Staff` component:
```js
        <line key={s} x1={0} y1={yStep(s)} x2={C.STAGE_W} y2={yStep(s)}
```

Replace with:
```js
        <line key={s} x1={C.COL_W} y1={yStep(s)} x2={C.STAGE_W} y2={yStep(s)}
```

- [ ] **Step 3: Add PlayerKeyColumn component**

After the `Names` component definition (after its closing `}`) and before the `/* ─── Player ─── */` comment, add:

```js
/* ─── fixed key column (left, shows active fingering) ─── */
const COL_COLOR = { octave: 'var(--c-octave)', left: 'var(--c-left)', right: 'var(--c-right)' };

function PlayerKeyColumn({ activeIdx, events }) {
  const ev = activeIdx >= 0 ? events[activeIdx] : null;
  const keys = (ev && !ev.isRest) ? MUS.fingering(ev) : [];
  const on = (id) => keys.includes(id);
  return (
    <svg className="player-keycol" width={C.COL_W} height={C.STAGE_H}>
      <line x1={C.COL_W / 2} y1={C.MATRIX_TOP - 10}
            x2={C.COL_W / 2} y2={C.MATRIX_TOP + MUS.ROWS.length * C.ROW_PITCH + 10}
            stroke="rgba(255,255,255,.06)" strokeWidth="2" />
      {MUS.ROWS.map((row, i) => {
        const cy = C.MATRIX_TOP + i * C.ROW_PITCH;
        const color = COL_COLOR[row.group];
        const lit = on(row.id);
        const glow = lit ? { filter: `drop-shadow(0 0 7px ${color})` } : undefined;
        if (row.id === 'O') {
          return (
            <path key="O" style={glow}
              d={`M 84 ${cy - 12} q 16 1 15 13 q -1 12 -15 12 q 8 -7 6 -14 q -2 -6 -6 -11 z`}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
          );
        }
        if (row.pinky) {
          return (
            <rect key={row.id} style={glow}
              x={C.COL_W / 2 - 20} y={cy - 7} width={40} height={14} rx={7}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" />
          );
        }
        if (row.bis) {
          return (
            <circle key={row.id} style={glow}
              cx={C.COL_W / 2 + 14} cy={cy} r={7}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" />
          );
        }
        return (
          <circle key={row.id} style={glow}
            cx={C.COL_W / 2} cy={cy} r={10}
            fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Add Bars component**

Immediately after `PlayerKeyColumn`'s closing `}` (before `/* ─── Player ─── */`), add:

```js
/* ─── moving fingering bars (inside track, scrolls with notes) ─── */
function Bars({ events, starts, activeIdx, totalBeats }) {
  const w = noteX(totalBeats) + C.PPB;
  return (
    <div className="player-bars" style={{ width: w, height: C.STAGE_H }}>
      {events.map((ev, i) => {
        if (ev.isRest) return null;
        const keys = MUS.fingering(ev);
        const left = noteX(starts[i]) + C.BAR_GAP;
        const barW = Math.max(4, MUS.durBeats(ev) * C.PPB - C.BAR_GAP * 2);
        const active = i === activeIdx;
        return MUS.ROWS.map((row, ri) =>
          keys.includes(row.id) ? (
            <div key={`${i}-${row.id}`}
              className={'player-bar' + (active ? ' active' : '')}
              style={{
                left, width: barW,
                top: C.MATRIX_TOP + ri * C.ROW_PITCH - C.BAR_H / 2,
                height: C.BAR_H,
                background: COL_COLOR[row.group],
              }}
            />
          ) : null
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Wire both components into the JSX**

Find in the Player JSX the `{/* moving track */}` block:

```jsx
        {/* moving track */}
        <div className="player-track" ref={trackRef}>
          <Notation
            events={events} starts={starts} activeIdx={activeIdx}
            beatsPerBar={song.beats_per_bar} totalBeats={totalBeats}
          />
          <Names events={events} starts={starts} activeIdx={activeIdx} totalBeats={totalBeats} />
        </div>

        {/* playhead */}
        <div className="player-playhead" style={{ left: C.PLAYHEAD }} />
```

Replace with:

```jsx
        {/* moving track */}
        <div className="player-track" ref={trackRef}>
          <Notation
            events={events} starts={starts} activeIdx={activeIdx}
            beatsPerBar={song.beats_per_bar} totalBeats={totalBeats}
          />
          <Names events={events} starts={starts} activeIdx={activeIdx} totalBeats={totalBeats} />
          <Bars events={events} starts={starts} activeIdx={activeIdx} totalBeats={totalBeats} />
        </div>

        {/* fixed key column — outside track so it doesn't scroll */}
        <PlayerKeyColumn activeIdx={activeIdx} events={events} />

        {/* playhead */}
        <div className="player-playhead" style={{ left: C.PLAYHEAD }} />
```

- [ ] **Step 6: Verify lint**

```bash
cd /data/saxhero/frontend && npm run lint 2>&1 | grep -E "Player\.jsx|error" | head -10
```

Expected: no errors for Player.jsx.

- [ ] **Step 7: Commit**

```bash
cd /data/saxhero
git add frontend/src/components/Player.jsx
git commit -m "feat: PlayerKeyColumn + Bars components — Phase 4 fingerings"
```

---

## Task 4: Build, deploy, verify

**Files:** none (verification only)

- [ ] **Step 1: Run backend tests**

```bash
cd /data/saxhero/backend && source .venv/bin/activate && pytest -v 2>&1 | tail -5
```

Expected: `23 passed`

- [ ] **Step 2: Build frontend**

```bash
cd /data/saxhero/frontend && npm run build 2>&1 | tail -6
```

Expected: `✓ built in ~Xs` with no errors.

- [ ] **Step 3: Restart service**

```bash
sudo systemctl restart saxhero.service && sudo systemctl is-active saxhero.service
```

Expected: `active`

- [ ] **Step 4: Manual smoke test**

Access `http://seb01:5050`, open player on a song with Bb notes (e.g. a song containing `Bb` or `A#`), and verify:

| Check | Expected |
|---|---|
| Key column visible on left side | 10 rows visible, circles + 2 pinky rects + 1 bis circle offset right |
| D5 note active | Octave key (red crescent) + L1+L2+L3+R1+R2+R3 (yellow/yellow/yellow/blue/blue/blue) lit |
| Bb4 note active | L1 (yellow) + LB small circle (yellow, offset right) lit. R1 NOT lit. |
| A4 note active | L1 + L2 (yellow) lit |
| G4 note active | L1 + L2 + L3 (yellow) lit |
| Fingering bars visible in track | Colored bars scrolling right→left for all notes |
| Active note bars brighter | Active note's bars glow at full opacity |
| Rest events | No bars, no keys lit |
| Staff lines start at COL_W | Gap on left where key column sits, no overlap |

- [ ] **Step 5: Push**

```bash
cd /data/saxhero && git push origin main
```
