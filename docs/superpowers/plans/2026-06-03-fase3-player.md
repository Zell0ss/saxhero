# SaxHero Fase 3 — Player "Sax Hero" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SaxHero Player — a full-screen Guitar Hero–style scroller where notes fly right→left on a staff as the musician practices with their saxophone.

**Architecture:** Single `Player.jsx` component with a `requestAnimationFrame` loop (same pattern as the editor). The loop advances `beatRef`, applies `translateX(-beat*PPB)` to a moving track div, tracks the active note, and drives the countdown via negative beats (-4→0). The stage is a fixed 1060×600 logical canvas scaled to fit the viewport with `transform: scale()`.

**Tech Stack:** React hooks, SVG (staff + notation), CSS transforms, Tone.js (audio.js — already installed), existing tokens in studio.css.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/studio.css` | Modify | All player CSS (`.player-*` classes) |
| `frontend/src/components/Player.jsx` | **Create** | Full player component |
| `frontend/src/App.jsx` | Modify | Add `openPlayer` + `"player"` route |
| `frontend/src/components/SongList.jsx` | Modify | Add `onPlay` prop + "Practicar" button |

---

## Task 1: Player CSS

**Files:**
- Modify: `frontend/src/studio.css`

- [ ] **Step 1: Append all player styles at the end of `frontend/src/studio.css`**

```css
/* =========================================================
   PLAYER — Sax Hero scroller
   ========================================================= */

/* Outer wrapper used by App.jsx in player mode — no titlebar */
.player-mode .titlebar { display: none; }
.player-mode .view { height: 100vh; }

