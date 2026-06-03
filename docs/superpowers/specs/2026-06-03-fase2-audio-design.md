# SaxHero Fase 2 — Audio + Ajuste a Oído

> Spec aprobado: 2026-06-03

---

## Objetivo

Añadir reproducción de audio real al editor existente. El usuario teclea la tira de notas, pone en marcha la reproducción y escucha la canción al BPM guardado. Puede activar "Bucle sel." para repetir una nota y ajustar su duración a oído con los botones +/–. Un countdown 1-2-3-4 (visual + click de audio) precede a cada reproducción.

---

## Fuera de alcance (aplazado)

- Metrónomo audible durante reproducción (los beatdots visuales son suficientes)
- Tap-along
- Migración a Tone.js Transport como reloj maestro (se considera en Fase 3)
- Cambios en backend

---

## Decisiones de diseño

### Reloj maestro: RAF (no Tone.js Transport)

El RAF loop existente ya funciona correctamente como reloj visual. Para el editor, el jitter de ~16ms es imperceptible: el usuario está componiendo, no actuando en directo. Tone.js se usa **solo como motor de sonido**, no como clock. La migración al Transport se hará en Fase 3 cuando el player necesite sincronizar pentagrama + bandas con precisión.

### Detección de nota: cambio de índice activo

En cada frame del RAF loop se calcula el índice de la nota activa (`findActiveIdx`). Cuando cambia → se dispara `Audio.playNote()`. Al hacer wrap del loop (reset a `lo`), se resetea el índice previo a -1 para que la nota vuelva a sonar.

### Synth: AMSynth (Tone.js)

`Tone.AMSynth` con oscilador sawtooth — más cuerpo que `Tone.Synth` plano, sigue siendo simple. Pitch en formato Tone.js nativo: `ev.letter + (ev.acc || '') + ev.octave` (e.g. `"F#5"`, `"Bb4"`, `"C4"`). Duración en segundos: `durBeats(ev) * 60 / (bpm * speed)`.

### Countdown: visual + audio

4 beats antes de cada reproducción. Overlay oscuro con blur sobre el pentagrama. Número grande en color latón/dorado (`--accent`). Un click por beat (`MembraneSynth`). Implementado con `async/await` + `setTimeout` chain. Cancelable si el usuario vuelve a pulsar Play.

---

## Arquitectura

### Fichero nuevo: `frontend/src/audio.js`

Singleton que encapsula Tone.js. Exports:

```js
start()                      // arranca AudioContext (requiere gesto usuario)
playNote(ev, durationSec)    // AMSynth.triggerAttackRelease(pitch, dur)
playClick()                  // MembraneSynth click para countdown
dispose()                    // limpia synths
```

Tone.js se importa como ES module (`import * as Tone from 'tone'`). `start()` llama `Tone.start()` y es idempotente.

### Fichero modificado: `frontend/src/components/Editor.jsx`

**Nuevos refs:**
- `prevActiveIdxRef` — índice activo en el frame anterior (evita re-trigger)
- `countdownCancelRef` — flag para cancelar countdown en vuelo

**Nuevo estado:**
- `countdownBeat` — `null | 1 | 2 | 3 | 4` — controla el overlay

**Nuevas funciones:**
- `startPlayback()` — arranca el RAF loop con audio, resetea prevActiveIdxRef
- `doCountdown()` — async, loop 1-2-3-4 con setTimeout + playClick, llama startPlayback al final
- `stopCountdown()` — setea countdownCancelRef, limpia overlay

**Cambios en RAF frame:**
```
// Después de actualizar beatRef y hacer wrap:
newIdx = findActiveIdx(beatRef.current, evs, st)
if (newIdx !== prevActiveIdxRef.current):
  prevActiveIdxRef.current = newIdx
  if nota (no rest): Audio.playNote(ev, durSec)

// En wrap del loop (beatRef = lo):
prevActiveIdxRef.current = -1   ← nuevo
```

**Cambios en `togglePlay()`:**
```
Si playing → stop (igual que antes)
Si counting → stopCountdown()
Si idle → doCountdown()
```

**UI nuevo:**
- Overlay del countdown dentro de `.staff-frame` (position: relative ya está)
- Estado del botón play: `idle` / `counting` / `playing`

### Fichero modificado: `frontend/src/studio.css`

```css
.countdown-overlay {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(6px);
  border-radius: inherit;
  z-index: 10;
}
.countdown-num {
  font-size: 96px; font-weight: 900;
  color: var(--accent);
  text-shadow: 0 0 40px rgba(201, 162, 39, 0.6);  /* fallback: latón/dorado */
  animation: count-pop 0.12s ease-out;
}
@keyframes count-pop {
  from { transform: scale(1.4); opacity: 0.4; }
  to   { transform: scale(1);   opacity: 1; }
}
```

---

## Dependencia nueva

```bash
cd frontend && npm install tone
```

Tone.js ~180KB gzipped. Se carga solo cuando `Audio.start()` se llama (lazy init por gesto de usuario).

---

## Tests / verificación

1. `cd backend && pytest` — sin cambios esperados (backend intacto)
2. `cd frontend && npm run lint` — sin errores
3. Manual:
   - Abrir editor, pulsar Play → ver countdown 1-2-3-4 con clicks
   - Confirmar que las notas suenan al BPM correcto
   - Cambiar BPM → countdown y notas cambian de tempo
   - Activar Bucle sel. sobre una nota → nota suena en loop continuo
   - Cambiar duración con +/– mientras bucle activo → cambio audible inmediato en el siguiente ciclo
   - Pulsar Play durante countdown → se cancela, no arranca reproducción
   - Reproducir canción con silencios → silencio = sin sonido en ese hueco
   - Velocidad slider → notas suenan proporcionalmente más lentas/rápidas
