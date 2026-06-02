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
