import * as MUS from '../music.js';

// ---- icons ----
export const Icon = {
  play:   (p) => <svg viewBox="0 0 24 24" {...p}><path d="M8 5.2 19 12 8 18.8z" fill="currentColor" /></svg>,
  pause:  (p) => <svg viewBox="0 0 24 24" {...p}><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>,
  loop:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 2l3.5 3.5L17 9" /><path d="M3.5 11V9.5A4 4 0 0 1 7.5 5.5H20.5" /><path d="M7 22l-3.5-3.5L7 15" /><path d="M20.5 13v1.5a4 4 0 0 1-4 4H3.5" /></svg>,
  plus:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  pencil: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></svg>,
  trash:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>,
  back:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 5l-7 7 7 7" /></svg>,
  upload: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>,
  panel:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>,
  close:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  chevL:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 5l-7 7 7 7" /></svg>,
  chevR:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 5l7 7-7 7" /></svg>,
  arrows: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>,
  save:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
};

// ---- stars ----
export function StarShape(props) {
  return <svg viewBox="0 0 24 24" {...props}><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" fill="currentColor" /></svg>;
}
export function Stars({ value, max = 5 }) {
  return (
    <span className="stars">
      {Array.from({ length: max }).map((_, i) => (
        <StarShape key={i} className={i < value ? "on" : "off"} />
      ))}
    </span>
  );
}

// ---- key column ----
export const RAW_COLOR = { octave: "#ff5d6c", left: "#ffe14d", right: "#5ec8ff" };

export function KeyColumn({ keys = [], width = 120 }) {
  const PITCH = 28, TOP = 20;
  const cx = width / 2;
  const H = TOP + MUS.ROWS.length * PITCH;
  const on = (id) => keys.includes(id);
  return (
    <svg width={width} height={H} style={{ display: "block" }}>
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
          return <rect key={row.id} x={cx - 16} y={cy - 7} width="32" height="14" rx="7" fill={fill} stroke={stroke} strokeWidth="2.4" style={style} />;
        }
        return <circle key={row.id} cx={cx} cy={cy} r="11" fill={fill} stroke={stroke} strokeWidth="2.4" style={style} />;
      })}
    </svg>
  );
}

// ---- staff geometry ----
export const STAFF = { H: 210, BASE: 140, STEP: 9, PPB: 56, PAD_L: 72, PAD_R: 48, OFF: 18, MINW: 560 };
export const yStep = (s) => STAFF.BASE - s * STAFF.STEP;
export const beatToX = (beat) => STAFF.PAD_L + beat * STAFF.PPB;
export function staffWidth(events) {
  return Math.max(STAFF.MINW, STAFF.PAD_L + MUS.totalBeats(events) * STAFF.PPB + STAFF.PAD_R);
}
const stemUp = (step) => step < 4;
function ledgers(step) {
  const out = [];
  if (step >= 10) for (let s = 10; s <= step; s += 2) out.push(s);
  if (step <= -2) for (let s = -2; s >= step; s -= 2) out.push(s);
  return out;
}

