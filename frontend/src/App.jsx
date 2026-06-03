import { useState, useEffect, useCallback } from 'react';
import { Bokeh } from './components/Ui.jsx';
import Home from './components/Home.jsx';
import SongList from './components/SongList.jsx';
import PlayerPicker from './components/PlayerPicker.jsx';
import Editor from './components/Editor.jsx';
import Player from './components/Player.jsx';
import * as MUS from './music.js';
import * as api from './api.js';

// Convert API event (DB format + base/dotted/triplet) → local editor format
function apiToLocal(ev) {
  if (ev.kind === "rest") {
    return { isRest: true, base: ev.base || "4", dotted: ev.dotted || false, triplet: ev.triplet || false };
  }
  const letter = ev.pitch;
  const acc = ev.accidental === "sharp" ? "#" : ev.accidental === "flat" ? "b" : "";
  const octave = ev.octave;
  return {
    isRest: false, letter, acc, octave,
    pitch: letter + acc + octave,
    step: MUS.stepOf(letter, octave),
    base: ev.base || "4", dotted: ev.dotted || false, triplet: ev.triplet || false,
  };
}

// Convert local editor event → API format for PUT
function localToApi(ev, position) {
  return {
    position,
    kind: ev.isRest ? "rest" : "note",
    pitch: ev.isRest ? null : ev.letter,
    accidental: ev.isRest ? null : (ev.acc === "#" ? "sharp" : ev.acc === "b" ? "flat" : null),
    octave: ev.isRest ? null : ev.octave,
    duration_beats: MUS.durBeats(ev),
  };
}

export default function App() {
  const [songs, setSongs] = useState([]);
  const [route, setRoute] = useState({ screen: "home", id: null });
  const [currentSong, setCurrentSong] = useState(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getSongs().then(setSongs).catch(console.error);
  }, []);

  const openSong = useCallback(async (id) => {
    setLoading(true);
    try {
      const song = await api.getSong(id);
      const localEvents = (song.events || []).map(apiToLocal);
      setCurrentSong({ ...song, events: localEvents });
      setRoute({ screen: "editor", id });
    } finally {
      setLoading(false);
    }
  }, []);

  const openPlayer = useCallback(async (id, backTo = "list") => {
    setLoading(true);
    try {
      const song = await api.getSong(id);
      const localEvents = (song.events || []).map(apiToLocal);
      setCurrentSong({ ...song, events: localEvents });
      setRoute({ screen: "player", id, backTo });
    } finally {
      setLoading(false);
    }
  }, []);

  const goHome = useCallback(() => {
    setCurrentSong(null);
    setRoute({ screen: "home", id: null });
  }, []);

  const goList = useCallback(() => {
    setCurrentSong(null);
    setRoute({ screen: "list", id: null });
    api.getSongs().then(setSongs).catch(console.error);
  }, []);

  const goPlayerPicker = useCallback(() => {
    setCurrentSong(null);
    setRoute({ screen: "player-picker", id: null });
    api.getSongs().then(setSongs).catch(console.error);
  }, []);

  const createSong = useCallback(async () => {
    const song = await api.createSong(MUS.blankSong());
    setSongs((prev) => [song, ...prev]);
    await openSong(song.id);
  }, [openSong]);

  const deleteSong = useCallback(async (id) => {
    await api.deleteSong(id);
    setSongs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const patchSong = useCallback((patch) => {
    setCurrentSong((prev) => prev ? { ...prev, ...patch } : prev);
  }, []);

  const saveSong = useCallback(async () => {
    if (!currentSong) return;
    setSaving(true);
    try {
      await api.updateSong(currentSong.id, {
        title: currentSong.title,
        bpm: currentSong.bpm,
        beats_per_bar: currentSong.beats_per_bar,
        stars: currentSong.stars || 1,
        key_name: currentSong.key_name || null,
        cover_image: currentSong.cover_image || null,
        events: (currentSong.events || []).map(localToApi),
      });
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [currentSong]);

  if (loading) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <span style={{ color: "var(--ink-dim)", fontSize: 14 }}>Cargando…</span>
      </div>
    );
  }

  if (route.screen === "home") {
    return <Home onEditor={goList} onPlayer={goPlayerPicker} />;
  }

  if (route.screen === "player-picker") {
    return (
      <div className="app">
        <Bokeh />
        <div className="view">
          <PlayerPicker songs={songs} onPlay={(id) => openPlayer(id, "player-picker")} onBack={goHome} />
        </div>
      </div>
    );
  }

  if (route.screen === "player" && currentSong) {
    const onBack = route.backTo === "player-picker" ? goPlayerPicker : goList;
    return (
      <div className="app player-mode">
        <Player key={currentSong.id} song={currentSong} onBack={onBack} />
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
}
