# SaxHero Fase 3 — Player "Sax Hero"

> Spec aprobado: 2026-06-03

---

## Objetivo

Construir el Player de práctica: un scroller tipo Guitar Hero donde las notas avanzan derecha→izquierda y el músico toca el saxo mirando la pantalla. Mobile-first, landscape.

---

## Fuentes de autoridad

| Fuente | Manda en |
|---|---|
| `docs-dev/1-design.md` | Arquitectura, modelo de datos, fases, decisiones |
| `docs-dev/2-frontend.md` | UI/visual, motor, controles |
| `docs-dev/frontend files/saxhero player/` | Prototipo de referencia (app.jsx + screenshots) |

---

## Decisiones cerradas

### Clock: RAF (no Tone.js Transport)
El editor usa RAF con éxito. El prototipo del zip también usa RAF. El synth habitualmente estará off durante la práctica (usuario toca el sax real), así que la precisión del Transport no aporta valor en Fase 3. Se documenta aquí para trazabilidad.

### Countdown: beats negativos
En vez de setTimeout chain (como en el editor), el countdown usa beats negativos en el RAF loop: `beatRef = -4` al arrancar. Mientras `beat < 0`, se muestran los números 1-2-3-4. Cuando `beat >= 0` empieza el contenido musical. Las notas "vuelan desde la derecha" durante la cuenta. Más elegante y consistente con el motor visual.

### Stage scaling
El stage tiene un tamaño lógico fijo (1060×600 px). Se escala uniformemente al viewport con `transform: scale(min(vw/1060, vh/600) * 0.98)`. Sin layout responsive — las notas necesitan posición precisa y no se benefician de reflow.

### Audio opcional
Un toggle `audioEnabled` en los controles. Cuando off: silencio total (sin notas, sin clicks de countdown). Cuando on: AMSynth suena las notas, MembraneSynth los clicks. Por defecto: off (el usuario está tocando el sax).

### Phase 3 sin columna izquierda
La columna del diagrama de saxo (KeyColumn) es Fase 4. En Phase 3 el stage completo es para las dos bandas y los controles.

### Loop: canción completa
Loop toggle (toda la canción, igual que el editor). Loop A-B aplazado a un polish pass.

---

## Arquitectura

### Ficheros nuevos/modificados

| Fichero | Acción | Rol |
|---|---|---|
| `frontend/src/components/Player.jsx` | **Nuevo** | Componente completo del player |
| `frontend/src/studio.css` | Modificar | Estilos del player (mismos tokens CSS) |
| `frontend/src/App.jsx` | Modificar | Añadir ruta `"player"` + estado `currentSong` compartido |
| `frontend/src/components/SongList.jsx` | Modificar | Botón "Practicar" en cada tarjeta de canción |

---

## Geometría (constantes del Player)

```js
const C = {
  STAGE_W:    1060,   // logical px
  STAGE_H:    600,
  PPB:        150,    // px per beat
  PLAYHEAD:   168,    // x of playhead inside stage
  STEP_PX:    8,      // px per staff step (half line gap)
  STAFF_BASE: 187,    // y of E4 (step 0) in stage coords
  NAME_Y:     265,    // y of note name baseline
};

const yStep  = (s) => C.STAFF_BASE - s * C.STEP_PX;
const noteX  = (beat) => C.PLAYHEAD + beat * C.PPB;
const stemUp = (step) => step < 4;
```

`stepOf(letter, octave)` viene de `music.js` (ya existe).  
`noteX` posiciona las notas relativo al playhead: en beat 0 la nota está en x=PLAYHEAD.

---

## Layout del stage (landscape mobile)

```
┌──────────────────────────────────────────────────────┐  STAGE_H=600
│  ← TÍTULO  •  92 BPM                        [⋯]    │  topbar ~50px
├──────────────────────────────────────────────────────┤
│  ┃                                                    │
│  ┃─────────── pentagrama (staff + notas SVG) ──────── │  SCROLL_H ≈ 500px
│  ┃←playhead                                           │
│                                                       │
│     D      F#     A      G      F#  ...  nombres      │
│                                                       │
├──────────────────────────────────────────────────────┤
│  [⏸]  VELOCIDAD [──────] 0.70×  [Loop] [🔊] [1234] │  controls ~50px
└──────────────────────────────────────────────────────┘
```

---

## Motor visual (RAF loop)

```js
const frame = (t) => {
  if (!lastT.current) lastT.current = t;
  const dt = Math.min((t - lastT.current) / 1000, 0.05);
  lastT.current = t;

  if (playingRef.current) {
    const bps = (bpmRef.current / 60) * speedRef.current;
    beatRef.current += dt * bps;

    // end of song
    if (beatRef.current >= totalBeats) {
      if (loopRef.current) beatRef.current = 0;
      else { beatRef.current = 0; playingRef.current = false; setPlaying(false); }
    }
  }

  const b = beatRef.current;

  // scroll
  if (trackRef.current) {
    trackRef.current.style.transform = `translateX(${-b * C.PPB}px)`;
  }

  // countdown (beat < 0)
  const cn = (playingRef.current && b < 0) ? Math.floor(b + 4) + 1 : 0;
  if (cn !== prevCnRef.current) {
    prevCnRef.current = cn;
    setCountNum(cn);
    if (cn > 0 && cn <= 4 && audioRef.current) Audio.playClick();
  }

  // active note
  const ai = findActiveIdx(b, events, starts);
  if (ai !== activeRef.current) {
    activeRef.current = ai;
    setActiveIdx(ai);
    if (ai >= 0 && !events[ai].isRest && audioRef.current) {
      const durSec = MUS.durBeats(events[ai]) * 60 / (bpmRef.current * speedRef.current);
      Audio.playNote(events[ai], durSec);
    }
  }

  raf = requestAnimationFrame(frame);
};
```