// ---- staff preview ----
export function StaffPreview({ events, beatsPerBar, selectedIdx = -1, activeIdx = -1, onSelect }) {
  const W = staffWidth(events);
  const lines = [0, 2, 4, 6, 8];
  let cum = 0;
  const placed = events.map((ev) => {
    const start = cum;
    const d = MUS.durBeats(ev);
    cum += d;
    return { ev, start, d };
  });
  const totalB = cum;
  const bars = [];
  if (beatsPerBar > 0) {
    for (let b = beatsPerBar; b < totalB - 1e-6; b += beatsPerBar) bars.push(b);
  }
  return (
    <svg className="nota" width={W} height={STAFF.H} style={{ display: "block" }}>
      {lines.map((s) => (
        <line key={s} x1={STAFF.PAD_L - 16} y1={yStep(s)} x2={W - 12} y2={yStep(s)} stroke="rgba(255,255,255,0.34)" strokeWidth="1" />
      ))}
      <text className="clef" x={STAFF.PAD_L - 56} y={yStep(2) + 22} fontSize="92">{"𝄞"}</text>
      {bars.map((b, i) => (
        <line key={"b" + i} x1={beatToX(b)} y1={yStep(8)} x2={beatToX(b)} y2={yStep(0)} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      ))}
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
        const flags = ev.base === "8" ? 1 : ev.base === "16" ? 2 : 0;
        return (
          <g key={i} className={cls} onClick={() => onSelect && onSelect(i)} style={{ cursor: "pointer" }}>
            <rect x={beatToX(start)} y="0" width={Math.max(d * STAFF.PPB, 22)} height={STAFF.H} fill="transparent" />
            {ledgers(ev.step).map((s) => (
              <line key={s} x1={x - 13} y1={yStep(s)} x2={x + 13} y2={yStep(s)} stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
            ))}
            {ev.base !== "1" && <line x1={sx} y1={cy + (up ? -2 : 2)} x2={sx} y2={stemEnd} stroke="#fff" strokeWidth="1.7" />}
            {ev.base !== "1" && Array.from({ length: flags }).map((_, fi) => {
              const fy = stemEnd + (up ? fi * 8 : -fi * 8);
              return <path key={fi} d={up ? `M${sx} ${fy} q 11 4 9 16` : `M${sx} ${fy} q 11 -4 9 -16`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />;
            })}
            <ellipse cx={x} cy={cy} rx={active ? 11 : 8.4} ry={active ? 8 : 6.1} transform={`rotate(-22 ${x} ${cy})`} fill={hollow ? "none" : "#fff"} stroke="#fff" strokeWidth={hollow ? 2.1 : 0} />
            {ev.dotted && <circle cx={x + 15} cy={cy - 2} r="2.4" fill="#fff" />}
            {ev.triplet && <text x={x - 4} y={up ? stemEnd - 6 : stemEnd + 14} fontSize="13" fill="var(--gold)" fontWeight="700">3</text>}
            {ev.acc && <text className="acc" x={x - 23} y={cy + 7} fontSize="30">{ev.acc === "#" ? "♯" : "♭"}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ---- covers ----
function CoverMono({ song }) {
  const ch = (song.key_name && song.key_name.trim()) || (song.title && song.title.trim()[0]) || "♪";
  return (
    <div className="cover-mono">
      <div className="glyph">{ch}</div>
      <div className="sub">{song.key_name ? "Tonalidad" : "Estudio"}</div>
    </div>
  );
}

export function Cover({ song }) {
  if (song.cover_image) {
    return <div className="cover-art"><div className="cover-photo" style={{ backgroundImage: `url(${song.cover_image})` }} /><div className="scrim" /></div>;
  }
  // CoverMono: uses key_name/title which are always available in list view
  return <div className="cover-art"><CoverMono song={song} /><div className="scrim" /></div>;
}

// ---- bokeh ----
const BOKEH = (() => {
  const out = []; let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 42; i++) {
    const big = rnd() > 0.84;
    out.push({ x: rnd() * 100, y: rnd() * 100, s: big ? 18 + rnd() * 36 : 1.5 + rnd() * 4, o: big ? 0.05 + rnd() * 0.07 : 0.16 + rnd() * 0.36, hue: 30 + rnd() * 22, dur: 16 + rnd() * 22, delay: -rnd() * 30, drift: (rnd() * 2 - 1) * 16 });
  }
  return out;
})();

export function Bokeh() {
  return (
    <div className="bokeh">
      {BOKEH.map((b, i) => (
        <span key={i} style={{ left: b.x + "%", top: b.y + "%", width: b.s, height: b.s, opacity: b.o, background: `radial-gradient(circle, hsla(${b.hue},85%,68%,1) 0%, hsla(${b.hue},85%,60%,0) 70%)`, animationDuration: b.dur + "s", animationDelay: b.delay + "s", "--drift": b.drift + "px" }} />
      ))}
    </div>
  );
}
