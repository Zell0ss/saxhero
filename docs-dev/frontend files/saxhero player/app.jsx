/* global React, ReactDOM, SAX */
const { useState, useRef, useEffect, useCallback } = React;

/* ---------- geometry (logical px inside the 1060x600 stage) ---------- */
const C = {
  STAGE_W: 1060,
  STAGE_H: 600,
  SCROLL_H: 500,          // bands area (staff + names + matrix)
  PPB: 150,               // px per beat
  PLAYHEAD: 168,
  COL_W: 146,             // fixed sax-diagram column width
  STEP_PX: 8,             // half a staff-line gap
  STAFF_BASE: 187,        // y of E4 (step 0)
  NAME_Y: 240,
  MATRIX_TOP: 286,
  ROW_PITCH: 24,
  BAR_H: 15,
  BAR_GAP: 5,
};
const yStep = (s) => C.STAFF_BASE - s * C.STEP_PX;
const rowY = (i) => C.MATRIX_TOP + i * C.ROW_PITCH;
const noteX = (beat) => C.PLAYHEAD + beat * C.PPB;
const TRACK_W = noteX(SAX.END) + 320;
const BPM_BASE = 92;

// stems: notes on/above the middle line (step>=4) point down (left side), else up (right side)
const stemUp = (step) => step < 4;
const stemX = (x, step) => (stemUp(step) ? x + 8 : x - 8);
const stemEndY = (cy, step) => (stemUp(step) ? cy - 38 : cy + 38);
// ledger lines above (step>=10) and below (step<=-2) the staff
const ledgers = (step) => {
  const out = [];
  if (step >= 10) for (let s = 10; s <= step; s += 2) out.push(s);
  if (step <= -2) for (let s = -2; s >= step; s -= 2) out.push(s);
  return out;
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#e9c46a",
  "tempo": 92,
  "glow": 1,
  "showNames": true,
  "bokeh": true
}/*EDITMODE-END*/;

const GROUP_COLOR = {
  octave: "var(--c-octave)",
  left: "var(--c-left)",
  right: "var(--c-right)",
};

/* ---------- bokeh field ---------- */
const BOKEH = (() => {
  const out = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 46; i++) {
    const big = rnd() > 0.84;
    out.push({
      x: rnd() * 100,
      y: rnd() * 100,
      s: big ? 16 + rnd() * 34 : 1.5 + rnd() * 4,
      o: big ? 0.05 + rnd() * 0.08 : 0.18 + rnd() * 0.4,
      hue: 30 + rnd() * 22,
      dur: 14 + rnd() * 22,
      delay: -rnd() * 30,
      drift: (rnd() * 2 - 1) * 14,
    });
  }
  return out;
})();

function Bokeh() {
  return (
    <div className="bokeh">
      {BOKEH.map((b, i) => (
        <span
          key={i}
          style={{
            left: b.x + "%",
            top: b.y + "%",
            width: b.s,
            height: b.s,
            opacity: b.o,
            background: `radial-gradient(circle, hsla(${b.hue},85%,68%,1) 0%, hsla(${b.hue},85%,60%,0) 70%)`,
            animationDuration: b.dur + "s",
            animationDelay: b.delay + "s",
            "--drift": b.drift + "px",
          }}
        />
      ))}
    </div>
  );
}

/* ---------- static staff lines + barlines ---------- */
function Staff() {
  const lines = [0, 2, 4, 6, 8];
  return (
    <svg className="staff" width={C.STAGE_W} height={C.SCROLL_H}>
      {lines.map((s) => (
        <line key={s} x1={C.COL_W} y1={yStep(s)} x2={C.STAGE_W} y2={yStep(s)}
          stroke="rgba(255,255,255,.42)" strokeWidth="1" />
      ))}
    </svg>
  );
}

