# SAXHERO.md — Diseño del proyecto

> Nombre provisional: **Sax Hero** (cámbialo si quieres; afecta a repo / dir / DB).
> App personal para transcribir canciones de saxo (nombres de nota) y practicarlas
> al estilo Saxplained: notas que avanzan derecha→izquierda, con velocidad reducible.
> Última actualización: 2026-06-01 (kickoff de diseño)

---

## 1. Resumen

Dos usos:

1. **Editor (escritorio):** meter canciones como tira de nombres de nota; cada nota entra
   como negra; luego ajustar duraciones y silencios **a oído** reproduciendo la canción.
2. **Player "Sax Hero" (mobile-first):** mostrar la canción tipo Guitar Hero, notas
   avanzando derecha→izquierda, con velocidad reducible para practicar en el saxo
   (móvil en la lira).

Solo **saxo alto**. Acceso por Tailscale desde cualquier dispositivo. Sin auth, sin Docker.

---

## 2. Notación de entrada

Formato de cada nota: `<letra><alteración?><octava?>`

- **Letra:** `A`–`G` (nombres ingleses).
- **Alteración:** `#` (sostenido) o `b` (bemol). Nada = natural.
- **Octava** (registro), estilo ABC mediante caso + coma/apóstrofo:

| Escritura | Registro | Octava | Ejemplo |
|---|---|---|---|
| `C,` | grave | 3 | Si♭3 = `Bb,` |
| `C`  | central | 4 | mayúscula sin marca |
| `c`  | alta | 5 | minúscula sin marca |
| `c'` | sobreagudo | 6 | Fa#6 = `f#'` |

