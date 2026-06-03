import { Icon } from './Ui.jsx';

export default function PlayerPicker({ songs, onPlay, onBack }) {
  return (
    <div className="picker-wrap">
      <div className="picker-head">
        <button className="player-back" onClick={onBack}><Icon.back /></button>
        <span className="picker-title">Practicar</span>
        <span className="picker-count">{songs.length} canciones</span>
      </div>
      <div className="picker-list">
        {songs.map((song) => (
          <button key={song.id} className="picker-card" onClick={() => onPlay(song.id)}>
            <span className="picker-name">{song.title || 'Sin título'}</span>
            <span className="picker-bpm"><b>{song.bpm}</b> BPM</span>
          </button>
        ))}
        {songs.length === 0 && (
          <div className="picker-empty">
            No hay canciones aún.<br />Crea una en el Compositor primero.
          </div>
        )}
      </div>
    </div>
  );
}
