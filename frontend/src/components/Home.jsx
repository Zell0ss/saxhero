import { Bokeh } from './Ui.jsx';

export default function Home({ onEditor, onPlayer }) {
  return (
    <div className="home">
      <Bokeh />
      <div className="home-inner">
        <div className="home-brand">
          <div className="home-mark">♪</div>
          <h1 className="home-title">SaxHero</h1>
          <p className="home-sub">Tu herramienta de práctica de saxo</p>
        </div>
        <div className="home-cards">
          <button className="home-card" onClick={onEditor}>
            <div className="home-card-icon">🎵</div>
            <div className="home-card-label">Compositor</div>
            <div className="home-card-desc">Transcribir y editar canciones</div>
          </button>
          <button className="home-card home-card-gold" onClick={onPlayer}>
            <div className="home-card-icon">🎷</div>
            <div className="home-card-label">Practicar</div>
            <div className="home-card-desc">Tocar con el sax en la lira</div>
          </button>
        </div>
      </div>
    </div>
  );
}
