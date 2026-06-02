import { useState, useEffect, useMemo } from 'react';
import { Icon, Stars, StarShape, Cover } from './Ui.jsx';

const PAGE_SIZE = 8;

function SortToggle({ field, dir, onField, onDir }) {
  return (
    <div className="sort">
      <span className="sort-lbl">Ordenar</span>
      <div className="seg">
        <button className={field === "name" ? "on" : ""} onClick={() => onField("name")}>Nombre</button>
        <button className={field === "stars" ? "on" : ""} onClick={() => onField("stars")}>Dificultad</button>
      </div>
      <button className="dir-btn" onClick={onDir}>
        <Icon.arrows style={{ transform: dir === "asc" ? "none" : "scaleY(-1)" }} />
      </button>
    </div>
  );
}

function StarFilter({ value, onChange }) {
  return (
    <div className="filter-stars">
      <button className={"chip-min" + (value === 0 ? " on" : "")} onClick={() => onChange(0)}>Todas</button>
      <div className="fs-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n === value ? 0 : n)} className={n <= value ? "on" : "off"}>
            <StarShape />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SongList({ songs, onOpen, onCreate, onDelete }) {
  const [query, setQuery] = useState("");
  const [stars, setStars] = useState(0);
  const [field, setField] = useState("name");
  const [dir, setDir] = useState("asc");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [query, stars, field, dir, songs.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = songs.filter((s) => {
      const okQ = !q || (s.title || "Sin título").toLowerCase().includes(q);
      const okS = stars === 0 || s.stars === stars;
      return okQ && okS;
    });
    r = r.slice().sort((a, b) => {
      let cmp;
      if (field === "stars") cmp = (a.stars - b.stars) || (a.title || "").localeCompare(b.title || "", "es");
      else cmp = (a.title || "Sin título").localeCompare(b.title || "Sin título", "es", { sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [songs, query, stars, field, dir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const filtering = query.trim() !== "" || stars !== 0;
  const showNewTile = !filtering && curPage === totalPages;

  return (
    <div className="list-wrap">
      <div className="list-inner">
        <div className="list-head">
          <div>
            <div className="eyebrow">SaxHero · Compositor</div>
            <h1>Tu repertorio</h1>
            <p className="sub">Escribe canciones como una tira de notas y ajusta el ritmo a oído.</p>
          </div>
          <button className="btn-gold" onClick={onCreate}><Icon.plus /> Nueva canción</button>
        </div>

        <div className="list-toolbar">
          <div className="search">
            <Icon.search />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre…" spellCheck={false} />
            {query && <button className="search-x" onClick={() => setQuery("")}><Icon.close /></button>}
          </div>
          <StarFilter value={stars} onChange={setStars} />
          <div className="tb-spacer" />
          <SortToggle field={field} dir={dir} onField={setField} onDir={() => setDir((d) => d === "asc" ? "desc" : "asc")} />
        </div>

        <div className="list-meta">
          {filtered.length === 0 ? "Sin resultados" : `${filtered.length} ${filtered.length === 1 ? "canción" : "canciones"}${filtering ? (filtered.length === 1 ? " filtrada" : " filtradas") : ""}`}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="es-ring"><Icon.search /></div>
            <p>No hay canciones que coincidan.</p>
            <button className="chip-min" onClick={() => { setQuery(""); setStars(0); }}>Limpiar filtros</button>
          </div>
        ) : (
          <div className="grid">
            {pageItems.map((song) => (
              <div key={song.id} className="card" onClick={() => onOpen(song.id)}>
                <div className="cover"><Cover song={song} /></div>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => onOpen(song.id)}><Icon.pencil /></button>
                  <button className="icon-btn danger" onClick={() => onDelete(song.id)}><Icon.trash /></button>
                </div>
                <div className="body">
                  <div className="ttl">{song.title || "Sin título"}</div>
                  <div className="meta">
                    <span className="bpm"><b>{song.bpm}</b><span>BPM</span></span>
                    <Stars value={song.stars} />
                  </div>
                </div>
              </div>
            ))}
            {showNewTile && (
              <div className="card new" onClick={onCreate}>
                <div className="plus"><div className="ring"><Icon.plus /></div>Nueva canción</div>
              </div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pager">
            <button className="pg-btn" disabled={curPage === 1} onClick={() => setPage(curPage - 1)}><Icon.chevL /></button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} className={"pg-num" + (i + 1 === curPage ? " on" : "")} onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
            <button className="pg-btn" disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}><Icon.chevR /></button>
          </div>
        )}
      </div>
    </div>
  );
}
