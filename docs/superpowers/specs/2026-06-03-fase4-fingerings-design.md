# SaxHero Fase 4 — Digitaciones en el Player

> Spec aprobado: 2026-06-03

---

## Objetivo

Añadir al Player el diagrama de llaves del saxo alto (columna izquierda fija) y las barras de digitación (banda de colores sincronizada con el track). El músico puede leer la posición de las llaves a golpe de vista mientras toca.

---

## Cambios en el modelo de datos (music.js)

### Tecla bis (LB)

La digitación estándar de Bb en saxo alto usa la **tecla bis**: una pequeña tecla oval entre el índice (L1) y el medio (L2) de la mano izquierda, pulsada con el lateral del dedo índice.

**Añadir a ROWS** (entre L1 y L2):
```js
{ id: "LB", group: "left", bis: true, label: "Bis (Bb)" },
```

**Actualizar SHAPE**:
```js
"A#": ["L1", "LB"],
Bb:   ["L1", "LB"],
```

(Antes era `["L1","R1"]` — digitación lateral alternativa, menos habitual.)

### ROWS completo resultante (10 filas)

```
O   — octave   — llave de octava (crescent)
L1  — left     — índice izq. (circle)
LB  — left     — tecla bis (circle pequeño, offset derecha)
L2  — left     — medio izq. (circle)
L3  — left     — anular izq. (circle)
L4  — left     — meñique izq. (rect)
R1  — right    — índice der. (circle)
R2  — right    — medio der. (circle)
R3  — right    — anular der. (circle)
R4  — right    — meñique der. (rect)
```

### fingering() — sin cambios en la lógica

`fingering()` usa SHAPE para el lookup → automáticamente devuelve `["L1","LB"]` para Bb/A# tras actualizar SHAPE.

---

## Cambios en Player.jsx

### Nuevas constantes (añadir al objeto C)

```js
COL_W:      146,   // ancho columna de llaves (izq.)
MATRIX_TOP: 286,   // y del primer row de la matriz
ROW_PITCH:  24,    // px entre filas
BAR_H:      14,    // altura de cada barra
BAR_GAP:    5,     // margen lateral de la barra dentro del beat
```

**Ajustar NAME_Y: 240** (estaba en 265 — se sube para dar hueco a la matriz).

### Modificar Staff

Las líneas horizontales del pentagrama deben empezar en `x=COL_W`, no en `x=0`, para dejar espacio a la columna de llaves:

```jsx
// ANTES:
<line x1={0} y1={yStep(s)} x2={C.STAGE_W} ... />
// DESPUÉS:
<line x1={C.COL_W} y1={yStep(s)} x2={C.STAGE_W} ... />
```

### Nuevo componente: PlayerKeyColumn

SVG fijo (no hace parte del track móvil). Se posiciona `position: absolute; left: 0; top: 0; z-index: 6`.

Muestra las llaves del saxo alineadas verticalmente con la matriz de barras. La nota activa se ilumina con el color del grupo + glow.

```jsx
function PlayerKeyColumn({ activeIdx, events }) {
  const ev = activeIdx >= 0 ? events[activeIdx] : null;
  const keys = (ev && !ev.isRest) ? MUS.fingering(ev) : [];
  const on = (id) => keys.includes(id);
  const COLOR = { octave: 'var(--c-octave)', left: 'var(--c-left)', right: 'var(--c-right)' };

  return (
    <svg className="player-keycol" width={C.COL_W} height={C.STAGE_H}>
      {/* guía vertical */}
      <line x1={C.COL_W / 2} y1={C.MATRIX_TOP - 10}
            x2={C.COL_W / 2} y2={C.MATRIX_TOP + MUS.ROWS.length * C.ROW_PITCH + 10}
            stroke="rgba(255,255,255,.06)" strokeWidth="2" />
      {MUS.ROWS.map((row, i) => {
        const cy = C.MATRIX_TOP + i * C.ROW_PITCH;
        const color = COLOR[row.group];
        const lit = on(row.id);
        const glow = lit ? { filter: `drop-shadow(0 0 7px ${color})` } : undefined;
        if (row.id === 'O') {
          return (
            <path key="O" style={glow}
              d={`M 84 ${cy-12} q 16 1 15 13 q -1 12 -15 12 q 8-7 6-14 q -2-6 -6-11 z`}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
          );
        }
        if (row.pinky) {
          return (
            <rect key={row.id} style={glow}
              x={C.COL_W/2 - 20} y={cy - 7} width={40} height={14} rx={7}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" />
          );
        }
        if (row.bis) {
          // círculo pequeño, desplazado a la derecha del eje principal
          return (
            <circle key={row.id} style={glow}
              cx={C.COL_W/2 + 14} cy={cy} r={7}
              fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" />
          );
        }
        return (
          <circle key={row.id} style={glow}
            cx={C.COL_W/2} cy={cy} r={10}
            fill={lit ? color : 'none'} stroke={color} strokeWidth="2.2" />
        );
      })}
    </svg>
  );
}
```