`audioRef.current` = `audioEnabled` state espejado en un ref (para evitar stale closures):
`const audioRef = useRef(false); useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);`

`prevCnRef = useRef(0)` — inicializado a 0, rastrea el último número de countdown mostrado.
`totalBeats` = `MUS.totalBeats(events)` calculado como constante al inicio del componente (no dentro del RAF loop).

---

## Countdown

```js
const togglePlay = () => {
  if (playingRef.current) {
    playingRef.current = false;
    setPlaying(false);
    beatRef.current = 0;
    return;
  }
  if (audioRef.current) Audio.start(); // fire-and-forget OK (idempotent)
  beatRef.current = skipCountdown ? 0 : -4;
  lastT.current = 0;
  playingRef.current = true;
  setPlaying(true);
};
```

El countdown es transparente al RAF loop — no hay estado de "contando" separado. La condición `beat < 0` en el loop hace todo.

---

## Componentes internos (no exportados de Player.jsx)

### `Staff` — SVG estático
5 líneas horizontales del pentagrama, desde x=0 hasta x=STAGE_W. Se pinta una sola vez, no se mueve.

### `Notation({ events, starts, activeIdx })` — SVG móvil
Para cada evento note (no rest):
- `x = noteX(starts[i])`
- `cy = yStep(MUS.stepOf(ev.letter, ev.octave))`
- Cabeza: `<ellipse>` rx/ry normales, o más grande si `i === activeIdx`
- Plica: `<line>` desde cx hacia arriba o abajo según `stemUp(step)`
- Alteración: `<text className="acc">♯/♭</text>` a x-22
- Líneas de ledger si step >= 10 o step <= -2
- Hueco por silencios (no se pinta nada)
- Líneas de compás: `<line>` verticales cada `beats_per_bar` beats
- Nota activa: color `var(--gold)` + glow, tamaño mayor

### `Names({ events, starts, activeIdx })` — div móvil
Para cada evento:
- `<div style={{ left: noteX(starts[i]) }}>` con `position: absolute`
- Texto: `ev.letter + ev.acc` (sin octava)
- Silencios: no se pinta
- Nota activa: mayor, dorada

### Playhead
```jsx
<div className="player-playhead" style={{ left: C.PLAYHEAD }} />
```
Línea vertical dorada fija en el stage (no se mueve — el track se mueve alrededor de ella).

### Countdown overlay
```jsx
{countNum > 0 && (
  <div key={countNum} className="player-countdown">{countNum}</div>
)}
```

---

## Controles (mobile, grandes)

| Control | Comportamiento |
|---|---|
| Play/Pause | `togglePlay()`. Icono play/pause según estado. |
| Velocidad | Slider 0.5×–1.0×, mismo estilo `brass` que el editor |
| Loop | Toggle loop de canción completa |
| 🔊 | Toggle `audioEnabled` (por defecto off) |
| 1-2-3-4 | Toggle `skipCountdown` (por defecto off) |

---

## Routing en App.jsx

Añadir ruta `"player"` junto a `"list"` y `"editor"`:

```js
// route: { screen: "list" | "editor" | "player", id: number }

const openPlayer = useCallback(async (id) => {
  // reusar openSong o cargar directamente
  const song = await api.getSong(id);
  const localEvents = (song.events || []).map(apiToLocal);
  setCurrentSong({ ...song, events: localEvents });
  setRoute({ screen: "player", id });
}, []);
```

SongList recibe `onPlay` prop y muestra un botón "Practicar" en cada tarjeta (además del "Editar" existente).

---

## CSS tokens reutilizados

El player usa los mismos tokens del editor en `studio.css`:
- `--gold`, `--gold-deep` — acento latón
- `--bg`, `--card-1` — fondos
- `--ink`, `--ink-dim` — texto
- `--font` — tipografía
- Clases `.brass` (slider), `.btn-gold`, `.chip-toggle`, `.loop-btn` — controls

CSS nuevo en `studio.css`: `.player-stage`, `.player-scroll`, `.player-track`, `.player-playhead`, `.player-countdown`, `.player-controls`, `.player-names`, `.player-topbar`.

---

## Reutilización de código existente

| Módulo existente | Uso en Player |
|---|---|
| `audio.js` — `start()`, `playNote()`, `playClick()` | Audio del player y clicks del countdown |
| `music.js` — `durBeats()`, `totalBeats()`, `stepOf()`, `MUS.LADDER_INDEX` | Duración de eventos, posición en pentagrama |
| `App.jsx` — `apiToLocal()` | Conversión de eventos API al formato local |
| `studio.css` — tokens y clases reutilizables | Estilos del player |

`findActiveIdx(beat, events, starts)` — copiar como función module-level en `Player.jsx` (mismo código que en `Editor.jsx`).

---

## Verificación manual

1. `npm run build` — sin errores
2. Abrir `http://seb01:5050` en el móvil en landscape (o en el PC simulando landscape)
3. En la lista, pulsar "Practicar" en una canción → abre el Player
4. Pulsar Play → countdown 1-2-3-4 con notas apareciendo desde la derecha
5. Verificar: nota activa iluminada en dorado, nombre de nota grande
6. Verificar: líneas de compás a los beats correctos
7. Slider velocidad a 0.5× → va más lento
8. Loop ON → la canción vuelve al principio al terminar
9. 🔊 ON → se oye el sintetizador al tocar notas
10. 🔊 OFF → silencio total
11. 1-2-3-4 ON → play instantáneo sin cuenta atrás
12. ← Volver → regresa a la lista

---

## Fuera de alcance (Fase 4)

- Banda de digitaciones (barras de colores)
- Columna izquierda con diagrama de llaves
- Loop A-B
- `fingerings_alto.json`
