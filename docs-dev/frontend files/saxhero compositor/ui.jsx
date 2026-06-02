/* global React, MUS */
/* ============================================================
   ui.jsx — shared presentational components (exported to window)
   ============================================================ */
const { useMemo: _useMemo } = React;

/* ---------------- icons ---------------- */
const Icon = {
  play: (p) => (<svg viewBox="0 0 24 24" {...p}><path d="M8 5.2 19 12 8 18.8z" fill="currentColor" /></svg>),
  pause: (p) => (<svg viewBox="0 0 24 24" {...p}><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>),
  loop: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 2l3.5 3.5L17 9" /><path d="M3.5 11V9.5A4 4 0 0 1 7.5 5.5H20.5" /><path d="M7 22l-3.5-3.5L7 15" /><path d="M20.5 13v1.5a4 4 0 0 1-4 4H3.5" /></svg>),
  plus: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>),
  pencil: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></svg>),
  trash: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>),
  back: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 5l-7 7 7 7" /></svg>),
  upload: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>),
  rest: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M7 5c2 1.5 2 4 0 5.5 3 .5 4 3 1.5 5.5M14 6h4M14 12h4M16 6v12" /></svg>),
  panel: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></svg>),
  sax: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 3v7a5 5 0 0 0 5 5h1a4 4 0 0 1 4 4" /><circle cx="9" cy="3" r="1.4" /><circle cx="9" cy="7" r="1" /><circle cx="11" cy="13.5" r="1" /></svg>),
  search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>),
  close: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>),
  chevL: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 5l-7 7 7 7" /></svg>),
  chevR: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 5l7 7-7 7" /></svg>),
  arrows: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>),
};

