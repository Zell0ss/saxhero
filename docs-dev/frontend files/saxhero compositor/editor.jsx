/* global React, MUS, StaffPreview, KeyColumn, Icon, Stars, beatToX, staffWidth */
const { useState: uState, useRef: uRef, useEffect: uEffect, useMemo: uMemo, useCallback: uCb } = React;

/* ============================================================
   editor.jsx — single-song editor
   ============================================================ */

/* cumulative start beats for an events array */
function cumStarts(events) {
  let c = 0;
  return events.map((ev) => { const s = c; c += MUS.durBeats(ev); return s; });
}

function StepperField({ label, value, unit, onDec, onInc }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <button onClick={onDec} aria-label="menos">–</button>
        <div className="val">{value}{unit && <small>{unit}</small>}</div>
        <button onClick={onInc} aria-label="más">+</button>
      </div>
    </div>
  );
}

function Editor({ song, coverStyle, sideOpen, onToggleSide, onPatch, onBack }) {
  const [text, setText] = uState(song.strip);
  const [events, setEvents] = uState(() => MUS.reconcile(song.strip, []));
  const [sel, setSel] = uState(-1);

  const [playing, setPlaying] = uState(false);
  const [playBeat, setPlayBeat] = uState(0);
  const [speed, setSpeed] = uState(0.75);
  const [loop, setLoop] = uState(true);
  const [loopSel, setLoopSel] = uState(false);

  const fileRef = uRef(null);
  const scrollRef = uRef(null);

  // refs for the animation loop
  const beatRef = uRef(0);
  const playingRef = uRef(false);
  const speedRef = uRef(speed);
  const loopRef = uRef(loop);
  const loopSelRef = uRef(loopSel);
  const selRef = uRef(sel);
  const eventsRef = uRef(events);
  const bpmRef = uRef(song.bpm);
  const lastT = uRef(0);

  uEffect(() => { speedRef.current = speed; }, [speed]);
  uEffect(() => { loopRef.current = loop; }, [loop]);
  uEffect(() => { loopSelRef.current = loopSel; }, [loopSel]);
  uEffect(() => { selRef.current = sel; }, [sel]);
  uEffect(() => { eventsRef.current = events; }, [events]);
  uEffect(() => { bpmRef.current = song.bpm; }, [song.bpm]);

  const starts = uMemo(() => cumStarts(events), [events]);
  const total = uMemo(() => MUS.totalBeats(events), [events]);

  // active note index from playBeat
  const activeIdx = uMemo(() => {
    for (let i = 0; i < events.length; i++) {
      if (playBeat >= starts[i] - 1e-6 && playBeat < starts[i] + MUS.durBeats(events[i]) - 1e-6) return i;
    }
    return -1;
  }, [playBeat, events, starts]);

  /* ---- text <-> events sync ---- */
  const onText = (v) => {
    setText(v);
    const ev = MUS.reconcile(v, eventsRef.current);
    setEvents(ev);
    onPatch({ strip: v });
    if (selRef.current >= ev.length) setSel(ev.length - 1);
  };

  const applyEvents = uCb((next) => {
    setEvents(next);
    const s = MUS.serialize(next, song.beatsPerBar);
    setText(s);
    onPatch({ strip: s });
  }, [song.beatsPerBar, onPatch]);

  /* ---- pill edits ---- */
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

  /* ---- playback loop ---- */
  uEffect(() => {
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
          if (loopRef.current || loopSelRef.current) beatRef.current = lo;
          else { beatRef.current = lo; playingRef.current = false; setPlaying(false); }
        }
        if (beatRef.current < lo) beatRef.current = lo;
        setPlayBeat(beatRef.current);
        // autoscroll
        const sc = scrollRef.current;
        if (sc) {
          const x = beatToX(beatRef.current);
          const target = x - sc.clientWidth * 0.45;
          if (Math.abs(sc.scrollLeft - target) > 2) sc.scrollLeft = Math.max(0, target);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = () => {
    if (playingRef.current) { playingRef.current = false; setPlaying(false); return; }
    const evs = eventsRef.current;
    const st = cumStarts(evs);
    let lo = 0;
    if (loopSelRef.current && selRef.current >= 0) lo = st[selRef.current];
    if (beatRef.current >= MUS.totalBeats(evs) - 1e-6) beatRef.current = lo;
    if (loopSelRef.current && selRef.current >= 0) beatRef.current = lo;
    lastT.current = 0; playingRef.current = true; setPlaying(true);
  };

  /* ---- header handlers ---- */
  const onUpload = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onPatch({ cover: r.result });
    r.readAsDataURL(f);
    e.target.value = "";
  };
  const setBeatsPerBar = (d) => {
    const v = Math.max(1, Math.min(7, song.beatsPerBar + d));
    onPatch({ beatsPerBar: v });
  };

  // reference note for side panel: selected, else active
  const refIdx = sel >= 0 ? sel : activeIdx;
  const refNote = refIdx >= 0 ? events[refIdx] : null;
  const refKeys = refNote && !refNote.isRest ? MUS.fingering(refNote) : [];

  const beatInBar = song.beatsPerBar > 0 ? Math.floor(playBeat % song.beatsPerBar) : 0;

  return (
    <div className="editor">
      {/* ---- header ---- */}
      <div className="ed-head">
        <button className="back-btn" onClick={onBack} title="Volver"><Icon.back /></button>
        <div className="ed-title-wrap">
          <span className="kicker">Editor de canción</span>
          <input className="ed-title" value={song.title} placeholder="Título de la canción"
            onChange={(e) => onPatch({ title: e.target.value })} />
        </div>
        <div className="spacer" />

        <div className="field">
          <label>Tonalidad</label>
          <div className="stepper" style={{ padding: "0 4px" }}>
            <input value={song.keyName} placeholder="—" onChange={(e) => onPatch({ keyName: e.target.value })}
              style={{ width: 64, background: "transparent", border: 0, outline: 0, color: "var(--ink)", fontWeight: 700, fontSize: 15, textAlign: "center" }} />
          </div>
        </div>

        <StepperField label="BPM" value={song.bpm} onDec={() => onPatch({ bpm: Math.max(30, song.bpm - 2) })} onInc={() => onPatch({ bpm: Math.min(220, song.bpm + 2) })} />
        <StepperField label="Compás" value={song.beatsPerBar} unit="/4" onDec={() => setBeatsPerBar(-1)} onInc={() => setBeatsPerBar(1)} />

        <div className="field">
          <label>Dificultad</label>
          <div className="stars-edit">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => onPatch({ stars: n === song.stars ? n - 1 : n })} aria-label={"dificultad " + n}>
                <svg viewBox="0 0 24 24" className={n <= song.stars ? "on" : "off"}><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" fill="currentColor" /></svg>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Portada</label>
          <button className="upload-btn" onClick={() => (song.cover ? onPatch({ cover: null }) : fileRef.current.click())}>
            <Icon.upload /> {song.cover ? "Quitar" : "Subir"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
        </div>
      </div>

      {/* ---- body ---- */}
      <div className="ed-body">
        <div className="ed-main">
          {/* note input */}
          <div className="input-block">
            <div className="lbl-row">
              <span className="lbl">Tira de notas</span>
              <span className="hint">
                <code>C</code> base · <code>c</code> octava arriba · <code>A,</code> abajo · <code>F#</code>/<code>Bb</code> alteración · <code>-</code> silencio · <code>|</code> compás
              </span>
            </div>
            <textarea className="strip-input" value={text} onChange={(e) => onText(e.target.value)}
              spellCheck={false} placeholder="Ej.  C E G c | A, F# -" rows={2} />
          </div>

          {/* live staff */}
          <div className="staff-block">
            <div className="staff-frame">
              <div className="staff-scroll" ref={scrollRef}>
                <div style={{ position: "relative", width: staffWidth(events), height: "100%", minHeight: 210 }}>
                  <StaffPreview events={events} beatsPerBar={song.beatsPerBar} selectedIdx={sel} activeIdx={activeIdx} onSelect={setSel} />
                  {events.length > 0 && (
                    <div className="staff-playhead" style={{ left: beatToX(playBeat) }} />
                  )}
                </div>
              </div>
              {events.length === 0 && (<div className="staff-empty">Teclea una tira de notas arriba para ver el pentagrama</div>)}
            </div>
          </div>

          {/* pill timeline */}
          <div className="timeline">
            <div className="tl-head">
              <span className="lbl">Línea de tiempo</span>
              <span className="count">{events.length} evento{events.length === 1 ? "" : "s"} · {(+total.toFixed(2))} tiempos</span>
            </div>
            <div className="pills">
              {events.map((ev, i) => {
                const cls = "pill" + (i === sel ? " sel" : "") + (i === activeIdx ? " active" : "") + (ev.isRest ? " rest" : "");
                return (
                  <button key={i} className={cls} onClick={() => setSel(i === sel ? -1 : i)}>
                    {ev.dotted && <span className="badge">·</span>}
                    {ev.triplet && <span className="badge" style={{ right: ev.dotted ? 12 : -6 }}>3</span>}
                    {ev.isRest
                      ? <span className="pname" style={{ color: "var(--ink-faint)", fontFamily: "var(--music)", fontSize: 22 }}>{MUS.restGlyph(ev)}</span>
                      : <span className="pname">{ev.letter}{ev.acc && <sup>{ev.acc === "#" ? "♯" : "♭"}</sup>}</span>}
                    <span className="pglyph">{MUS.durGlyph(ev)}</span>
                    <span className="pdur">{ev.isRest ? "silencio" : MUS.LADDER[MUS.LADDER_INDEX[ev.base ?? "4"]].name.slice(0, 7)}</span>
                  </button>
                );
              })}
              {events.length === 0 && <div style={{ color: "var(--ink-faint)", fontSize: 13, padding: "22px 4px" }}>Sin eventos todavía.</div>}
            </div>

            {/* duration toolbar */}
            <div className="dur-bar">
              {cur ? (
                <>
                  <div className="sel-name">{cur.isRest ? "Silencio" : <>{cur.letter}{cur.acc}{" "}<span>{cur.octave >= MUS.BASE_OCT_LOWER ? "↑" : cur.octave < MUS.BASE_OCT_UPPER ? "↓" : ""}</span></>}</div>
                  <div className="sep" />
                  <div className="dur-step">
                    <button onClick={() => setBase(-1)} disabled={baseIdx <= 0} title="Más corta">–</button>
                    <div className="dval"><span className="g">{MUS.durGlyph(cur)}</span><span className="t">{MUS.LADDER[baseIdx].name}</span></div>
                    <button onClick={() => setBase(1)} disabled={baseIdx >= MUS.LADDER.length - 1} title="Más larga">+</button>
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

          {/* playback bar */}
          <div className="playbar">
            <button className={"play-btn" + (playing ? " on" : "")} onClick={togglePlay} aria-label="reproducir">
              {playing ? <Icon.pause /> : <Icon.play />}
            </button>
            <div className="beatdots">
              {Array.from({ length: song.beatsPerBar }).map((_, i) => (
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
            <button className={"loop-btn" + (loopSel ? " on" : "")} onClick={() => setLoopSel((v) => !v)} title="Bucle de la selección">
              <Icon.loop /> Bucle sel.
            </button>
            <button className={"loop-btn" + (loop ? " on" : "")} onClick={() => setLoop((v) => !v)}>
              <Icon.loop /> Loop
            </button>
            <button className={"loop-btn" + (sideOpen ? " on" : "")} onClick={onToggleSide} title="Panel de digitación">
              <Icon.panel />
            </button>
          </div>
        </div>

        {/* ---- side panel ---- */}
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
            <div className="fing-card"><div className="fing-empty">{refNote ? "Silencio — sin digitación." : "Selecciona o reproduce una nota para ver su digitación."}</div></div>
          )}

          <div>
            <div className="side-sect-lbl" style={{ marginBottom: 9 }}>Referencia</div>
            <p className="side-info">
              Cada nota entra como <b>negra</b>. Selecciona una pill y usa <b>+/–</b> para cambiar la figura, o activa <b>puntillo</b> / <b>tresillo</b>. El bucle de selección repite solo la nota elegida para afinarla a oído.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { Editor });
