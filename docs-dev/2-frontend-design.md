# SAXHERO — Diseño de frontend

> **Companion de `1-design.md`.** No lo sustituye. `1-design.md` manda en
> arquitectura, datos, fases y decisiones; este doc cubre la **capa visual**
> de los dos fronts (Editor y Player) y cómo se conecta con el modelo de datos.
> Última actualización: 2026-06-02

---

## 0. Jerarquía de fuentes (léelo primero, Claude Code)

Tres fuentes, cada una manda en lo suyo:

| Fuente | Manda en |
|---|---|
| `1-design.md` | Arquitectura, modelo de datos, fases, decisiones (el *cómo se construye*) |
| **Bundle de Claude Design** (HTML export + capturas) | Píxeles exactos: tokens, hex, fuentes, spacing, layout fino (el *qué se ve*) |
| **Este doc** | Anatomía, motor visual, mapping datos→UI, y qué entra en cada fase (el pegamento) |

**Regla operativa:** los valores visuales exactos (colores hex, tipografías, medidas)
se **extraen del bundle de Design**. Este doc fija la estructura y el comportamiento,
no inventa tokens que compitan con el bundle.

---

## 1. Lenguaje visual

- **Player:** oscuro / arcade / neón. Fondo negro "espacial" con motas (bokeh) tenues
  y cálidas, glow, líneas finas. Cinematográfico. Acento de marca **latón/dorado** (saxo).
- **Editor:** estudio. Mismo acento, más sobrio, limpio y funcional (nada arcade).

Tokens exactos → bundle de Design.

---

## 2. Player "Sax Hero" — móvil **landscape** (Fases 3–4)

**Tres bandas horizontales apiladas que avanzan derecha→izquierda, sincronizadas**,
con una línea-marca (**playhead**) vertical brillante en el **borde izquierdo**
(maximiza el lookahead; el "rastro" de lo ya tocado no aporta).

1. **Pentagrama** — notación real (cabezas, plicas, corcheas, sostenidos, silencios).
   Renderizado con **abcjs**. Ojo alineación → §5.
2. **Banda de nombres** — letra+alteración (sin octava en el display: `A`, `G`, `F#`),
   alineada bajo cada nota.
3. **Matriz de digitación (Fase 4)** — leyenda fija de llaves del alto a la izquierda
   (llave de octava arriba, luego agujeros), y por cada nota barras encendidas
   indicando qué llaves se pisan. Color por grupo → §4.

**Comportamiento:**
- La nota que cruza el playhead se **ilumina y se agranda**.
- **Timeline tiempo→x proporcional** (px por pulso). La duración se expresa por
  **espaciado** (nota larga = más separación + el playhead se demora más), no por ancho de barra.
- Reloj maestro = **Tone.js transport** (§5).

**Controles** (según `1-design.md` §6, grandes, móvil en la lira):
play/pausa · slider velocidad **0.5×–1.0×** · metrónomo opcional · **bucle A–B** ·
líneas de compás (`beats_per_bar`) · **cuenta atrás 1-2-3-4** al arrancar.

**Gating por fase:**
- **Fase 3:** bandas 1 + 2 + todos los controles.
- **Fase 4:** banda 3 (matriz) + colores.


**ficheros con el diseño**: en `docs-dev/frontend files/saxhero player.zip` 
---

## 3. Editor / compositor — **escritorio** (Fase 1)

**Pantalla A — Lista de canciones:** tarjetas con portada (imagen), título, BPM y
**estrellas de dificultad (1–5)**. Acciones: crear / editar / borrar.

**Pantalla B — Editor de una canción:**
- **Cabecera:** título · BPM · `beats_per_bar` · estrellas de dificultad · subir portada.
- **Entrada de notas:** campo de texto con la tira de notación (`C E G c | A, F# -`);
  todo entra como **negra**.
- **Preview de pentagrama en vivo** (abcjs) que se redibuja al teclear.
- **Timeline de "pills"** (una por evento): seleccionas una nota y ajustas su duración
  con `+`/`-` (negra, corchea, puntillo, tresillo) e **insertas silencios**.
- **Controles de reproducción** para *ajuste a oído*: play + **bucle de la selección** (loop+nudge).
- **(Opcional)** panel lateral con la **digitación de la nota seleccionada** como referencia.

Estética estudio; tokens → bundle.

**ficheros con el diseño**: en `docs-dev/frontend files/saxhero compositor.zip`
---

## 4. Sistema de color

- **Semántica de la matriz (Fase 4):** `rojo = llave de octava` · `amarillo = mano izquierda` ·
  `azul = mano derecha`. **⚠ Verificar contra tus capturas de Saxplained** antes de fijar.
- Acento de marca: latón/dorado.
- Hex exactos → bundle de Design.

---

## 5. Motor visual y riesgos (lo que el bundle NO captura)

- **Pentagrama del player + alineación.** abcjs espacia por reglas de grabado, **no**
  proporcional al tiempo → un pentagrama abcjs **no alinea** con las columnas de la
  matriz de digitación. Para **Fase 4**, el pentagrama del player probablemente tenga
  que pasar a **glifos SMuFL posicionados a mano** sobre el timeline tiempo→x.
  En el **editor**, abcjs normal vale (no hay que alinear con nada).
- **Reloj maestro = Tone.js transport.** Scroll y las tres bandas se derivan del tiempo
  de Tone. Bajar velocidad = bajar el BPM del transport (`bpm_efectivo = bpm × velocidad`).
- **Lógica de cliente:** highlight de nota activa, cuenta atrás, bucle A–B, metrónomo.

---

## 6. Mapping datos → UI

`song_events (kind, pitch, accidental, octave, duration_beats)`:

- **Nombre de nota:** `pitch` + `accidental` (sin octava en el display).
- **Pentagrama:** `pitch`+`accidental`+`octave` → glifo y posición en el pentagrama;
  `duration_beats` → figura (con puntillo / tresillo).
- **Matriz (Fase 4):** `pitch`+`accidental`+`octave` → **lookup** en la tabla de
  digitación → llaves encendidas + color por grupo.
- **Duración:** → espaciado proporcional en el timeline (no ancho de barra).
- **`kind = rest`:** silencio en pentagrama + hueco en bandas; sin nombre.

---

## 7. Activo nuevo requerido (Fase 4)

- **`fingerings_alto.json`** — tabla nota→llaves del saxo alto (~36 notas, digitación
  estándar). **Dato derivado por lookup, NO se guarda por canción.** Validar las
  digitaciones con cuidado (una digitación falsa en un método de práctica es veneno).

---

## 8. Handoff a Claude Code

1. **Commitear** en el repo:
   - este doc → `docs/design/saxhero_frontend_design.md`
   - bundle de Design (HTML export + capturas) → `docs/design/design-bundle/`
2. **Frase de gobernanza** al arrancar la sesión de frontend:
   > "`1-design.md` manda en arquitectura y datos. `docs/design/saxhero_frontend_design.md`
   > + el bundle de Design mandan en el look del frontend. Extrae los tokens visuales
   > (hex, fuentes, medidas) del bundle; sigue este doc para estructura, motor y mapping."
3. **Cuándo alimentarlo:**
   - **Editor** → cuando entre en Fase 1.
   - **Player** (bandas 1+2) → Fase 3.
   - **Matriz + colores** → Fase 4.
   - **No** metas el material del player en la sesión actual si Claude Code está en
     backend/scaffolding — apárcalo como referencia hasta la fase correspondiente.