Cubre el rango escrito del alto (~Si♭3 a Fa#6).

- **Silencio:** botón "insertar silencio" en el editor, o un token reservado al teclear
  (propuesta: `-`). Tiene duración en pulsos como cualquier nota.
- **Separador de compás:** `|` opcional, ignorado por el parser (solo para que tú agrupes
  por compases como en tu libreta).

Gramática orientativa: `[A-Ga-g][#b]?[,']?`

Ejemplo: `C E G c | A, F# -` → Do4, Mi4, Sol4, Do5, La3, Fa#4, silencio.

---

## 3. Modelo de datos (MariaDB `saxhero_db`)

Normalizado, una fila por evento (nota o silencio). Las canciones son pequeñas: el editor
carga la canción entera y la guarda de vuelta (full-replace de eventos), así no hay que
gestionar reordenamientos finos de `position`.

```sql
CREATE TABLE songs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  bpm           SMALLINT NOT NULL DEFAULT 100,    -- tempo REAL de la canción
  beats_per_bar TINYINT  NOT NULL DEFAULT 4,      -- solo para pintar líneas de compás
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE song_events (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  song_id        INT NOT NULL,
  position       INT NOT NULL,                     -- orden 0,1,2,...
  kind           ENUM('note','rest') NOT NULL,
  pitch          CHAR(1) NULL,                     -- 'A'..'G' (NULL si rest)
  accidental     ENUM('sharp','flat') NULL,        -- NULL = natural o rest
  octave         TINYINT NULL,                     -- 3..6 (NULL si rest)
  duration_beats DECIMAL(5,3) NOT NULL DEFAULT 1,  -- negra=1, corchea=0.5, tresillo≈0.333
  CONSTRAINT fk_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  UNIQUE KEY uq_song_position (song_id, position)
);
```

Notas de diseño:

- **`bpm` = tempo real.** La velocidad reducida del player es un multiplicador (0.5–1.0,
  tope 1.0) que NO toca el `bpm` guardado: `bpm_efectivo = bpm × velocidad`.
- `pitch`/`accidental`/`octave` son canónicos (letra mayúscula + octava numérica); la
  notación con caso/comas/apóstrofo es solo *entrada*, la traduce el parser.
- `duration_beats` en DECIMAL admite subdivisiones; los tresillos se guardan como ≈0.333
  (redondeo despreciable para reproducción).

---

## 4. Arquitectura

```
Navegador (PC = editor / móvil = player) — vía Tailscale
  → nginx (vhost saxhero, Tailscale-only)
      ├── sirve la SPA estática (build de Vite)
      └── proxy /api/* → uvicorn 127.0.0.1:8000 (FastAPI)
                            → PyMySQL → MariaDB saxhero_db (localhost:3306)
```

- **Frontend:** React + Vite + Tailwind. SPA con dos vistas: **Editor** (escritorio) y
  **Player "Sax Hero"** (mobile-first). Toda la lógica de notas, audio y scroller vive en
  el cliente.
- **Audio:** **Tone.js** — síntesis simple (`Tone.Synth`) + transport como reloj maestro:
  el scroller se sincroniza con el tiempo de Tone y bajar la velocidad = cambiar el BPM del
  transport. Reproducción de la nota **escrita literal** (sin transponer a concert pitch).
- **Backend:** FastAPI + PyMySQL, Python 3.11 + `.venv`, loguru→LogCentral. CRUD de
  canciones; `PUT /api/songs/{id}` reemplaza la lista de eventos completa.
- **Sin Docker** (servicio nativo, como glasspannel/mangataro). **Sin auth** (Tailscale es
  la barrera).

### Despliegue en seb01

- Dir: `/data/saxhero/`
- Servicio: `saxhero.service` (uvicorn `127.0.0.1:8000`) → `sudo systemctl restart saxhero`
- nginx: vhost nuevo, sirve `dist/` + proxy `/api`
- Registrar en glasspannel (start/stop) y LogCentral (source `saxhero`)

> **A verificar en Fase 0:** que el puerto 8000 sigue libre (la doc lo marca `[LIBRE]`),
> versiones de Node/Python en seb01 y vhost nginx disponible. Confirmar antes de tocar nada.

---

## 5. Flujo de "ajustar a oído"

Trabajo de **escritorio**. Base = **bucle + nudge**:

1. Pegar/teclear la tira de letras → todos los eventos entran como negras.
2. Seleccionar una nota o frase → suena en bucle al BPM real.
3. `+` / `-` ajustan la duración del evento seleccionado por subdivisiones (1, ½, ¼, ¾…),
   oyendo el cambio en cada vuelta. Botón "insertar silencio".
4. Repetir hasta que case con la canción.

Opcional (primer borrador rápido): **tap-along** — suena un clic y vas pulsando una tecla
para avanzar de nota a nota al ritmo; los huecos se vuelven duraciones. Luego se afina con
bucle+nudge.

---

## 6. Player "Sax Hero" (mobile-first)

Pensado para el móvil en la lira, con las manos en el saxo:

- Notas avanzan **derecha→izquierda**; la nota "actual" suena al llegar al borde izquierdo.
- Nota actual **grande** + nombre de nota, legible a un brazo de distancia.
- **Cuenta atrás** (1-2-3-4) al arrancar; luego no hay que tocar nada.
- Controles mínimos y gordos: play/pause + **slider de velocidad 0.5×–1.0×** (tope 1.0).
- **Metrónomo** opcional.
- **Bucle de sección A–B** para machacar el compás que se resiste.
- Líneas de compás según `beats_per_bar` para orientarse.

---

## 7. Plan de fases

| Fase | Entregable | Resultado usable |
|---|---|---|
| **0 — Andamiaje** | Repo, `saxhero_db` + esquema, FastAPI + Vite/React/Tailwind, systemd + nginx, deploy "hello world" por Tailscale, LogCentral | Esqueleto desplegado |
| **1 — Datos + Editor** | Parser notación ↔ modelo, CRUD canciones, editor escritorio (tira→eventos, reordenar, silencios), persistencia full-replace | Puedo guardar canciones |
| **2 — Audio + ajuste a oído** | Tone.js synth, reproducción al BPM real, bucle+nudge, metrónomo, cuenta atrás, (tap-along opcional) | Puedo afinar duraciones a oído |
| **3 — Player Sax Hero** | Scroller D→I sincronizado, nota grande, slider 0.5–1.0×, cuenta atrás, bucle A–B, líneas de compás | Puedo practicar en la lira |
| **4 — Extra digitaciones** | Tabla digitaciones alto (nota→llaves), carriles + colores estilo Saxplained (octava / mano izq / mano der) sincronizados | El "Guitar Hero" completo |

Cada fase es independientemente útil; se puede parar en cualquiera.

---

## 8. Aplazado (no ahora)

- **Transposición a concert pitch** — cuando aprendas solfeo o quieras tocar sobre
  grabaciones reales. Será un toggle.
- **Timbre de saxo real** (muestra en vez de synth) — si el sonido de videojuego cansa.
- **Velocidad > 1.0×** — no se necesita.
- **Compases / time signatures explícitos** — con BPM + duraciones en pulsos basta; las
  líneas de compás son solo visuales.

---

## 9. Decisiones cerradas (acta)

- Notación: `C, / C / c / c'` para octava, `#`/`b` para alteración, letras inglesas.
- Silencios = eventos de primera clase.
- Almacenamiento normalizado en MariaDB (`songs` + `song_events`).
- Editor = escritorio; Player = mobile-first.
- Backend FastAPI; front React+Tailwind+Vite; sin Docker; sin auth.
- Audio: Tone.js, synth simple, nota escrita literal.
- Velocidad: multiplicador 0.5–1.0× sobre el BPM real, tope 1.0.
- Solo saxo alto.

---

## 10. Editor multilínea (reflow automático)

> Añadido 2026-09-06. Sustituye el scroll horizontal infinito de la tira de
> notas y el pentagrama por líneas envueltas con scroll vertical, para
> canciones largas.

**Motivación:** con canciones de muchos eventos, tanto la tira de texto como
el pentagrama se convertían en una única fila que crecía sin límite hacia la
derecha, obligando a hacer scroll horizontal constante para leer o editar.

**Modelo de reflow.** No se persiste ningún salto de línea — ni en el texto
serializado ni en `song_events`. Las líneas son puramente una vista calculada:
se trocea el array de `events` (ya ordenado por `position`) en bloques de
**28 eventos** (notas + silencios cuentan igual), recalculado en cada render.
Insertar o borrar un evento en cualquier punto reordena automáticamente todo
lo que va detrás en las líneas siguientes — no hace falta lógica extra para
que "lo que escribes en la línea 2 se dibuje en la línea 2".

**Tira de notas — revisado 2026-09-06 (ver D6).** Se mantiene el `<textarea>`
único. El serializador (`MUS.serialize`) inserta `\n` cada 28 eventos, además
de los `|` de compás que ya insertaba. El parser no cambia: `parseStrip` ya
trocea con `/\s+/`, que en JS incluye `\n`, así que un salto de línea ya se
trata como separador equivalente a un espacio — igual que `|` — sin tocar una
línea de `music.js`. Fuente monoespaciada + `white-space: pre` en el
`.strip-input` para que la línea de texto *i* coincida visualmente con la
fila *i* del pentagrama (sin que el navegador la envuelva por ancho). Si al
escribir se supera el bloque de 28, el evento sobrante aparece en la línea
siguiente en cuanto se re-serializa — el cursor simplemente atraviesa el
`\n` como cualquier otro carácter, sin saltar entre elementos del DOM.

*Riesgo conocido (real, no el de la versión anterior de este documento):*
para que el `\n` aparezca *mientras se escribe* (no solo al salir del campo),
`onText` pasa de guardar el texto tal cual se teclea a re-serializar+envolver
en cada pulsación. Eso obliga a guardar y restaurar la posición del cursor a
mano en cada tecla — mapeando por índice de evento (no por offset de
carácter crudo, porque la re-serialización desplaza espacios/`\n`). Se
verifica en el navegador al implementarlo. Si el usuario borra o inserta un
`\n` a mano no pasa nada semánticamente (es solo separador), pero la
re-serialización lo recoloca en cuanto reconcilia — puede sorprender la
primera vez.

*Corrección real encontrada al implementar (ver D7):* re-serializar
incondicionalmente en cada tecla rompía la escritura normal — `serialize`
nunca emite un espacio final, así que re-serializar justo tras teclear un
espacio suelto lo colapsaba; la siguiente tecla (la letra de la nueva nota)
aterrizaba pegada al token anterior, formando un token inválido de 2+ letras
que `parseToken` rechaza, y `parseStrip` lo descartaba entero — borrando
también la nota anterior válida. `onText` deja pasar el texto crudo sin
canonicalizar en dos casos: cuando el carácter recién tecleado es un
separador (para no comerse ese hueco antes de que llegue la letra), y cuando
reconciliar produjo menos eventos que antes de esa tecla (para no ocultar del
texto visible una fusión ambigua e irresoluble — p. ej. teclear una letra
pegada al token anterior sin separador — dejando el texto crudo en pantalla,
como ya hacía el editor antes de la Tarea 3, en vez de borrarlo al instante).
Re-serializa+recoloca el cursor solo en una tecla que añade contenido sin
perder ninguno.

**Pentagrama.** Mismo troceo de 28 aplicado a `StaffPreview`: una fila SVG
por bloque, apiladas verticalmente dentro de un contenedor con scroll
vertical (reemplaza el scroll horizontal actual). Cada fila recibe su slice
de eventos más el offset para traducir índices locales↔globales (selección,
nota activa).

**Panel de pills.** Se filtra a una sola línea: la que contiene la nota
seleccionada (`sel`). Si no hay selección pero la canción está sonando,
muestra la línea de la nota que se está reproduciendo (`activeIdx`) en vez de
quedarse vacío o fijo en la línea 1.

**Reproducción cruzando líneas.** La lógica de audio/rAF no cambia — el
playhead sigue siendo un único beat continuo. Lo nuevo: cada frame se calcula
`lineOf(activeIdx) = Math.floor(activeIdx / 28)` (misma fórmula en texto y
pentagrama); si cambió respecto al frame anterior, se hace scroll suave del
contenedor de texto (`textarea.scrollTop = lineHeight * línea`) y del de
pentagrama (la fila correspondiente al viewport) para dejar esa línea
visible — mismo patrón que ya usa el auto-scroll horizontal existente, solo
que vertical y a nivel de línea en vez de píxel a píxel.

---

## 11. Decisiones (ADR)

| # | Decisión | Razón | Estado | Fecha |
|---|---|---|---|---|
| D1 | Tope de línea = 28 eventos (notas + silencios cuentan igual), fijo | Simplicidad y previsibilidad; pedido explícito por el usuario | vigente | 2026-09-06 |
| D2 | El reflow en líneas es 100% calculado; no se persisten saltos de línea en texto ni en BD | Evita desincronizar lo guardado con la vista; reordenar es gratis porque ya se deriva de `position` en `events` | vigente | 2026-09-06 |
| D3 | La tira de notas pasa de un `<textarea>` único a una caja de texto editable por línea | Permite auto-scroll vertical fiable y que el desbordamiento salte de línea automáticamente | superada por D6 | 2026-09-06 |
| D4 | El panel de pills muestra solo la línea de `sel`; si no hay selección y está sonando, usa la línea de `activeIdx` | Mantener foco de edición sin saturar la UI con todas las líneas a la vez | vigente | 2026-09-06 |
| D5 | Cruce de línea en reproducción: auto-scroll vertical de texto y pentagrama siguiendo el playhead | Consistencia con el auto-scroll horizontal ya validado; evita inventar un mecanismo nuevo | vigente | 2026-09-06 |
| D6 | La tira de notas se mantiene como un único `<textarea>`; el serializador inserta `\n` cada 28 eventos y se apoya en que `parseStrip` ya trata `\n` como separador (vía `/\s+/`), sin tocar el parser | Mucho más simple que D3 (una sola caja controlada, sin migración de contenido entre elementos del DOM); el `\n` incrustado no rompe D2 porque `strip`/texto nunca se persiste en el backend | vigente | 2026-09-06 |
| D7 | `onText` NO re-serializa en cada tecla incondicionalmente: se deja pasar el texto crudo tal cual (`setText(v)`, sin canonicalizar) cuando el carácter recién tecleado es un separador (espacio/`\n`), **o** cuando reconciliar el texto crudo produjo MENOS eventos que antes de esta tecla (`droppedContent`); solo se re-serializa+recoloca el cursor en una tecla que añade contenido sin perder ninguno | `MUS.serialize` nunca emite espacio final (`parts.join(' ')`); re-serializar justo tras un espacio suelto lo colapsaba, fusionando la letra siguiente con el token anterior. La primera ronda del guard (solo por separador) arregla la secuencia correcta de escritura (separador→letra), verificado con `node`, pero dejaba un caso: tecleares una letra pegada al token anterior sin separador (ambigüedad irresoluble entre "extender el token" y "empezar uno nuevo, olvidando el separador") seguía re-serializando de inmediato, ocultando el error del texto visible al instante — peor que el comportamiento previo a la Tarea 3, que dejaba el texto crudo (visiblemente roto) en pantalla para que el usuario lo viera y lo corrigiera. El guard `droppedContent` restaura ese comportamiento no-destructivo. Encontrado por el implementador de la Tarea 3; ambos guards verificados juntos con `node` antes de esta ronda | vigente | 2026-09-07 |
| D8 | `caretTokenCount`/`offsetForTokenCount` (`lineWrap.js`) ignoran el token `|` de compás al contar y localizar | `MUS.serialize` inserta `|` en cada límite de compás en su salida canónica, pero el texto crudo que el usuario está tecleando normalmente aún no lo tiene ahí — así que contar en el crudo y localizar en el canónico discrepaban en uno cada vez que un límite de compás caía antes del cursor, dejándolo justo *antes* de la nota recién tecleada en vez de después (reordena notas en la siguiente tecla). Encontrado por el revisor de la Tarea 3 rastreando a mano la propia evidencia del informe del implementador; confirmado y arreglado con `node` antes de fallar sobre ello | vigente | 2026-09-07 |
| D9 | El branch "no canonicalizar" de `onText` (D7) limpia `pendingCaretRef.current = null` antes de salir | Si una re-serialización canónica resulta ser un no-op (`wrapped === text`), React no vuelve a renderizar, el `useLayoutEffect` (atado a `[text]`) nunca se dispara, y el offset de cursor calculado para esa tecla queda "pendiente" sin aplicar — sobreviviendo hasta la siguiente tecla que sí cambie el texto (una del branch D7), momento en el que se aplicaría a un texto completamente distinto, saltando el cursor a un sitio incorrecto. Encontrado por el revisor de la Tarea 3; corregido con esta única línea, sin tocar el resto del mecanismo | vigente | 2026-09-07 |
