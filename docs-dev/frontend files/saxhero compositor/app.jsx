/* global React, ReactDOM, MUS, SongList, Editor, Bokeh,
   useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSlider, TweakToggle, Icon */
const { useState: aState, useEffect: aEffect, useCallback: aCb } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "coverStyle": "keys",
  "accent": "#e9c46a",
  "glow": 1,
  "bokeh": true
}/*EDITMODE-END*/;

const LS_KEY = "saxhero-compositor-v1";

function loadSongs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; }
  } catch (e) { /* ignore */ }
  // seed from demos (deep copy)
  return MUS.DEMOS.map((d) => ({ ...d }));
}

function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [songs, setSongs] = aState(loadSongs);
  const [route, setRoute] = aState({ screen: "list", id: null });
  const [sideOpen, setSideOpen] = aState(true);

  // persist
  aEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(songs)); } catch (e) { /* ignore */ }
  }, [songs]);

  // persist route so refresh keeps your place
  aEffect(() => {
    try { localStorage.setItem(LS_KEY + ":route", JSON.stringify(route)); } catch (e) { /* ignore */ }
  }, [route]);
  aEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(LS_KEY + ":route") || "null");
      if (r && r.screen === "editor" && r.id) setRoute(r);
    } catch (e) { /* ignore */ }
  }, []);

  const openSong = aCb((id) => setRoute({ screen: "editor", id }), []);
  const goList = aCb(() => setRoute({ screen: "list", id: null }), []);

  const createSong = aCb(() => {
    const s = MUS.blankSong();
    setSongs((prev) => [s, ...prev]);
    setRoute({ screen: "editor", id: s.id });
  }, []);

  const deleteSong = aCb((id) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const patchSong = aCb((id, patch) => {
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const current = songs.find((s) => s.id === route.id);

  // apply accent / glow to brand vars
  const shellStyle = { "--gold": tw.accent, "--glow": tw.glow };

  return (
    <div className="app" style={shellStyle}>
      {tw.bokeh && <Bokeh />}

      <div className="titlebar">
        <div className="dots"><i /><i /><i /></div>
        <div className="brand">
          <span className="mark">{"\u266A"}</span>
          <b>SaxHero</b> Compositor
        </div>
        <div className="spacer" />
        <div className="crumbs">
          {route.screen === "editor" && current ? (current.title || "Sin título") : `${songs.length} canciones`}
        </div>
      </div>

      <div className="view">
        {route.screen === "editor" && current ? (
          <Editor
            key={current.id}
            song={current}
            coverStyle={tw.coverStyle}
            sideOpen={sideOpen}
            onToggleSide={() => setSideOpen((v) => !v)}
            onPatch={(patch) => patchSong(current.id, patch)}
            onBack={goList}
          />
        ) : (
          <SongList
            songs={songs}
            coverStyle={tw.coverStyle}
            onOpen={openSong}
            onCreate={createSong}
            onDelete={deleteSong}
          />
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Portada por defecto" />
        <TweakRadio label="Estilo" value={tw.coverStyle}
          options={[
            { value: "keys", label: "Llaves" },
            { value: "snapshot", label: "Notas" },
            { value: "mono", label: "Mono" },
          ]}
          onChange={(v) => setTweak("coverStyle", v)} />
        <TweakRadio label="Más" value={tw.coverStyle}
          options={[
            { value: "wave", label: "Onda" },
            { value: "photo", label: "Foto" },
          ]}
          onChange={(v) => setTweak("coverStyle", v)} />
        <TweakSection label="Estética" />
        <TweakColor label="Acento" value={tw.accent}
          options={["#e9c46a", "#d2a13f", "#e8a13c", "#f0d089"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSlider label="Glow" value={tw.glow} min={0} max={2} step={0.1} onChange={(v) => setTweak("glow", v)} />
        <TweakToggle label="Bokeh de fondo" value={tw.bokeh} onChange={(v) => setTweak("bokeh", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
