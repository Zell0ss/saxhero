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