/* Stage: fixed logical canvas, scaled to viewport */
.player-stage {
  position: absolute;
  top: 0; left: 0;
  width: 1060px; height: 600px;
  background: radial-gradient(130% 100% at 50% -10%, #15121a 0%, var(--bg) 58%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── topbar ── */
.player-topbar {
  flex: none; height: 50px;
  display: flex; align-items: center; gap: 18px;
  padding: 0 24px;
  border-bottom: 1px solid var(--line-soft);
}
.player-back {
  width: 38px; height: 38px; border-radius: 11px; flex: none;
  background: rgba(255,255,255,.04); border: 1px solid var(--line);
  color: var(--ink-dim); display: grid; place-items: center;
  transition: all .15s;
}
.player-back:hover { color: var(--ink); border-color: rgba(255,255,255,.26); }
.player-back svg { width: 18px; height: 18px; }
.player-title { font-size: 18px; font-weight: 600; color: var(--ink); letter-spacing: -.01em; }
.player-meta  { font-size: 13px; color: var(--ink-faint); font-variant-numeric: tabular-nums; margin-left: auto; }

/* ── scroll region ── */
.player-scroll {
  flex: 1; position: relative; overflow: hidden;
}

/* static staff lines (horizontal, behind notes, not in track) */
.player-staff {
  position: absolute; top: 0; left: 0;
  pointer-events: none; z-index: 1;
}

/* moving track — translateX animated */
.player-track {
  position: absolute; top: 0; left: 0;
  will-change: transform; z-index: 2;
}

/* notation SVG inside track */
.player-notation { display: block; overflow: visible; }

/* note-name row inside track */
.player-names {
  position: absolute; top: 0; left: 0;
}
.player-name {
  position: absolute;
  font-size: 26px; font-weight: 700; line-height: 1;
  color: rgba(243,239,230,.55);
  transform: translateX(-50%);
  letter-spacing: -.02em;
  pointer-events: none;
  white-space: nowrap;
}
.player-name.active {
  color: var(--gold);
  font-size: 36px;
  text-shadow: 0 0 24px rgba(233,196,106,.7);
}
.player-name sup { font-size: .55em; margin-left: 1px; }

/* playhead — vertical gold line, fixed */
.player-playhead {
  position: absolute; top: 0; bottom: 0; width: 3px; border-radius: 2px;
  background: linear-gradient(180deg,
    transparent 0%, var(--gold) 15%,
    #fff4d6 50%, var(--gold) 85%, transparent 100%);
  box-shadow: 0 0 18px rgba(255,221,140,.8), 0 0 40px rgba(233,196,106,.36);
  z-index: 5; pointer-events: none;
}

/* edge gradient fades */
.player-mask-left {
  position: absolute; top: 0; left: 0; bottom: 0; width: 130px;
  background: linear-gradient(to right, var(--bg) 20%, transparent);
  pointer-events: none; z-index: 4;
}
.player-mask-right {
  position: absolute; top: 0; right: 0; bottom: 0; width: 60px;
  background: linear-gradient(to left, var(--bg) 0%, transparent);
  pointer-events: none; z-index: 4;
}

/* countdown number */
.player-countdown {
  position: absolute; inset: 0; z-index: 10;
  display: grid; place-items: center;
  font-size: 130px; font-weight: 900; line-height: 1;
  color: var(--gold);
  text-shadow: 0 0 60px rgba(233,196,106,.6);
  animation: count-pop .12s ease-out;
  pointer-events: none;
}

/* ── controls bar ── */
.player-controls {
  flex: none; height: 60px;
  display: flex; align-items: center; gap: 24px;
  padding: 0 24px;
  border-top: 1px solid var(--line-soft);
  background: linear-gradient(180deg, transparent, rgba(8,7,10,.55));
}
.player-play {
  flex: none; width: 52px; height: 52px; border-radius: 14px;
  background: radial-gradient(120% 120% at 50% 0%, rgba(233,196,106,.18), rgba(233,196,106,.05));
  border: 1.5px solid rgba(233,196,106,.55); color: var(--gold);
  display: grid; place-items: center; transition: all .18s;
}
.player-play:hover { border-color: var(--gold); box-shadow: 0 0 24px -4px rgba(233,196,106,.5); }
.player-play.on { background: radial-gradient(120% 120% at 50% 0%, rgba(233,196,106,.3), rgba(233,196,106,.08)); }
.player-play svg { width: 26px; height: 26px; }
.player-speed { display: flex; align-items: center; gap: 14px; flex: 1; max-width: 340px; }
.player-speed .cap { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; flex: none; }
.player-speed .val { flex: none; width: 52px; text-align: right; font-weight: 700; font-size: 16px; color: var(--gold); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Commit**

```bash
cd /data/saxhero
git add frontend/src/studio.css
git commit -m "feat: player CSS — stage, scroll, bands, controls"
```

---

## Task 2: Create Player.jsx

**Files:**
- Create: `frontend/src/components/Player.jsx`

- [ ] **Step 1: Create `frontend/src/components/Player.jsx` with this exact content**

```jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import * as MUS from '../music.js';
import * as Audio from '../audio.js';
import { Icon } from './Ui.jsx';

/* ─── geometry ─── */
const C = {
  STAGE_W:    1060,
  STAGE_H:    600,
  PPB:        150,   // px per beat
  PLAYHEAD:   168,   // x of playhead inside stage
  STEP_PX:    8,     // px per staff step
  STAFF_BASE: 187,   // y of E4 (step 0)
  NAME_Y:     265,   // y baseline for note names
};

const yStep  = (s) => C.STAFF_BASE - s * C.STEP_PX;
const noteX  = (beat) => C.PLAYHEAD + beat * C.PPB;
const stemUp = (step) => step < 4;

function ledgers(step) {
  const out = [];
  if (step >= 10) for (let s = 10; s <= step; s += 2) out.push(s);
  if (step <= -2) for (let s = -2; s >= step; s -= 2) out.push(s);
  return out;
}

function cumStarts(events) {
  let c = 0;
  return events.map((ev) => { const s = c; c += MUS.durBeats(ev); return s; });
}

function findActiveIdx(beat, events, starts) {
  for (let i = 0; i < events.length; i++) {
    if (beat >= starts[i] - 1e-6 && beat < starts[i] + MUS.durBeats(events[i]) - 1e-6) return i;
  }
  return -1;
}

/* ─── static staff lines (does NOT scroll) ─── */
function Staff() {
  const lines = [0, 2, 4, 6, 8];
  return (
    <svg className="player-staff" width={C.STAGE_W} height={C.STAGE_H}>
      {lines.map((s) => (
        <line key={s} x1={0} y1={yStep(s)} x2={C.STAGE_W} y2={yStep(s)}
          stroke="rgba(255,255,255,.38)" strokeWidth="1" />
      ))}
    </svg>
  );
}

/* ─── moving notation SVG (notes + stems + barlines) ─── */
function Notation({ events, starts, activeIdx, beatsPerBar, totalBeats }) {
  const w = noteX(totalBeats) + C.PPB;
  const bars = [];
  if (beatsPerBar > 0) {
    for (let b = beatsPerBar; b < totalBeats; b += beatsPerBar) bars.push(b);
  }
  return (
    <svg className="player-notation" width={w} height={C.STAGE_H}>
      {/* barlines */}
      {bars.map((b) => (
        <line key={b} x1={noteX(b)} y1={yStep(8)} x2={noteX(b)} y2={yStep(0)}
          stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      ))}
      {/* notes */}
      {events.map((ev, i) => {
        if (ev.isRest) return null;
        const step = MUS.stepOf(ev.letter, ev.octave);
        const x  = noteX(starts[i]);
        const cy = yStep(step);
        const active = i === activeIdx;
        const su = stemUp(step);
        return (
          <g key={i}>
            {/* ledger lines */}
            {ledgers(step).map((s) => (
              <line key={s} x1={x - 13} y1={yStep(s)} x2={x + 13} y2={yStep(s)}
                stroke="rgba(255,255,255,.65)" strokeWidth="1.4" />
            ))}
            {/* stem */}
            <line
              x1={su ? x + 8 : x - 8}
              y1={cy + (su ? -2 : 2)}
              x2={su ? x + 8 : x - 8}
              y2={su ? cy - 38 : cy + 38}
              stroke={active ? 'var(--gold)' : '#fff'}
              strokeWidth="1.7"
            />
            {/* notehead */}
            <ellipse
              cx={x} cy={cy}
              rx={active ? 11.5 : 8.6} ry={active ? 8.2 : 6.2}
              transform={`rotate(-22 ${x} ${cy})`}
              fill={active ? 'var(--gold)' : '#fff'}
              style={active ? { filter: 'drop-shadow(0 0 9px rgba(233,196,106,.9))' } : undefined}
            />
            {/* accidental */}
            {ev.acc && (
              <text x={x - 20} y={cy + 6}
                fill={active ? 'var(--gold)' : 'var(--gold-deep)'}
                style={{ fontFamily: 'var(--music)', fontSize: 14 }}>
                {ev.acc === '#' ? '♯' : '♭'}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── moving note-name row ─── */
function Names({ events, starts, activeIdx, totalBeats }) {
  const w = noteX(totalBeats) + C.PPB;
  return (
    <div className="player-names" style={{ width: w, height: C.STAGE_H }}>
      {events.map((ev, i) => {
        if (ev.isRest) return null;
        const active = i === activeIdx;
        return (
          <div key={i}
            className={'player-name' + (active ? ' active' : '')}
            style={{ left: noteX(starts[i]), top: C.NAME_Y }}>
            {ev.letter}
            {ev.acc && <sup>{ev.acc === '#' ? '♯' : '♭'}</sup>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Player ─── */
export default function Player({ song, onBack }) {
  const events     = useMemo(() => song.events || [], [song.id]);
  const starts     = useMemo(() => cumStarts(events), [events]);
  const totalBeats = useMemo(() => MUS.totalBeats(events), [events]);

  const [playing,       setPlaying]       = useState(false);
  const [speed,         setSpeed]         = useState(0.7);
  const [loop,          setLoop]          = useState(true);
  const [audioEnabled,  setAudioEnabled]  = useState(false);
  const [skipCountdown, setSkipCountdown] = useState(false);
  const [activeIdx,     setActiveIdx]     = useState(-1);
  const [countNum,      setCountNum]      = useState(0);
  const [scale,         setScale]         = useState(1);

  const trackRef    = useRef(null);
  const beatRef     = useRef(0);
  const playingRef  = useRef(false);
  const speedRef    = useRef(speed);
  const loopRef     = useRef(loop);
  const bpmRef      = useRef(song.bpm);
  const audioRef    = useRef(false);
  const activeRef   = useRef(-1);
  const prevCnRef   = useRef(0);
  const lastT       = useRef(0);
  // Refs for values used inside the RAF closure (avoids exhaustive-deps lint error)
  const eventsRef   = useRef(events);
  const startsRef   = useRef(starts);
  const totalRef    = useRef(totalBeats);

  useEffect(() => { speedRef.current  = speed; },        [speed]);
  useEffect(() => { loopRef.current   = loop; },         [loop]);
  useEffect(() => { bpmRef.current    = song.bpm; },     [song.bpm]);
  useEffect(() => { audioRef.current  = audioEnabled; }, [audioEnabled]);
  useEffect(() => { eventsRef.current = events; },       [events]);
  useEffect(() => { startsRef.current = starts; },       [starts]);
  useEffect(() => { totalRef.current  = totalBeats; },   [totalBeats]);

  /* fit stage to viewport */
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / C.STAGE_W, window.innerHeight / C.STAGE_H) * 0.98;
      setScale(Math.max(0.3, s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  /* RAF loop — uses only refs, so exhaustive-deps is satisfied with [] */
  useEffect(() => {
    let raf;

    const frame = (t) => {
      if (!lastT.current) lastT.current = t;
      const dt = Math.min((t - lastT.current) / 1000, 0.05);
      lastT.current = t;

      if (playingRef.current) {
        const bps = (bpmRef.current / 60) * speedRef.current;
        beatRef.current += dt * bps;
        if (beatRef.current >= totalRef.current) {
          if (loopRef.current) beatRef.current = 0;
          else { beatRef.current = 0; playingRef.current = false; setPlaying(false); }
        }
      }

      const b = beatRef.current;

      // scroll
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${-b * C.PPB}px)`;
      }

      // countdown: beats -4→0 → shows 1,2,3,4
      const cn = (playingRef.current && b < 0) ? Math.floor(b + 4) + 1 : 0;
      if (cn !== prevCnRef.current) {
        prevCnRef.current = cn;
        setCountNum(cn);
        if (cn >= 1 && cn <= 4 && audioRef.current) Audio.playClick();
      }

      // active note
      const ai = findActiveIdx(b, eventsRef.current, startsRef.current);
      if (ai !== activeRef.current) {
        activeRef.current = ai;
        setActiveIdx(ai);
        if (ai >= 0 && !eventsRef.current[ai].isRest && audioRef.current) {
          const durSec = MUS.durBeats(eventsRef.current[ai]) * 60 / (bpmRef.current * speedRef.current);
          Audio.playNote(eventsRef.current[ai], durSec);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = () => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      beatRef.current = 0;
      prevCnRef.current = 0;
      setCountNum(0);
      return;
    }
    if (audioRef.current) Audio.start();
    beatRef.current = skipCountdown ? 0 : -4;
    lastT.current  = 0;
    prevCnRef.current = 0;
    playingRef.current = true;
    setPlaying(true);
  };

  const counting = playing && countNum > 0;

  return (
    <div className="player-stage"
      style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>

      {/* topbar */}
      <div className="player-topbar">
        <button className="player-back" onClick={onBack}><Icon.back /></button>
        <span className="player-title">{song.title || 'Sin título'}</span>
        <span className="player-meta">{song.bpm} BPM</span>
      </div>

      {/* scroll region */}
      <div className="player-scroll">
        {/* fixed staff lines */}
        <Staff />

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

        {/* edge fades */}
        <div className="player-mask-left" />
        <div className="player-mask-right" />

        {/* countdown */}
        {countNum > 0 && <div key={countNum} className="player-countdown">{countNum}</div>}
      </div>

      {/* controls */}
      <div className="player-controls">
        <button className={'player-play' + ((playing || counting) ? ' on' : '')} onClick={togglePlay}>
          {playing && !counting ? <Icon.pause /> : <Icon.play />}
        </button>
        <div className="player-speed">
          <span className="cap">Velocidad</span>
          <input type="range" className="brass" min="0.5" max="1" step="0.05" value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ '--pct': ((speed - 0.5) / 0.5) * 100 + '%' }} />
          <span className="val">{speed.toFixed(2)}×</span>
        </div>
        <button className={'loop-btn' + (loop ? ' on' : '')} onClick={() => setLoop((v) => !v)}>
          <Icon.loop /> Loop
        </button>
        <button className={'loop-btn' + (audioEnabled ? ' on' : '')}
          onClick={() => setAudioEnabled((v) => !v)}
          title="Sonido del sintetizador">
          🔊
        </button>
        <button className={'loop-btn' + (skipCountdown ? ' on' : '')}
          onClick={() => setSkipCountdown((v) => !v)}
          title="Omitir cuenta atrás">
          1-2-3-4
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

```bash
cd /data/saxhero/frontend && npm run lint 2>&1 | grep "Player"
```

Expected: no errors for Player.jsx (the eslint-disable comment on the `useEffect` deps is intentional).

- [ ] **Step 3: Commit**

```bash
cd /data/saxhero
git add frontend/src/components/Player.jsx
git commit -m "feat: Player component — RAF scroller, staff, names, controls"
```

---

## Task 3: Routing + "Practicar" button

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/SongList.jsx`

### 3a — App.jsx

- [ ] **Step 1: Add Player import after the Editor import (line 4)**

```js
import Player from './components/Player.jsx';
```

- [ ] **Step 2: Add `openPlayer` callback after `openSong` (~line 58)**

```js
  const openPlayer = useCallback(async (id) => {
    setLoading(true);
    try {
      const song = await api.getSong(id);
      const localEvents = (song.events || []).map(apiToLocal);
      setCurrentSong({ ...song, events: localEvents });
      setRoute({ screen: "player", id });
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 3: Add player route to JSX**

Find the `return (` block. Replace the outer `<div className="app">` structure with:

```jsx
  // Player mode: full-screen, no compositor titlebar
  if (route.screen === "player" && currentSong) {
    return (
      <div className="app player-mode">
        <Player
          key={currentSong.id}
          song={currentSong}
          onBack={goList}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Bokeh />
      <div className="titlebar">
        <div className="dots"><i /><i /><i /></div>
        <div className="brand">
          <span className="mark">♪</span>
          <b>SaxHero</b> Compositor
        </div>
        <div className="spacer" />
        <div className="crumbs">
          {route.screen === "editor" && currentSong
            ? (currentSong.title || "Sin título")
            : `${songs.length} canciones`}
        </div>
      </div>
      <div className="view">
        {route.screen === "editor" && currentSong ? (
          <Editor
            key={currentSong.id}
            song={currentSong}
            sideOpen={sideOpen}
            onToggleSide={() => setSideOpen((v) => !v)}
            onPatch={patchSong}
            onSave={saveSong}
            saving={saving}
            onBack={goList}
          />
        ) : (
          <SongList
            songs={songs}
            onOpen={openSong}
            onPlay={openPlayer}
            onCreate={createSong}
            onDelete={deleteSong}
          />
        )}
      </div>
    </div>
  );
```

Note the addition of `onPlay={openPlayer}` on SongList.

### 3b — SongList.jsx

- [ ] **Step 4: Add `onPlay` to the component signature (line 36)**

```js
export default function SongList({ songs, onOpen, onPlay, onCreate, onDelete }) {
```

- [ ] **Step 5: Add "Practicar" button inside the card, alongside the existing action buttons (~line 105)**

Find the `row-actions` div:
```jsx
<div className="row-actions" onClick={(e) => e.stopPropagation()}>
  <button className="icon-btn" onClick={() => onOpen(song.id)}><Icon.pencil /></button>
  <button className="icon-btn danger" onClick={() => onDelete(song.id)}><Icon.trash /></button>
</div>
```

Replace with:
```jsx
<div className="row-actions" onClick={(e) => e.stopPropagation()}>
  <button className="icon-btn" onClick={() => onPlay(song.id)} title="Practicar">▶</button>
  <button className="icon-btn" onClick={() => onOpen(song.id)} title="Editar"><Icon.pencil /></button>
  <button className="icon-btn danger" onClick={() => onDelete(song.id)} title="Borrar"><Icon.trash /></button>
</div>
```

- [ ] **Step 6: Verify lint**

```bash
cd /data/saxhero/frontend && npm run lint 2>&1 | grep -E "App\.jsx|SongList"
```

Expected: no errors for App.jsx or SongList.jsx.

- [ ] **Step 7: Commit**

```bash
cd /data/saxhero
git add frontend/src/App.jsx frontend/src/components/SongList.jsx
git commit -m "feat: player routing + Practicar button in song list"
```

---

## Task 4: Build, deploy, verify

**Files:** none (verification only)

- [ ] **Step 1: Build frontend**

```bash
cd /data/saxhero/frontend && npm run build 2>&1 | tail -8
```

Expected:
```
✓ built in ~1s
```
If there are errors: read them, fix the source, re-run.

- [ ] **Step 2: Run backend tests (must stay green)**

```bash
cd /data/saxhero/backend && source .venv/bin/activate && pytest -v 2>&1 | tail -5
```

Expected: `23 passed`

- [ ] **Step 3: Restart service**

```bash
sudo systemctl restart saxhero.service && sudo systemctl is-active saxhero.service
```

Expected: `active`

- [ ] **Step 4: Manual smoke test checklist**

Access `http://seb01:5050` in a browser (desktop simulating landscape or actual mobile):

| Check | Expected |
|---|---|
| Song list loads | Cards visible with new ▶ button |
| Click ▶ on a song | Player opens full-screen, no compositor titlebar |
| Stage scales to viewport | All content visible, no scroll bars |
| Staff lines visible | 5 horizontal lines across the stage |
| Notes visible as noteheads + stems | White noteheads at correct staff positions |
| Note names below staff | Letters (D, F#, etc.) at correct x positions |
| Barlines visible | Vertical lines at correct beat intervals |
| Play → countdown 1-2-3-4 | Numbers appear over the stage, notes fly in from right |
| Playback starts at beat 0 | First note reaches playhead, turns gold |
| Active note glows gold | Notehead + stem + name in gold + glow |
| Speed slider 0.5× | Playback visibly slower |
| Loop on → song restarts | After last note, loops back |
| Loop off → stops at end | Stops at last note |
| 🔊 on → notes audible | Synth sounds as each note crosses playhead |
| 🔊 off → silence | No audio |
| 1-2-3-4 on → instant play | No countdown, play starts immediately |
| ← back button → song list | Returns to list |
| High/low notes (ledger lines) | Ledger lines rendered for notes outside staff |

- [ ] **Step 5: Final commit + push**

```bash
cd /data/saxhero
git add -p  # stage any minor fixes made during smoke test
git commit -m "feat: phase 3 complete — Sax Hero player"
git push origin main
```