/* ---------- moving notation layer ---------- */
function Notation({ activeIdx }) {
  const N = SAX.NOTES;
  // beam lines connect stem bottoms of paired 8ths
  const beams = [];
  const groups = {};
  N.forEach((n, i) => { if (n.beam) (groups[n.beam] = groups[n.beam] || []).push(i); });
  Object.values(groups).forEach((ids) => {
    if (ids.length < 2) return;
    const a = SAX.NOTES[ids[0]], b = SAX.NOTES[ids[ids.length - 1]];
    beams.push({
      ax: stemX(noteX(a.beat), a.step), ay: stemEndY(yStep(a.step), a.step),
      bx: stemX(noteX(b.beat), b.step), by: stemEndY(yStep(b.step), b.step),
    });
  });

  return (
    <svg className="notation" width={TRACK_W} height={C.SCROLL_H}>
      {/* barlines */}
      {SAX.BARLINES.map((b) => (
        <line key={b} x1={noteX(b) - C.PPB / 2} y1={yStep(8)} x2={noteX(b) - C.PPB / 2} y2={yStep(0)}
          stroke="rgba(255,255,255,.15)" strokeWidth="1" />
      ))}
      {beams.map((bm, i) => (
        <line key={i} x1={bm.ax} y1={bm.ay} x2={bm.bx} y2={bm.by}
          stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      ))}
      {N.map((n, i) => {
        const x = noteX(n.beat);
        const cy = yStep(n.step);
        const active = i === activeIdx;
        const hollow = n.dur >= 2;
        const sx = stemX(x, n.step);
        return (
          <g key={i} className={"nh" + (active ? " active" : "")}>
            {/* ledger lines */}
            {ledgers(n.step).map((s) => (
              <line key={s} x1={x - 13} y1={yStep(s)} x2={x + 13} y2={yStep(s)}
                stroke="rgba(255,255,255,.7)" strokeWidth="1.4" />
            ))}
            {/* stem */}
            <line x1={sx} y1={cy + (stemUp(n.step) ? -2 : 2)} x2={sx} y2={stemEndY(cy, n.step)}
              stroke="#fff" strokeWidth="1.7" />
            {/* notehead */}
            <ellipse cx={x} cy={cy} rx={active ? 11.5 : 8.6} ry={active ? 8.2 : 6.2}
              transform={`rotate(-22 ${x} ${cy})`}
              fill={hollow ? "none" : "#fff"} stroke="#fff"
              strokeWidth={hollow ? 2.2 : 0} />
            {/* accidental */}
            {n.acc && (
              <text x={x - 22} y={cy + 6} className="acc">{n.acc === "#" ? "♯" : "♭"}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- moving note-name row ---------- */
function Names({ activeIdx }) {
  return (
    <div className="names" style={{ width: TRACK_W }}>
      {SAX.NOTES.map((n, i) => (
        <div key={i} className={"name" + (i === activeIdx ? " active" : "")}
          style={{ left: noteX(n.beat) }}>
          {n.name}
          {n.acc && <sup>{n.acc === "#" ? "♯" : "♭"}</sup>}
        </div>
      ))}
    </div>
  );
}

/* ---------- moving fingering matrix bars ---------- */
function Bars({ activeIdx }) {
  return (
    <div className="bars" style={{ width: TRACK_W }}>
      {SAX.NOTES.map((n, i) => {
        const keys = SAX.FINGER[n.pitch] || [];
        const left = noteX(n.beat) + C.BAR_GAP;
        const w = n.dur * C.PPB - C.BAR_GAP * 2;
        const active = i === activeIdx;
        return SAX.ROWS.map((row, ri) =>
          keys.includes(row.id) ? (
            <div
              key={i + "-" + row.id}
              className={"bar " + row.group + (active ? " active" : "")}
              style={{
                left, width: w,
                top: rowY(ri) - C.BAR_H / 2,
                height: C.BAR_H,
                background: GROUP_COLOR[row.group],
              }}
            />
          ) : null
        );
      })}
    </div>
  );
}

/* ---------- fixed sax key diagram (left column) ---------- */
function KeyColumn({ activeIdx }) {
  const keys = activeIdx >= 0 ? (SAX.FINGER[SAX.NOTES[activeIdx].pitch] || []) : [];
  const on = (id) => keys.includes(id);
  return (
    <div className="col">
      <svg width={C.COL_W} height={C.SCROLL_H}>
        {SAX.ROWS.map((row, i) => {
          const cy = rowY(i);
          const color = GROUP_COLOR[row.group];
          const lit = on(row.id);
          const fill = lit ? color : "none";
          const cls = "key" + (lit ? " lit" : "");
          const style = lit ? { filter: `drop-shadow(0 0 7px ${color})` } : undefined;
          if (row.id === "O") {
            return (
              <path key="O" className={cls} style={style}
                d={`M 84 ${cy - 13} q 17 1 16 14 q -1 13 -16 13 q 9 -8 6 -16 q -2 -6 -6 -11 z`}
                fill={fill} stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
            );
          }
          if (row.pinky) {
            return (
              <rect key={row.id} className={cls} style={style} x="78" y={cy - 7} width="29" height="14" rx="7"
                fill={fill} stroke={color} strokeWidth="2.4" />
            );
          }
          return (
            <circle key={row.id} className={cls} style={style} cx="92" cy={cy} r="10.5"
              fill={fill} stroke={color} strokeWidth="2.4" />
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- icons ---------- */
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5.5 19 12 8 18.5z" fill="currentColor" /></svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="30" height="30"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>
);
const LoopIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l3.5 3.5L17 9" /><path d="M3.5 11V9.5A4 4 0 0 1 7.5 5.5H20.5" />
    <path d="M7 22l-3.5-3.5L7 15" /><path d="M20.5 13v1.5a4 4 0 0 1-4 4H3.5" />
  </svg>
);

/* =================================================================== */
function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.7);
  const [loop, setLoop] = useState(true);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [countNum, setCountNum] = useState(0);
  const [scale, setScale] = useState(1);

  const beatRef = useRef(-4);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const bpmRef = useRef(tw.tempo);
  const activeRef = useRef(-1);
  const countRef = useRef(0);
  const trackRef = useRef(null);
  const lastT = useRef(0);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { bpmRef.current = tw.tempo; }, [tw.tempo]);

  /* fit stage to viewport */
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / C.STAGE_W, window.innerHeight / C.STAGE_H) * 0.98;
      setScale(s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* animation loop */
  useEffect(() => {
    let raf;
    // advance the world by dt seconds and paint
    const step = (dt) => {
      if (playingRef.current) {
        const bps = (bpmRef.current / 60) * speedRef.current;
        beatRef.current += dt * bps;
        if (beatRef.current >= SAX.END) {
          if (loopRef.current) beatRef.current = 0;
          else { playingRef.current = false; setPlaying(false); beatRef.current = -4; }
        }
      }
      const b = beatRef.current;
      if (trackRef.current) trackRef.current.style.transform = `translateX(${-b * C.PPB}px)`;

      const cn = playingRef.current && b < 0 ? Math.floor(b + 4) + 1 : 0;
      if (cn !== countRef.current) { countRef.current = cn; setCountNum(cn); }

      let ai = -1;
      for (let i = 0; i < SAX.NOTES.length; i++) {
        const n = SAX.NOTES[i];
        if (b >= n.beat && b < n.beat + n.dur) { ai = i; break; }
      }
      if (ai !== activeRef.current) { activeRef.current = ai; setActiveIdx(ai); }
    };
    // debug hook so the loop can be driven manually when rAF is throttled
    window.__saxStep = step;
    window.__saxSeek = (beat) => { beatRef.current = beat; step(0); };

    const frame = (t) => {
      if (!lastT.current) lastT.current = t;
      const dt = Math.min((t - lastT.current) / 1000, 0.05);
      lastT.current = t;
      step(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); delete window.__saxStep; delete window.__saxSeek; };
  }, []);

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      playingRef.current = false; setPlaying(false);
    } else {
      if (beatRef.current >= SAX.END) beatRef.current = -4;
      playingRef.current = true; setPlaying(true);
      lastT.current = 0;
    }
  }, []);

  const counting = playing && countNum > 0;

  return (
    <div className="stage"
      style={{
        transform: `scale(${scale})`,
        "--gold": tw.accent,
        "--glow": tw.glow,
      }}>
      {tw.bokeh && <Bokeh />}

      {/* topbar */}
      <div className="label">{SAX.title}</div>
      <button className="menu" aria-label="menú"><span /><span /><span /></button>

      {/* scroll region */}
      <div className="scroll">
        <Staff />
        <div className="track" ref={trackRef}>
          <Notation activeIdx={activeIdx} />
          {tw.showNames && <Names activeIdx={activeIdx} />}
          <Bars activeIdx={activeIdx} />
        </div>

        <div className="mask-left" />
        <div className="mask-right" />
        <KeyColumn activeIdx={activeIdx} />
        <div className={"playhead" + (counting ? " count" : "")} style={{ left: C.PLAYHEAD }} />

        {counting && <div key={countNum} className="countdown">{countNum}</div>}
      </div>

      {/* controls */}
      <div className="controls">
        <button className={"play" + (playing ? " on" : "")} onClick={togglePlay} aria-label="reproducir">
          {playing && !counting ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="speed">
          <span className="cap">Velocidad</span>
          <input type="range" min="0.5" max="1" step="0.05" value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ "--pct": ((speed - 0.5) / 0.5) * 100 + "%" }} />
          <span className="val">{speed.toFixed(2)}×</span>
        </div>

        <button className={"loop" + (loop ? " on" : "")} onClick={() => setLoop((v) => !v)}>
          <LoopIcon /> Loop
        </button>
      </div>

      <TweaksPanel>
        <TweakSection label="Tempo" />
        <TweakSlider label="Tempo base" value={tw.tempo} min={60} max={140} step={2} unit=" BPM"
          onChange={(v) => setTweak("tempo", v)} />
        <TweakSection label="Estética" />
        <TweakColor label="Acento" value={tw.accent}
          options={["#e9c46a", "#d2a13f", "#e8a13c", "#f0d089"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSlider label="Glow" value={tw.glow} min={0} max={2} step={0.1}
          onChange={(v) => setTweak("glow", v)} />
        <TweakToggle label="Bokeh de fondo" value={tw.bokeh}
          onChange={(v) => setTweak("bokeh", v)} />
        <TweakToggle label="Nombres de nota" value={tw.showNames}
          onChange={(v) => setTweak("showNames", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
