import { useState, useRef, useEffect, useMemo } from 'react';
import * as MUS from '../music.js';
import * as Audio from '../audio.js';
import { Icon } from './Ui.jsx';

/* ─── geometry ─── */
const C = {
  STAGE_W:    2800,
  STAGE_H:    1280,
  PPB:        320,    // px per beat
  PLAYHEAD:   350,    // x of playhead inside stage
  STEP_PX:    17,     // px per staff step
  STAFF_BASE: 390,    // y of E4 (step 0)
  NAME_Y:     520,    // y baseline for note names
  COL_W:      300,    // width of fixed key-column on the left
  MATRIX_TOP: 610,    // y of first row in the fingering matrix
  ROW_PITCH:  44,     // vertical px between matrix rows
  BAR_H:      26,     // height of each fingering bar
  BAR_GAP:    10,     // horizontal margin inside each beat's bar
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
        <line key={s} x1={C.COL_W} y1={yStep(s)} x2={C.STAGE_W} y2={yStep(s)}
          stroke="rgba(255,255,255,.38)" strokeWidth="2" />
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
          stroke="rgba(255,255,255,.18)" strokeWidth="2" />
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
              <line key={s} x1={x - 28} y1={yStep(s)} x2={x + 28} y2={yStep(s)}
                stroke="rgba(255,255,255,.65)" strokeWidth="3" />
            ))}
            {/* stem */}
            <line
              x1={su ? x + 17 : x - 17}
              y1={cy + (su ? -4 : 4)}
              x2={su ? x + 17 : x - 17}
              y2={su ? cy - 80 : cy + 80}
              stroke={active ? 'var(--gold)' : '#fff'}
              strokeWidth="3.5"
            />
            {/* notehead */}
            <ellipse
              cx={x} cy={cy}
              rx={active ? 24 : 18} ry={active ? 17 : 13}
              transform={`rotate(-22 ${x} ${cy})`}
              fill={active ? 'var(--gold)' : '#fff'}
              style={active ? { filter: 'drop-shadow(0 0 18px rgba(233,196,106,.9))' } : undefined}
            />
            {/* accidental */}
            {ev.acc && (
              <text x={x - 43} y={cy + 13}
                fill={active ? 'var(--gold)' : 'var(--gold-deep)'}
                style={{ fontFamily: 'var(--music)', fontSize: 30 }}>
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

/* ─── fixed key column (left, shows active fingering) ─── */
const COL_COLOR = { octave: 'var(--c-octave)', left: 'var(--c-left)', right: 'var(--c-right)' };

function PlayerKeyColumn({ activeIdx, events }) {
  const ev = activeIdx >= 0 ? events[activeIdx] : null;
  const keys = (ev && !ev.isRest) ? MUS.fingering(ev) : [];
  const on = (id) => keys.includes(id);
  return (
    <svg className="player-keycol" width={C.COL_W} height={C.STAGE_H}>
      <line x1={C.COL_W / 2} y1={C.MATRIX_TOP - 20}
            x2={C.COL_W / 2} y2={C.MATRIX_TOP + MUS.ROWS.length * C.ROW_PITCH + 20}
            stroke="rgba(255,255,255,.06)" strokeWidth="4" />
      {MUS.ROWS.map((row, i) => {
        const cy = C.MATRIX_TOP + i * C.ROW_PITCH;
        const color = COL_COLOR[row.group];
        const lit = on(row.id);
        const glow = lit ? { filter: `drop-shadow(0 0 14px ${color})` } : undefined;
        if (row.id === 'O') {
          return (
            <path key="O" style={glow}
              d={`M ${C.COL_W / 2 + 22} ${cy - 26} q 32 2 30 26 q -2 26 -30 26 q 16 -14 12 -28 q -4 -12 -12 -22 z`}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="4.5" strokeLinejoin="round" />
          );
        }
        if (row.pinky) {
          return (
            <rect key={row.id} style={glow}
              x={C.COL_W / 2 - 43} y={cy - 15} width={85} height={30} rx={15}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="4.5" />
          );
        }
        if (row.bis) {
          return (
            <circle key={row.id} style={glow}
              cx={C.COL_W / 2 + 30} cy={cy} r={15}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="4.5" />
          );
        }
        return (
          <circle key={row.id} style={glow}
            cx={C.COL_W / 2} cy={cy} r={21}
            fill={lit ? color : 'none'} stroke={color} strokeWidth="4.5" />
        );
      })}
    </svg>
  );
}

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

/* ─── Player ─── */
export default function Player({ song, onBack }) {
  const events     = useMemo(() => song.events || [], [song.events]);
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
      setScale(Math.min(1.0, Math.max(0.3, s)));
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
        if (ai >= 0 && !eventsRef.current[ai].isRest && audioRef.current && playingRef.current) {
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
    if (totalRef.current <= 0) return;
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      beatRef.current = 0;
      prevCnRef.current = 0;
      setCountNum(0);
      return;
    }
    const startNow = () => {
      beatRef.current = skipCountdown ? 0 : -4;
      lastT.current  = 0;
      prevCnRef.current = 0;
      playingRef.current = true;
      setPlaying(true);
    };
    if (audioRef.current) {
      Audio.start().then(startNow).catch(() => startNow());
    } else {
      startNow();
    }
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
          <Bars events={events} starts={starts} activeIdx={activeIdx} totalBeats={totalBeats} />
        </div>

        {/* fixed key column — outside track so it doesn't scroll */}
        <PlayerKeyColumn activeIdx={activeIdx} events={events} />

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
