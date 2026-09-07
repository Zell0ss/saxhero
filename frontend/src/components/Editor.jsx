import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, Fragment } from 'react';
import { Icon, KeyColumn, StaffPreview, beatToX, staffWidth } from './Ui.jsx';
import * as MUS from '../music.js';
import * as Audio from '../audio.js';
import { LINE_SIZE, TEXT_LINE_HEIGHT_PX, lineOf, caretTokenCount, offsetForTokenCount } from '../lineWrap.js';

function findActiveIdx(beat, events, starts) {
  for (let i = 0; i < events.length; i++) {
    if (beat >= starts[i] - 1e-6 && beat < starts[i] + MUS.durBeats(events[i]) - 1e-6) return i;
  }
  return -1;
}

function cumStarts(events) {
  let c = 0;
  return events.map((ev) => { const s = c; c += MUS.durBeats(ev); return s; });
}

function StepperField({ label, value, unit, onDec, onInc }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <button onClick={onDec}>–</button>
        <div className="val">{value}{unit && <small>{unit}</small>}</div>
        <button onClick={onInc}>+</button>
      </div>
    </div>
  );
}

export default function Editor({ song, sideOpen, onToggleSide, onPatch, onSave, saving, onBack }) {
  const [text, setText] = useState(() => MUS.serialize(song.events || [], song.beats_per_bar, LINE_SIZE));
  const [events, setEvents] = useState(() => (song.events || []).map((ev) => ({ ...ev })));
  const [sel, setSel] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [playBeat, setPlayBeat] = useState(0);
  const [speed, setSpeed] = useState(0.75);
  const [loop, setLoop] = useState(true);
  const [loopSel, setLoopSel] = useState(false);
  const [countdownBeat, setCountdownBeat] = useState(null);
  const [skipCountdown, setSkipCountdown] = useState(false);
  const [metro, setMetro] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [visibleLine, setVisibleLine] = useState(0);

  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const pendingCaretRef = useRef(null);
  const scrollRef = useRef(null);
  const staffRowRefs = useRef([]);
  const beatRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const loopSelRef = useRef(loopSel);
  const selRef = useRef(sel);
  const eventsRef = useRef(events);
  const textRef = useRef(text);
  const undoStackRef = useRef([]);
  const bpmRef = useRef(song.bpm);
  const lastT = useRef(0);
  const prevActiveIdxRef = useRef(-1);
  const prevLineRef = useRef(-1);
  const countdownCancelRef = useRef(false);
  const metroRef = useRef(false);
  const prevBeatFloorRef = useRef(-1);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { loopSelRef.current = loopSel; }, [loopSel]);
  useEffect(() => { selRef.current = sel; }, [sel]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => { bpmRef.current = song.bpm; }, [song.bpm]);
  useEffect(() => { metroRef.current = metro; }, [metro]);

  const wasSavingRef = useRef(saving);
  useEffect(() => {
    if (wasSavingRef.current && !saving) {
      undoStackRef.current = [];
      setCanUndo(false);
    }
    wasSavingRef.current = saving;
  }, [saving]);

  const startPlayback = () => {
    const evs = eventsRef.current;
    const st = cumStarts(evs);
    const tot = MUS.totalBeats(evs);
    if (loopSelRef.current && selRef.current >= 0) {
      beatRef.current = st[selRef.current];
    } else if (beatRef.current >= tot - 1e-6) {
      beatRef.current = 0;
    }
    prevActiveIdxRef.current = -1;
    prevBeatFloorRef.current = -1;
    prevLineRef.current = -1;
    lastT.current = 0;
    playingRef.current = true;
    setPlaying(true);
    setCountdownBeat(null);
  };

  const stopCountdown = () => {
    countdownCancelRef.current = true;
    setCountdownBeat(null);
  };

  const doCountdown = async () => {
    countdownCancelRef.current = false;
    await Audio.start();
    for (let i = 1; i <= 4; i++) {
      if (countdownCancelRef.current) return;
      const intervalMs = (60 / (bpmRef.current * speedRef.current)) * 1000;
      setCountdownBeat(i);
      Audio.playClick();
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    if (!countdownCancelRef.current) startPlayback();
  };

  const starts = useMemo(() => cumStarts(events), [events]);
  const total = useMemo(() => MUS.totalBeats(events), [events]);

  const selectAndSeek = (i) => {
    const newSel = i === sel ? -1 : i;
    setSel(newSel);
    if (!playingRef.current && countdownBeat === null) {
      const pos = newSel >= 0 ? starts[newSel] : 0;
      beatRef.current = pos;
      setPlayBeat(pos);
    }
  };

  const barStarts = useMemo(() => {
    const set = new Set();
    let acc = 0;
    events.forEach((ev, i) => {
      acc += MUS.durBeats(ev);
      if (song.beats_per_bar > 0 && acc >= song.beats_per_bar - 1e-6) {
        acc = 0;
        set.add(i + 1);
      }
    });
    return set;
  }, [events, song.beats_per_bar]);

  const playheadIdx = useMemo(
    () => findActiveIdx(playBeat, events, starts),
    [playBeat, events, starts]
  );
  const activeIdx = playing ? playheadIdx : -1;

  useEffect(() => {
    if (playing) { setVisibleLine(lineOf(activeIdx)); return; }
    if (sel >= 0) setVisibleLine(lineOf(sel));
  }, [playing, activeIdx, sel]);

  const totalLines = Math.max(1, Math.ceil(events.length / LINE_SIZE));
  const lineChunks = useMemo(() => {
    const out = [];
    for (let L = 0; L < totalLines; L++) out.push(events.slice(L * LINE_SIZE, L * LINE_SIZE + LINE_SIZE));
    return out;
  }, [events, totalLines]);
  const playheadLine = playheadIdx >= 0 ? lineOf(playheadIdx) : (playBeat <= 0 ? 0 : totalLines - 1);
  const playheadLocalBeat = playBeat - (starts[playheadLine * LINE_SIZE] || 0);

  const pushUndo = () => {
    undoStackRef.current.push({ text: textRef.current, events: eventsRef.current });
    setCanUndo(true);
  };

  const undo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    setCanUndo(undoStackRef.current.length > 0);
    setText(prev.text);
    setEvents(prev.events);
    onPatch({ strip: prev.text, events: prev.events });
    if (selRef.current >= prev.events.length) setSel(prev.events.length - 1);
  };

  const onText = (v, caretPos) => {
    pushUndo();
    const ev = MUS.reconcile(v, eventsRef.current);
    const droppedContent = ev.length < eventsRef.current.length;
    const pendingSeparator = caretPos > 0 && /\s/.test(v[caretPos - 1]);
    if (droppedContent || pendingSeparator) {
      // Two cases where reserializing right now would do more harm than good:
      //   - pendingSeparator: serialize() never emits trailing whitespace, so
      //     collapsing a bare separator the user just typed would fuse the
      //     next keystroke's character onto the previous token (see D7).
      //   - droppedContent: the raw text currently contains something
      //     ambiguous/invalid (e.g. two notes typed with no separator between
      //     them, fusing into an unparseable token) that parseStrip silently
      //     dropped, taking a previously-valid note down with it. Canonicalizing
      //     now would erase the evidence from the screen too; showing the raw
      //     text instead lets the user see the problem and fix it, matching
      //     the non-destructive behavior this editor had before Task 3 (see D7).
      // Pass the raw value through unprocessed either way and canonicalize on
      // a later keystroke once the ambiguity resolves and content is only
      // ever added, never silently lost.
      pendingCaretRef.current = null;
      setText(v);
      setEvents(ev);
      onPatch({ strip: v, events: ev });
      if (selRef.current >= ev.length) setSel(ev.length - 1);
      return;
    }
    const wrapped = MUS.serialize(ev, song.beats_per_bar, LINE_SIZE);
    pendingCaretRef.current = offsetForTokenCount(wrapped, caretTokenCount(v, caretPos));
    setText(wrapped);
    setEvents(ev);
    onPatch({ strip: wrapped, events: ev });
    if (selRef.current >= ev.length) setSel(ev.length - 1);
  };

  useLayoutEffect(() => {
    if (pendingCaretRef.current == null) return;
    const pos = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const el = textareaRef.current;
    if (el) el.setSelectionRange(pos, pos);
  }, [text]);

  const applyEvents = useCallback((next) => {
    pushUndo();
    setEvents(next);
    const s = MUS.serialize(next, song.beats_per_bar, LINE_SIZE);
    setText(s);
    onPatch({ strip: s, events: next });
  }, [song.beats_per_bar, onPatch]);

  const cur = sel >= 0 ? events[sel] : null;
  const baseIdx = cur ? MUS.LADDER_INDEX[cur.base ?? "4"] : 2;

  const setBase = (dir) => {
    if (sel < 0) return;
    const ni = Math.max(0, Math.min(MUS.LADDER.length - 1, baseIdx + dir));
    const next = events.slice();
    next[sel] = { ...next[sel], base: MUS.LADDER[ni].key };
    applyEvents(next);
  };
  const toggleDotted = () => { if (sel < 0) return; const n = events.slice(); n[sel] = { ...n[sel], dotted: !n[sel].dotted }; applyEvents(n); };
  const toggleTriplet = () => { if (sel < 0) return; const n = events.slice(); n[sel] = { ...n[sel], triplet: !n[sel].triplet }; applyEvents(n); };
  const insertRest = () => {
    const at = sel >= 0 ? sel + 1 : events.length;
    const carry = cur ? { base: cur.base, dotted: false, triplet: false } : { base: "4", dotted: false, triplet: false };
    const n = events.slice(); n.splice(at, 0, { isRest: true, ...carry });
    applyEvents(n); setSel(at);
  };
  const delEvent = () => {
    if (sel < 0) return;
    const n = events.slice(); n.splice(sel, 1);
    applyEvents(n); setSel(Math.min(sel, n.length - 1));
  };

  useEffect(() => {
    let raf;
    const frame = (t) => {
      if (!lastT.current) lastT.current = t;
      const dt = Math.min((t - lastT.current) / 1000, 0.05);
      lastT.current = t;
      if (playingRef.current) {
        const evs = eventsRef.current;
        const st = cumStarts(evs);
        const tot = MUS.totalBeats(evs);
        let lo = 0, hi = tot;
        const si = selRef.current;
        if (loopSelRef.current && si >= 0 && si < evs.length) {
          lo = st[si]; hi = st[si] + MUS.durBeats(evs[si]);
        }
        const bps = (bpmRef.current / 60) * speedRef.current;
        beatRef.current += dt * bps;
        if (beatRef.current >= hi - 1e-6) {
          if (loopRef.current || loopSelRef.current) {
            beatRef.current = lo;
            prevActiveIdxRef.current = -1;
          } else {
            beatRef.current = lo;
            playingRef.current = false;
            setPlaying(false);
          }
        }
        if (beatRef.current < lo) beatRef.current = lo;
        const floor = Math.floor(beatRef.current);
        if (floor !== prevBeatFloorRef.current) {
          prevBeatFloorRef.current = floor;
          if (metroRef.current && playingRef.current) Audio.playClick();
        }
        const newIdx = findActiveIdx(beatRef.current, evs, st);
        if (newIdx !== prevActiveIdxRef.current) {
          prevActiveIdxRef.current = newIdx;
          if (newIdx >= 0 && !evs[newIdx].isRest && playingRef.current) {
            const durSec = MUS.durBeats(evs[newIdx]) * 60 / (bpmRef.current * speedRef.current);
            Audio.playNote(evs[newIdx], durSec);
          }
        }
        setPlayBeat(beatRef.current);

        const newLine = newIdx >= 0 ? lineOf(newIdx) : prevLineRef.current;
        if (newLine !== prevLineRef.current && newLine >= 0) {
          prevLineRef.current = newLine;
          const ta = textareaRef.current;
          if (ta) ta.scrollTop = TEXT_LINE_HEIGHT_PX * newLine;
          const rowEl = staffRowRefs.current[newLine];
          const scEl = scrollRef.current;
          if (rowEl && scEl) scEl.scrollTop = rowEl.offsetTop - scEl.offsetTop;
        }
        const activeLine = newLine >= 0 ? newLine : 0;
        const sc = scrollRef.current;
        if (sc) {
          const lineStartBeat = st[activeLine * LINE_SIZE] || 0;
          const localX = beatToX(beatRef.current - lineStartBeat);
          const target = localX - sc.clientWidth * 0.45;
          if (Math.abs(sc.scrollLeft - target) > 2) sc.scrollLeft = Math.max(0, target);
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
      return;
    }
    if (countdownBeat !== null) {
      stopCountdown();
      return;
    }
    if (skipCountdown) {
      Audio.start().then(startPlayback);
      return;
    }
    doCountdown();
  };

  const onUpload = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onPatch({ cover_image: r.result });
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const refIdx = sel >= 0 ? sel : activeIdx;
  const refNote = refIdx >= 0 ? events[refIdx] : null;
  const refKeys = refNote && !refNote.isRest ? MUS.fingering(refNote) : [];
  const beatInBar = song.beats_per_bar > 0 ? Math.floor(playBeat % song.beats_per_bar) : 0;
  const clampedLine = Math.min(visibleLine, totalLines - 1);

  return (
    <div className="editor">
      <div className="ed-head">
        <button className="back-btn" onClick={onBack}><Icon.back /></button>
        <div className="ed-title-wrap">
          <span className="kicker">Editor de canción</span>
          <input className="ed-title" value={song.title} placeholder="Título"
            onChange={(e) => onPatch({ title: e.target.value })} />
        </div>
        <div className="spacer" />

        <div className="field">
          <label>Tonalidad</label>
          <div className="stepper" style={{ padding: "0 4px" }}>
            <input value={song.key_name || ""} placeholder="—" onChange={(e) => onPatch({ key_name: e.target.value })}
              style={{ width: 64, background: "transparent", border: 0, outline: 0, color: "var(--ink)", fontWeight: 700, fontSize: 15, textAlign: "center" }} />
          </div>
        </div>

        <StepperField label="BPM" value={song.bpm}
          onDec={() => onPatch({ bpm: Math.max(30, song.bpm - 2) })}
          onInc={() => onPatch({ bpm: Math.min(220, song.bpm + 2) })} />
        <StepperField label="Compás" value={song.beats_per_bar} unit="/4"
          onDec={() => onPatch({ beats_per_bar: Math.max(1, Math.min(7, song.beats_per_bar - 1)) })}
          onInc={() => onPatch({ beats_per_bar: Math.max(1, Math.min(7, song.beats_per_bar + 1)) })} />

        <div className="field">
          <label>Dificultad</label>
          <div className="stars-edit">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => onPatch({ stars: n === song.stars ? n - 1 : n })}>
                <svg viewBox="0 0 24 24" className={n <= song.stars ? "on" : "off"}><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" fill="currentColor" /></svg>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Portada</label>
          <button className="upload-btn" onClick={() => (song.cover_image ? onPatch({ cover_image: null }) : fileRef.current.click())}>
            <Icon.upload /> {song.cover_image ? "Quitar" : "Subir"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
        </div>

        <button className="loop-btn" onClick={undo} disabled={!canUndo} style={{ marginLeft: 8 }} title="Deshacer último cambio">
          <Icon.undo /> Deshacer
        </button>

        <button className={"btn-gold" + (saving ? " on" : "")} onClick={onSave} disabled={saving} style={{ marginLeft: 8 }}>
          <Icon.save /> {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      <div className="ed-body">
        <div className="ed-main">
          <div className="input-block">
            <div className="lbl-row">
              <span className="lbl">Tira de notas</span>
              <span className="hint">
                <code>C</code> base · <code>c</code> octava arriba · <code>A,</code> abajo · <code>F#</code>/<code>Bb</code> · <code>-</code> silencio · <code>|</code> compás
              </span>
            </div>
            <textarea ref={textareaRef} className="strip-input" value={text}
              onChange={(e) => onText(e.target.value, e.target.selectionStart)}
              spellCheck={false} placeholder="Ej.  C E G c | A, F# -" />
          </div>

          <div className="staff-block">
            <div className="staff-frame">
              {countdownBeat !== null && (
                <div className="countdown-overlay" key={countdownBeat}>
                  <span className="countdown-num">{countdownBeat}</span>
                </div>
              )}
              <div className="staff-scroll" ref={scrollRef}>
                {lineChunks.map((chunk, L) => {
                  const lineStart = L * LINE_SIZE;
                  return (
                    <div key={L} className="staff-row" ref={(el) => { staffRowRefs.current[L] = el; }}
                      style={{ position: "relative", width: staffWidth(chunk), minHeight: 210 }}>
                      <StaffPreview events={chunk} beatsPerBar={song.beats_per_bar}
                        selectedIdx={sel - lineStart} activeIdx={activeIdx - lineStart}
                        onSelect={(i) => selectAndSeek(lineStart + i)}
                        startBeat={starts[lineStart] || 0} isLastLine={L === totalLines - 1} />
                      {chunk.length > 0 && L === playheadLine && (
                        <div className="staff-playhead" style={{ left: beatToX(playheadLocalBeat) }} />
                      )}
                    </div>
                  );
                })}
              </div>
              {events.length === 0 && <div className="staff-empty">Teclea una tira de notas arriba para ver el pentagrama</div>}
            </div>
          </div>

          <div className="timeline">
            <div className="tl-head">
              <span className="lbl">Línea de tiempo</span>
              <span className="count">Línea {clampedLine + 1}/{totalLines} · {events.length} evento{events.length === 1 ? "" : "s"} · {(+total.toFixed(2))} tiempos</span>
            </div>
            <div className="pills">
              {events.slice(clampedLine * LINE_SIZE, clampedLine * LINE_SIZE + LINE_SIZE).map((ev, i) => {
                const globalIdx = clampedLine * LINE_SIZE + i;
                const cls = "pill" + (globalIdx === sel ? " sel" : "") + (globalIdx === activeIdx ? " active" : "") + (ev.isRest ? " rest" : "");
                return (
                  <Fragment key={globalIdx}>
                    {i > 0 && barStarts.has(globalIdx) && <div className="tl-bar-sep" />}
                    <button className={cls} onClick={() => selectAndSeek(globalIdx)}>
                      {ev.dotted && <span className="badge">·</span>}
                      {ev.triplet && <span className="badge" style={{ right: ev.dotted ? 12 : -6 }}>3</span>}
                      {ev.isRest
                        ? <span className="pname" style={{ color: "var(--ink-faint)", fontFamily: "var(--music)", fontSize: 22 }}>{MUS.restGlyph(ev)}</span>
                        : <span className="pname">{ev.letter}{ev.acc && <sup>{ev.acc === "#" ? "♯" : "♭"}</sup>}</span>}
                      <span className="pglyph">{MUS.durGlyph(ev)}</span>
                      <span className="pdur">{ev.isRest ? "silencio" : MUS.LADDER[MUS.LADDER_INDEX[ev.base ?? "4"]].name.slice(0, 7)}</span>
                    </button>
                  </Fragment>
                );
              })}
              {events.length === 0 && <div style={{ color: "var(--ink-faint)", fontSize: 13, padding: "22px 4px" }}>Sin eventos todavía.</div>}
            </div>

            <div className="dur-bar">
              {cur ? (
                <>
                  <div className="sel-name">{cur.isRest ? "Silencio" : <>{cur.letter}{cur.acc}</>}</div>
                  <div className="sep" />
                  <div className="dur-step">
                    <button onClick={() => setBase(-1)} disabled={baseIdx <= 0}>–</button>
                    <div className="dval"><span className="g">{MUS.durGlyph(cur)}</span><span className="t">{MUS.LADDER[baseIdx].name}</span></div>
                    <button onClick={() => setBase(1)} disabled={baseIdx >= MUS.LADDER.length - 1}>+</button>
                  </div>
                  <button className={"chip-toggle" + (cur.dotted ? " on" : "")} onClick={toggleDotted}><span className="dot" /> Puntillo</button>
                  <button className={"chip-toggle" + (cur.triplet ? " on" : "")} onClick={toggleTriplet}>3 Tresillo</button>
                  <div className="sep" />
                  <button className="chip-toggle" onClick={insertRest}><Icon.plus style={{ width: 14, height: 14 }} /> Silencio</button>
                  <button className="chip-toggle danger" onClick={delEvent}><Icon.trash style={{ width: 15, height: 15 }} /> Borrar</button>
                </>
              ) : (
                <div style={{ color: "var(--ink-faint)", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                  Selecciona un evento para ajustar su duración, o
                  <button className="chip-toggle" onClick={insertRest}><Icon.plus style={{ width: 14, height: 14 }} /> Insertar silencio</button>
                </div>
              )}
            </div>
          </div>

          <div className="playbar">
            <button className={"play-btn" + ((playing || countdownBeat !== null) ? " on" : "")} onClick={togglePlay}>
              {(playing || countdownBeat !== null) ? <Icon.pause /> : <Icon.play />}
            </button>
            <div className="beatdots">
              {Array.from({ length: song.beats_per_bar }).map((_, i) => (
                <i key={i} className={playing && i === beatInBar ? "on" : ""} />
              ))}
            </div>
            <div className="speed">
              <span className="cap">Velocidad</span>
              <input type="range" className="brass" min="0.4" max="1" step="0.05" value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ "--pct": ((speed - 0.4) / 0.6) * 100 + "%" }} />
              <span className="val">{speed.toFixed(2)}×</span>
            </div>
            <div className="spacer" />
            <button className={"loop-btn" + (loopSel ? " on" : "")} onClick={() => setLoopSel((v) => !v)}>
              <Icon.loop /> Bucle sel.
            </button>
            <button className={"loop-btn" + (loop ? " on" : "")} onClick={() => setLoop((v) => !v)}>
              <Icon.loop /> Loop
            </button>
            <button className={"loop-btn" + (metro ? " on" : "")} onClick={() => setMetro((v) => !v)} title="Metrónomo">
              ♩ Metro
            </button>
            <button className={"loop-btn" + (skipCountdown ? " on" : "")} onClick={() => setSkipCountdown((v) => !v)} title="Omitir cuenta atrás">
              1-2-3-4
            </button>
            <button className={"loop-btn" + (sideOpen ? " on" : "")} onClick={onToggleSide}>
              <Icon.panel />
            </button>
          </div>
        </div>

        <aside className={"ed-side" + (sideOpen ? "" : " hidden")}>
          <div className="side-sect-lbl">Digitación · Saxo alto</div>
          {refNote && !refNote.isRest ? (
            <div className="fing-card">
              <div className="fing-head">
                <div className="note">{refNote.letter}{refNote.acc && <sup>{refNote.acc === "#" ? "♯" : "♭"}</sup>}</div>
                <div className="reg">{MUS.registerName(refNote)}</div>
              </div>
              <div style={{ display: "grid", placeItems: "center", padding: "4px 0 10px" }}>
                <KeyColumn keys={refKeys} width={120} />
              </div>
              <div className="legend">
                <div className="lrow octave"><i /> Llave de octava</div>
                <div className="lrow left"><i /> Mano izquierda</div>
                <div className="lrow right"><i /> Mano derecha</div>
              </div>
            </div>
          ) : (
            <div className="fing-card"><div className="fing-empty">{refNote ? "Silencio — sin digitación." : "Selecciona o reproduce una nota."}</div></div>
          )}
          <div>
            <div className="side-sect-lbl" style={{ marginBottom: 9 }}>Referencia</div>
            <p className="side-info">Cada nota entra como <b>negra</b>. Selecciona una pill y usa <b>+/–</b> para cambiar la figura. El bucle de selección repite la nota para afinarla a oído.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