/* ---------------- stars ---------------- */
function StarShape(props) {
  return (<svg viewBox="0 0 24 24" {...props}><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" fill="currentColor" /></svg>);
}
function Stars({ value, max = 5 }) {
  return (
    <span className="stars">
      {Array.from({ length: max }).map((_, i) => (
        <StarShape key={i} className={i < value ? "on" : "off"} />
      ))}
    </span>
  );
}

/* ---------------- sax key column (brand glyph) ---------------- */
const GROUP_COLOR = { octave: "var(--c-octave)", left: "var(--c-left)", right: "var(--c-right)" };
const RAW_COLOR = { octave: "#ff5d6c", left: "#ffe14d", right: "#5ec8ff" };

function KeyColumn({ keys = [], width = 120 }) {
  const PITCH = 28, TOP = 20;
  const cx = width / 2;
  const H = TOP + MUS.ROWS.length * PITCH;
  const on = (id) => keys.includes(id);
  return (
    <svg width={width} height={H} className="keycol" style={{ display: "block" }}>
      {/* faint instrument body line */}
      <line x1={cx} y1={TOP - 6} x2={cx} y2={H - PITCH + 6} stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
      {MUS.ROWS.map((row, i) => {
        const cy = TOP + i * PITCH;
        const raw = RAW_COLOR[row.group];
        const lit = on(row.id);
        const fill = lit ? raw : "none";
        const stroke = lit ? raw : "rgba(255,255,255,0.16)";
        const style = lit ? { filter: `drop-shadow(0 0 7px ${raw})` } : undefined;
        if (row.id === "O") {
          return (
            <g key="O" transform={`translate(${cx - 90},0)`} style={style}>
              <path d={`M 84 ${cy - 13} q 17 1 16 14 q -1 13 -16 13 q 9 -8 6 -16 q -2 -6 -6 -11 z`}
                fill={fill} stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
            </g>
          );
        }
        if (row.pinky) {
          return (<rect key={row.id} x={cx - 16} y={cy - 7} width="32" height="14" rx="7" fill={fill} stroke={stroke} strokeWidth="2.4" style={style} />);
        }
        return (<circle key={row.id} cx={cx} cy={cy} r="11" fill={fill} stroke={stroke} strokeWidth="2.4" style={style} />);
      })}
    </svg>
  );
}

/* ---------------- staff geometry ---------------- */
const STAFF = { H: 210, BASE: 140, STEP: 9, PPB: 56, PAD_L: 72, PAD_R: 48, OFF: 18, MINW: 560 };
const yStep = (s) => STAFF.BASE - s * STAFF.STEP;
const beatToX = (beat) => STAFF.PAD_L + beat * STAFF.PPB;
function staffWidth(events) {
  return Math.max(STAFF.MINW, STAFF.PAD_L + MUS.totalBeats(events) * STAFF.PPB + STAFF.PAD_R);
}
const stemUp = (step) => step < 4;
function ledgers(step) {
  const out = [];
  if (step >= 10) for (let s = 10; s <= step; s += 2) out.push(s);
  if (step <= -2) for (let s = -2; s >= step; s -= 2) out.push(s);
  return out;
}

/* ---------------- live staff preview ---------------- */
function StaffPreview({ events, beatsPerBar, selectedIdx = -1, activeIdx = -1, onSelect }) {
  const W = staffWidth(events);
  const lines = [0, 2, 4, 6, 8];

  // cumulative beat per event + barline positions
  let cum = 0;
  const placed = events.map((ev) => {
    const start = cum;
    const d = MUS.durBeats(ev);
    cum += d;
    return { ev, start, d };
  });
  const totalB = cum;

  // auto barlines at every beatsPerBar
  const bars = [];
  if (beatsPerBar > 0) {
    for (let b = beatsPerBar; b < totalB - 1e-6; b += beatsPerBar) bars.push(b);
  }

  return (
    <svg className="nota" width={W} height={STAFF.H} style={{ display: "block" }}>
      {/* staff lines */}
      {lines.map((s) => (
        <line key={s} x1={STAFF.PAD_L - 16} y1={yStep(s)} x2={W - 12} y2={yStep(s)} stroke="rgba(255,255,255,0.34)" strokeWidth="1" />
      ))}
      {/* treble clef */}
      <text className="clef" x={STAFF.PAD_L - 56} y={yStep(2) + 22} fontSize="92">{"\uD834\uDD1E"}</text>
      {/* barlines */}
      {bars.map((b, i) => (
        <line key={"b" + i} x1={beatToX(b)} y1={yStep(8)} x2={beatToX(b)} y2={yStep(0)} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      ))}
      {/* final barline */}
      <line x1={beatToX(totalB) + 6} y1={yStep(8)} x2={beatToX(totalB) + 6} y2={yStep(0)} stroke="rgba(255,255,255,0.28)" strokeWidth="2.2" />

      {placed.map(({ ev, start, d }, i) => {
        const x = beatToX(start) + STAFF.OFF;
        const active = i === activeIdx;
        const sel = i === selectedIdx;
        const cls = "nh" + (active ? " active" : "") + (sel ? " sel" : "");

        if (ev.isRest) {
          return (
            <g key={i} className={cls} onClick={() => onSelect && onSelect(i)} style={{ cursor: "pointer" }}>
              <rect x={x - 14} y={yStep(8) - 6} width="30" height={yStep(0) - yStep(8) + 12} fill="transparent" />
              <text className="restglyph" x={x - 7} y={yStep(4) + 8} fontSize="34" style={sel ? { fill: "var(--gold)" } : undefined}>{MUS.restGlyph(ev)}</text>
            </g>
          );
        }

        const cy = yStep(ev.step);
        const hollow = ev.base === "2" || ev.base === "1";
        const up = stemUp(ev.step);
        const sx = up ? x + 7 : x - 7;
        const stemLen = 34;
        const stemEnd = up ? cy - stemLen : cy + stemLen;
        const beatsFor = MUS.durBeats(ev);
        const flags = ev.base === "8" ? 1 : ev.base === "16" ? 2 : 0;

        return (
          <g key={i} className={cls} onClick={() => onSelect && onSelect(i)} style={{ cursor: "pointer" }}>
            {/* hit area */}
            <rect x={beatToX(start)} y="0" width={Math.max(d * STAFF.PPB, 22)} height={STAFF.H} fill="transparent" />
            {/* ledger lines */}
            {ledgers(ev.step).map((s) => (
              <line key={s} x1={x - 13} y1={yStep(s)} x2={x + 13} y2={yStep(s)} stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
            ))}
            {/* stem (not on whole note) */}
            {ev.base !== "1" && (
              <line x1={sx} y1={cy + (up ? -2 : 2)} x2={sx} y2={stemEnd} stroke="#fff" strokeWidth="1.7" />
            )}
            {/* flags */}
            {ev.base !== "1" && Array.from({ length: flags }).map((_, fi) => {
              const fy = stemEnd + (up ? fi * 8 : -fi * 8);
              return (
                <path key={fi} d={up ? `M${sx} ${fy} q 11 4 9 16` : `M${sx} ${fy} q 11 -4 9 -16`}
                  fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              );
            })}
            {/* notehead */}
            <ellipse cx={x} cy={cy} rx={active ? 11 : 8.4} ry={active ? 8 : 6.1}
              transform={`rotate(-22 ${x} ${cy})`} fill={hollow ? "none" : "#fff"} stroke="#fff" strokeWidth={hollow ? 2.1 : 0} />
            {/* dot (puntillo) */}
            {ev.dotted && (<circle cx={x + 15} cy={cy - 2} r="2.4" fill="#fff" />)}
            {/* triplet mark */}
            {ev.triplet && (<text x={x - 4} y={up ? stemEnd - 6 : stemEnd + 14} fontSize="13" fill="var(--gold)" fontWeight="700">3</text>)}
            {/* accidental */}
            {ev.acc && (<text className="acc" x={x - 23} y={cy + 7} fontSize="30">{ev.acc === "#" ? "\u266F" : "\u266D"}</text>)}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- covers ---------------- */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function CoverKeys({ song }) {
  const events = _useMemo(() => MUS.reconcile(song.strip, []), [song.strip]);
  const notes = events.filter((e) => !e.isRest).slice(0, 5);
  const cols = notes.length ? notes : [null];
  return (
    <div className="cover-keys">
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        {cols.map((ev, ci) => {
          const keys = ev ? MUS.fingering(ev) : [];
          return (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {MUS.ROWS.map((row) => {
                const lit = keys.includes(row.id);
                return (
                  <div key={row.id} style={{
                    width: row.pinky ? 22 : 14, height: 6, borderRadius: 4,
                    background: lit ? RAW_COLOR[row.group] : "rgba(255,255,255,0.07)",
                    boxShadow: lit ? `0 0 9px -1px ${RAW_COLOR[row.group]}` : "none",
                    margin: "0 auto", transition: "all .2s",
                  }} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverSnap({ song }) {
  const events = _useMemo(() => MUS.reconcile(song.strip, []), [song.strip]);
  const notes = events.filter((e) => !e.isRest).slice(0, 9);
  const W = 280, H = 175, midY = 96, sp = 7;
  const xs = notes.length ? notes : [];
  const slot = (W - 40) / Math.max(xs.length, 1);
  const yOf = (step) => midY - step * sp;
  return (
    <div className="cover-snap">
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {[0, 2, 4, 6, 8].map((s) => (
          <line key={s} x1="14" y1={yOf(s)} x2={W - 14} y2={yOf(s)} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        ))}
        {xs.map((ev, i) => {
          const x = 30 + i * slot + slot / 2;
          const cy = yOf(ev.step);
          return (
            <g key={i}>
              <line x1={x + 6} y1={cy} x2={x + 6} y2={cy - 26} stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
              <ellipse cx={x} cy={cy} rx="6" ry="4.4" transform={`rotate(-22 ${x} ${cy})`} fill="#fff" />
              {ev.acc && (<text x={x - 16} y={cy + 5} fontSize="18" fill="var(--gold)" fontFamily="var(--music)">{ev.acc === "#" ? "\u266F" : "\u266D"}</text>)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CoverMono({ song }) {
  const ch = (song.keyName && song.keyName.trim()) || (song.title && song.title.trim()[0]) || "\u266A";
  return (
    <div className="cover-mono">
      <div className="glyph">{ch}</div>
      <div className="sub">{song.keyName ? "Tonalidad" : "Estudio"}</div>
    </div>
  );
}

function CoverWave({ song }) {
  const rnd = _useMemo(() => seeded(song.title + ":" + song.bpm + ":" + song.strip), [song.title, song.bpm, song.strip]);
  const bars = _useMemo(() => Array.from({ length: 38 }, () => 0.18 + rnd() * 0.82), [rnd]);
  return (
    <div className="cover-wave">
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 3, padding: "0 18px" }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h * 70}%`, borderRadius: 3,
            background: `linear-gradient(180deg, #f6e2ac, var(--gold) 60%, rgba(210,161,63,0.4))`,
            opacity: 0.35 + h * 0.55,
          }} />
        ))}
      </div>
    </div>
  );
}

function CoverPhotoPlaceholder() {
  return (
    <div className="cover-keys" style={{
      backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 10px, transparent 10px 20px)",
    }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ color: "rgba(243,239,230,0.4)", fontSize: 11.5, letterSpacing: "0.1em", fontFamily: "monospace" }}>foto de portada</div>
      </div>
    </div>
  );
}

function Cover({ song, style }) {
  if (song.cover) {
    return (<div className="cover-art"><div className="cover-photo" style={{ backgroundImage: `url(${song.cover})` }} /><div className="scrim" /></div>);
  }
  let inner = null;
  if (style === "keys") inner = <CoverKeys song={song} />;
  else if (style === "snapshot") inner = <CoverSnap song={song} />;
  else if (style === "mono") inner = <CoverMono song={song} />;
  else if (style === "wave") inner = <CoverWave song={song} />;
  else inner = <CoverPhotoPlaceholder />;
  return (<div className="cover-art">{inner}<div className="scrim" /></div>);
}

/* ---------------- bokeh ---------------- */
const BOKEH = (() => {
  const out = []; let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 42; i++) {
    const big = rnd() > 0.84;
    out.push({ x: rnd() * 100, y: rnd() * 100, s: big ? 18 + rnd() * 36 : 1.5 + rnd() * 4, o: big ? 0.05 + rnd() * 0.07 : 0.16 + rnd() * 0.36, hue: 30 + rnd() * 22, dur: 16 + rnd() * 22, delay: -rnd() * 30, drift: (rnd() * 2 - 1) * 16 });
  }
  return out;
})();
function Bokeh() {
  return (
    <div className="bokeh">
      {BOKEH.map((b, i) => (
        <span key={i} style={{ left: b.x + "%", top: b.y + "%", width: b.s, height: b.s, opacity: b.o, background: `radial-gradient(circle, hsla(${b.hue},85%,68%,1) 0%, hsla(${b.hue},85%,60%,0) 70%)`, animationDuration: b.dur + "s", animationDelay: b.delay + "s", "--drift": b.drift + "px" }} />
      ))}
    </div>
  );
}

Object.assign(window, {
  Icon, Stars, StarShape, KeyColumn, StaffPreview, Cover,
  CoverKeys, CoverSnap, CoverMono, CoverWave, Bokeh,
  GROUP_COLOR, RAW_COLOR, STAFF, beatToX, staffWidth, yStep,
});