### Nuevo componente: Bars

Div móvil dentro del `.player-track` (se mueve con translateX igual que Notation y Names).

Por cada evento-nota, por cada llave que usa, pinta una barra de color en la fila correspondiente. Las barras tienen el ancho proporcional a la duración de la nota.

```jsx
function Bars({ events, starts, activeIdx, totalBeats }) {
  const w = noteX(totalBeats) + C.PPB;
  const COLOR = { octave: 'var(--c-octave)', left: 'var(--c-left)', right: 'var(--c-right)' };
  return (
    <div className="player-bars" style={{ width: w, height: C.STAGE_H }}>
      {events.map((ev, i) => {
        if (ev.isRest) return null;
        const keys = MUS.fingering(ev);
        const left = noteX(starts[i]) + C.BAR_GAP;
        const barW = Math.max(4, MUS.durBeats(ev) * C.PPB - C.BAR_GAP * 2);
        const active = i === activeIdx;
        return MUS.ROWS.map((row, ri) =>
          keys.includes(row.id) ? (
            <div key={`${i}-${row.id}`}
              className={'player-bar' + (active ? ' active' : '')}
              style={{
                left, width: barW,
                top: C.MATRIX_TOP + ri * C.ROW_PITCH - C.BAR_H / 2,
                height: C.BAR_H,
                background: COLOR[row.group],
              }}
            />
          ) : null
        );
      })}
    </div>
  );
}
```

### JSX — añadir los dos componentes al player

```jsx
{/* scroll region */}
<div className="player-scroll">
  <Staff />
  <div className="player-track" ref={trackRef}>
    <Notation ... />
    <Names ... />
    <Bars events={events} starts={starts} activeIdx={activeIdx} totalBeats={totalBeats} />
  </div>
  <PlayerKeyColumn activeIdx={activeIdx} events={events} />  {/* NUEVO — fijo */}
  <div className="player-playhead" style={{ left: C.PLAYHEAD }} />
  <div className="player-mask-left" />
  <div className="player-mask-right" />
  {countNum > 0 && <div key={countNum} className="player-countdown">{countNum}</div>}
</div>
```

`PlayerKeyColumn` va FUERA del track (es fijo), `Bars` va DENTRO (se mueve).

---

## CSS nuevo (studio.css)

```css
.player-keycol {
  position: absolute; top: 0; left: 0;
  z-index: 6; pointer-events: none;
}
.player-bars {
  position: absolute; top: 0; left: 0;
}
.player-bar {
  position: absolute;
  border-radius: 4px;
  opacity: 0.7;
}
.player-bar.active {
  opacity: 1;
  filter: brightness(1.25);
}
```

---

## Archivos modificados

| Archivo | Cambios |
|---|---|
| `frontend/src/music.js` | Añadir LB a ROWS; actualizar Bb/A# en SHAPE |
| `frontend/src/components/Player.jsx` | Nuevas constantes, NAME_Y ajustado, Staff lines desde COL_W, componentes PlayerKeyColumn + Bars, JSX actualizado |
| `frontend/src/studio.css` | Nuevas clases `.player-keycol`, `.player-bars`, `.player-bar` |

---

## Validación

La tecla bis (LB) es la digitación estándar de Bb:
- Se pulsa con el lateral del índice izquierdo (L1) apoyando en la tecla pequeña entre L1 y L2
- El músico confirma que esta es la digitación que usa

Resto de digitaciones: equivalentes al prototipo del diseñador (song.js), validadas visualmente al probar en pantalla.

## Verificación

```bash
# Build
cd /data/saxhero/frontend && npm run build

# Manual — en el player:
# 1. Nota Bb — columna muestra L1 + LB (pequeño) encendidos en amarillo
# 2. Nota D5 — columna muestra O+L1+L2+L3+R1+R2+R3 encendidos
# 3. Barras de colores visibles para todas las notas del track
# 4. Nota activa: barras más brillantes + glow en columna
# 5. Silencios: columna apagada, sin barras
```
