# Editor multilínea (reflow automático) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-line, horizontally-infinite tira de notas and pentagrama in the SaxHero editor with a reflowed, line-wrapped view (28 events/line) that scrolls vertically, keeps the pills panel scoped to one line, and auto-follows the playhead across line boundaries during playback.

**Architecture:** Pure, testable line-math helpers live in a new `frontend/src/lineWrap.js`. `music.js`'s `serialize()` gains an optional wrap parameter that inserts `\n` every 28 events (D6) — the parser needs zero changes because `parseStrip` already treats `\n` as whitespace. `Editor.jsx` keeps a single `<textarea>` (monospace, `white-space: pre`) with caret-preserving live reflow, and renders the pentagram as N stacked `<StaffPreview>` rows (one per 28-event chunk) inside a vertical-scroll container — `StaffPreview` itself needs no changes since it already accepts an arbitrary `events` slice. The existing rAF playback clock gains line-crossing detection that auto-scrolls both panels.

**Tech Stack:** React 19, plain JS (no TypeScript), Vite, no CSS framework beyond hand-written `studio.css`. No frontend test runner exists in this project (no jest/vitest) — see Global Constraints.

**Spec:** `docs-dev/1-design.md` §10 (design) and §11 (ADR D1–D6). Also mirrored at `/data/library/mi-wiki/docs/Obsidian/30-projects/saxhero/sprints/2026-09-06-editor-multilinea.md` — the repo doc is the source of truth if they ever diverge.

## Global Constraints

- **D1** — Line cap = 28 events (notes + rests count equally), fixed.
- **D2** — Line reflow is 100% computed; never persist line breaks in the serialized text or in `song_events`. The `strip` text field never reaches the backend today (`grep -rn strip backend/` returns nothing) — do not add it.
- **D6** — Keep a single `<textarea>`; the serializer inserts `\n` every 28 events. `parseStrip` (`frontend/src/music.js:29`) already splits on `/\s+/`, which includes `\n` in JS — **do not modify the parser**.
- **No frontend test framework exists** (no jest/vitest, no `*.test.js` files, `package.json` has no test script). Do not add one as part of this plan. Verify pure functions (Tasks 1–2) with ad hoc `node --input-type=module -e "..."` snippets. Verify UI behavior (Tasks 3, 5, 6, 7) by hand in a browser.
- **Backend is out of scope.** This entire feature is frontend-only. Do not touch `backend/`.
- **Dev server needs a temporary proxy to reach the API.** `frontend/vite.config.js` has no `server.proxy` entry, so `npm run dev` alone can't reach `http://127.0.0.1:8000`. For manual browser verification, temporarily add:
  ```js
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  ```
  to `vite.config.js`, verify, then **revert it before committing** (`git diff --stat -- frontend/vite.config.js` must be empty at commit time). Never commit this proxy change.
- **Branch:** work happens on the existing `multiline` branch (already has the design-doc commits `ea2e4fe`, `7fa70e0`). Do not create a new branch.
- **Disposable test fixture:** several tasks need a song with >28 events to verify wrapping. Create/reuse ONE song titled exactly `TEST multilinea (borrar)` (idempotent lookup by title, shown in Task 2). Never modify or delete the user's real songs (`Chrono Trigger`, `Sin título`) during verification. Delete the test song in Task 8.

---

## File Structure

- **Create** `frontend/src/lineWrap.js` — pure line-reflow helpers (`LINE_SIZE`, `TEXT_LINE_HEIGHT_PX`, `lineOf`, `caretTokenCount`, `offsetForTokenCount`). No React, no DOM — trivially testable with plain `node`.
- **Modify** `frontend/src/music.js` — `serialize()` gains an optional `wrapAt` param (Task 2). `parseStrip`/`parseToken`/`reconcile` are **not** touched.
- **Modify** `frontend/src/components/Editor.jsx` — the bulk of the work: caret-preserving text reflow (Task 3), multi-row staff rendering (Task 5), line-scoped pills (Task 6), rAF auto-scroll on line crossing (Task 7).
- **Modify** `frontend/src/studio.css` — `.strip-input` becomes monospace/`white-space:pre`/fixed-height-scrollable (Task 4); `.staff-scroll` flips from horizontal-only to a single shared 2-axis scroll container for the stacked rows (Task 5).
- **Not modified:** `frontend/src/components/Ui.jsx` (`StaffPreview` already accepts an arbitrary `events` slice + local `selectedIdx`/`activeIdx` — no change needed), any backend file.

---

### Task 1: `lineWrap.js` — pure line-reflow helpers

**Files:**
- Create: `frontend/src/lineWrap.js`

**Interfaces:**
- Produces: `LINE_SIZE` (number, 28), `TEXT_LINE_HEIGHT_PX` (number, 28 — must match `.strip-input`'s CSS `line-height`, wired in Task 4), `lineOf(idx, size = LINE_SIZE)` → line number for an event index, `caretTokenCount(text, caretPos)` → number of whitespace-delimited tokens at/before a caret offset, `offsetForTokenCount(text, n)` → character offset right after the n-th token in `text` (or end-of-string if `text` has fewer than `n` tokens).

- [ ] **Step 1: Write `lineWrap.js`**

```js
// lineWrap.js — line-reflow helpers shared by the text editor and the staff view.
// TEXT_LINE_HEIGHT_PX must match .strip-input's `line-height` in studio.css.
export const LINE_SIZE = 28;
export const TEXT_LINE_HEIGHT_PX = 28;

export function lineOf(idx, size = LINE_SIZE) {
  return idx < 0 ? 0 : Math.floor(idx / size);
}

export function caretTokenCount(text, caretPos) {
  return text.slice(0, caretPos).trim().split(/\s+/).filter(Boolean).length;
}

export function offsetForTokenCount(text, n) {
  if (n <= 0) return 0;
  const re = /\S+/g;
  let m, count = 0, end = text.length;
  while ((m = re.exec(text))) {
    count++;
    end = m.index + m[0].length;
    if (count === n) return end;
  }
  return end;
}
```

- [ ] **Step 2: Verify with a Node smoke test**

Run (from `/data/saxhero`):

```bash
node --input-type=module -e "
import { LINE_SIZE, TEXT_LINE_HEIGHT_PX, lineOf, caretTokenCount, offsetForTokenCount } from './frontend/src/lineWrap.js';
console.assert(LINE_SIZE === 28, 'LINE_SIZE');
console.assert(TEXT_LINE_HEIGHT_PX === 28, 'TEXT_LINE_HEIGHT_PX');
console.assert(lineOf(0) === 0, 'lineOf(0)');
console.assert(lineOf(27) === 0, 'lineOf(27)');
console.assert(lineOf(28) === 1, 'lineOf(28)');
console.assert(lineOf(-1) === 0, 'lineOf(-1)');
console.assert(caretTokenCount('C E G', 3) === 2, 'caretTokenCount mid, got ' + caretTokenCount('C E G', 3));
console.assert(caretTokenCount('C E G', 0) === 0, 'caretTokenCount start');
console.assert(caretTokenCount('C E G', 5) === 3, 'caretTokenCount end');
console.assert(offsetForTokenCount('C E G', 2) === 3, 'offsetForTokenCount 2, got ' + offsetForTokenCount('C E G', 2));
console.assert(offsetForTokenCount('C E G', 0) === 0, 'offsetForTokenCount 0');
console.assert(offsetForTokenCount('C E G', 5) === 5, 'offsetForTokenCount overflow -> end');
console.log('lineWrap smoke test OK');
"
```

Expected: only the line `lineWrap smoke test OK` printed. Any `Assertion failed` line means a bug — fix `lineWrap.js` before continuing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lineWrap.js
git commit -m "$(cat <<'EOF'
feat: add lineWrap.js pure helpers for editor line reflow

Line-index/caret math for the 28-event line cap (D1), split out as
pure functions so they're testable without a browser.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GzLJquQ5cwGmfQFYQ2DLFs
EOF
)"
```

**D8 (added retroactively during Task 3's first review, supersedes `caretTokenCount`/`offsetForTokenCount`'s original bodies above):** both functions counted `|` as an ordinary token. `MUS.serialize` auto-inserts `|` at every bar boundary in its *canonical* output, but the raw text the user is actively typing usually doesn't have one there yet. So `caretTokenCount(v, caretPos)` (counting in the raw text) and `offsetForTokenCount(wrapped, n)` (locating in the canonical text) disagreed by one token every time a bar boundary fell before the caret — the caret landed right *before* the just-typed note instead of after it, which reorders notes on the very next keystroke. Found by Task 3's reviewer while hand-tracing the implementer's own passing evidence (`selectionStart: 79` sitting on the space before `G` in `...E | G`, not after it); confirmed and fixed with `node` before ruling. Fix: both functions skip `|` when counting/scanning, matching how `parseStrip` already treats it as a non-event:

```js
export function caretTokenCount(text, caretPos) {
  return text.slice(0, caretPos).trim().split(/\s+/).filter(Boolean).filter((t) => t !== "|").length;
}

export function offsetForTokenCount(text, n) {
  if (n <= 0) return 0;
  const re = /\S+/g;
  let m, count = 0, end = text.length;
  while ((m = re.exec(text))) {
    if (m[0] === "|") continue;
    count++;
    end = m.index + m[0].length;
    if (count === n) return end;
  }
  return end;
}
```

Re-verify with an expanded version of Task 1's original smoke test — all of Task 1's original assertions must still pass (none of them involved `|`), plus:

```bash
node --input-type=module -e "
import { caretTokenCount, offsetForTokenCount } from './frontend/src/lineWrap.js';
const wrapped = 'C D C E | G';
const v = 'C D C E G';
const n = caretTokenCount(v, v.length);
console.assert(n === 5, 'caretTokenCount ignores | in raw text, got ' + n);
const offset = offsetForTokenCount(wrapped, n);
console.assert(offset === wrapped.length, 'offsetForTokenCount lands after G despite the auto-inserted | before it, got ' + offset);
console.log('D8 smoke test OK');
"
```

---

### Task 2: `serialize()` wrap support + wire the two existing call sites

**Files:**
- Modify: `frontend/src/music.js:45-55` (the `serialize` function)
- Modify: `frontend/src/components/Editor.jsx:1-3` (imports), `:32` (initial `text` state), `:174` (`applyEvents`)

**Interfaces:**
- Consumes: `LINE_SIZE` from Task 1 (`frontend/src/lineWrap.js`).
- Produces: `MUS.serialize(events, beatsPerBar, wrapAt?)` — 3rd param optional, existing 2-arg callers elsewhere are unaffected (there are none besides the two in `Editor.jsx` being updated here — confirmed via `grep -rn "MUS.serialize\|\.serialize(" frontend/src/`).

- [ ] **Step 1: Add `wrapAt` to `serialize()`**

In `frontend/src/music.js`, replace the existing `serialize` function (lines 45-55):

```js
export function serialize(events, beatsPerBar, wrapAt) {
  const parts = [];
  let acc = 0;
  events.forEach((ev, i) => {
    parts.push(tokenForEvent(ev));
    acc += durBeats(ev);
    if (beatsPerBar && acc >= beatsPerBar - 1e-6) { acc = 0; parts.push("|"); }
    if (wrapAt && (i + 1) % wrapAt === 0 && i !== events.length - 1) parts.push("\n");
  });
  if (parts[parts.length - 1] === "|") parts.pop();
  return parts.join(" ").replace(/ ?\n ?/g, "\n");
}
```

- [ ] **Step 2: Verify with a Node smoke test**

```bash
node --input-type=module -e "
import { serialize, parseStrip } from './frontend/src/music.js';
const evs = Array.from({length: 30}, () => ({ isRest:false, letter:'C', acc:'', octave:4, base:'4', dotted:false, triplet:false }));
const s = serialize(evs, 0, 28);
const lines = s.split('\n');
console.assert(lines.length === 2, 'wraps into 2 lines, got ' + lines.length);
console.assert(lines[0].trim().split(/\s+/).filter(Boolean).length === 28, 'line 1 has 28 tokens, got ' + lines[0].trim().split(/\s+/).filter(Boolean).length);
console.assert(lines[1].trim().split(/\s+/).filter(Boolean).length === 2, 'line 2 has 2 tokens, got ' + lines[1].trim().split(/\s+/).filter(Boolean).length);
console.assert(parseStrip(s).length === 30, 'round-trips to 30 notes, got ' + parseStrip(s).length);
const s2 = serialize(evs.slice(0,28), 0, 28);
console.assert(!s2.includes('\n'), 'exactly 28 events: no trailing newline, got: ' + JSON.stringify(s2));
const s3 = serialize(evs, 4, 28);
console.assert(parseStrip(s3).length === 30, 'wrap + bar markers still round-trip to 30 notes, got ' + parseStrip(s3).length);
console.log('serialize wrap smoke test OK');
"
```

Expected: only `serialize wrap smoke test OK` printed.

- [ ] **Step 3: Wire the two call sites in `Editor.jsx`**

Add to the top imports (`frontend/src/components/Editor.jsx:1-3`):

```js
import { LINE_SIZE } from '../lineWrap.js';
```

Change line 32 from:
```js
  const [text, setText] = useState(() => MUS.serialize(song.events || [], song.beats_per_bar));
```
to:
```js
  const [text, setText] = useState(() => MUS.serialize(song.events || [], song.beats_per_bar, LINE_SIZE));
```

Change line 174 (inside `applyEvents`) from:
```js
    const s = MUS.serialize(next, song.beats_per_bar);
```
to:
```js
    const s = MUS.serialize(next, song.beats_per_bar, LINE_SIZE);
```

- [ ] **Step 4: Verify in the browser — also creates the reusable test fixture**

Temporarily add the dev proxy (Global Constraints), start `npm run dev` from `frontend/`, and create/find the disposable test song:

```bash
SID=$(curl -s http://127.0.0.1:8000/api/songs/ | jq -r '.[] | select(.title=="TEST multilinea (borrar)") | .id' | head -1)
if [ -z "$SID" ]; then
  EVENTS=$(python3 -c "
import json
letters = list('CDEFGAB')
evs = [{'position': i, 'kind': 'note', 'pitch': letters[i % 7], 'accidental': None, 'octave': 4, 'duration_beats': 1.0} for i in range(30)]
print(json.dumps(evs))
")
  SID=$(curl -s -X POST http://127.0.0.1:8000/api/songs/ \
    -H "Content-Type: application/json" \
    -d "{\"title\": \"TEST multilinea (borrar)\", \"bpm\": 180, \"beats_per_bar\": 4}" \
    | jq -r '.id')
  # POST does not persist `events` (pre-existing backend behavior, out of this
  # plan's scope — confirmed in backend/songs.py's create_song(), which never
  # reads data.events). Populate events via PUT, the same way the editor's
  # own "Guardar" button does.
  curl -s -X PUT http://127.0.0.1:8000/api/songs/$SID \
    -H "Content-Type: application/json" \
    -d "{\"title\": \"TEST multilinea (borrar)\", \"bpm\": 180, \"beats_per_bar\": 4, \"events\": $EVENTS}" \
    -o /dev/null
fi
echo "Test song id: $SID"
```

Open the editor for that song in a browser (via the Compositor → click the "TEST multilinea (borrar)" card → Editar). Confirm the "Tira de notas" textarea shows the 30 notes with a line break after the 28th token (visible as a wrapped line even before Task 4's monospace CSS — the raw `\n` is there, just soft-wrapped by the browser today). Toggle "Puntillo" on the first note (this goes through `applyEvents`) and confirm the text stays wrapped after the re-render.

Revert the `vite.config.js` proxy change before committing (`git diff --stat -- frontend/vite.config.js` must be empty).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/music.js frontend/src/components/Editor.jsx
git commit -m "$(cat <<'EOF'
feat: serialize() wraps text every 28 events (D6)

parseStrip already treats \n as whitespace via /\s+/, so no parser
change is needed for the wrap to round-trip. Wires the two existing
serialize() call sites (initial load, applyEvents) to pass LINE_SIZE.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GzLJquQ5cwGmfQFYQ2DLFs
EOF
)"
```

---

### Task 3: Caret-preserving live reflow while typing

**Files:**
- Modify: `frontend/src/components/Editor.jsx:1` (imports), `:31-61` (refs), `:162-169` (`onText`), `:352-353` (textarea JSX)

**Interfaces:**
- Consumes: `LINE_SIZE`, `caretTokenCount`, `offsetForTokenCount` from `frontend/src/lineWrap.js` (Task 1); `MUS.serialize(events, beatsPerBar, wrapAt)` (Task 2).
- Produces: `textareaRef` (React ref attached to the `<textarea>`), consumed later by Task 7's auto-scroll.

- [ ] **Step 1: Import `useLayoutEffect` and the caret helpers**

Change line 1 from:
```js
import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
```
to:
```js
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, Fragment } from 'react';
```

Change the `lineWrap.js` import added in Task 2 from:
```js
import { LINE_SIZE } from '../lineWrap.js';
```
to:
```js
import { LINE_SIZE, caretTokenCount, offsetForTokenCount } from '../lineWrap.js';
```

- [ ] **Step 2: Add `textareaRef` and `pendingCaretRef`**

Add alongside the other refs (after line 45, `const fileRef = useRef(null);`):

```js
  const textareaRef = useRef(null);
  const pendingCaretRef = useRef(null);
```

- [ ] **Step 3: Rewrite `onText` to reflow live and preserve the caret**

Replace the existing `onText` (current lines 162-169):

```js
  const onText = (v) => {
    pushUndo();
    setText(v);
    const ev = MUS.reconcile(v, eventsRef.current);
    setEvents(ev);
    onPatch({ strip: v, events: ev });
    if (selRef.current >= ev.length) setSel(ev.length - 1);
  };
```

with:

```js
  const onText = (v, caretPos) => {
    pushUndo();
    const ev = MUS.reconcile(v, eventsRef.current);
    const droppedContent = ev.length < eventsRef.current.length;
    const pendingSeparator = caretPos > 0 && /\s/.test(v[caretPos - 1]);
    if (droppedContent || pendingSeparator) {
      // Two cases where reserializing right now would do more harm than good:
      //   - pendingSeparator: serialize() never emits trailing whitespace, so
      //     collapsing a bare separator the user just typed would fuse the
      //     next keystroke's character onto the previous token (see D7).
      //   - droppedContent: the raw text currently contains something
      //     ambiguous/invalid (e.g. two notes typed with no separator between
      //     them, fusing into an unparseable token) that parseStrip silently
      //     dropped, taking a previously-valid note down with it. Canonicalizing
      //     now would erase the evidence from the screen too; showing the raw
      //     text instead lets the user see the problem and fix it, matching
      //     the non-destructive behavior this editor had before Task 3 (see D7).
      // Pass the raw value through unprocessed either way and canonicalize on
      // a later keystroke once the ambiguity resolves and content is only
      // ever added, never silently lost. Clear any pending caret offset left
      // over from a prior canonicalize call that turned out to be a no-op
      // (wrapped === text, so React bails and the layout effect never fires;
      // see D9) — otherwise that stale offset would get applied to this
      // unrelated raw text once IT changes text and the effect finally runs.
      pendingCaretRef.current = null;
      setText(v);
      setEvents(ev);
      onPatch({ strip: v, events: ev });
      if (selRef.current >= ev.length) setSel(ev.length - 1);
      return;
    }
    const wrapped = MUS.serialize(ev, song.beats_per_bar, LINE_SIZE);
    pendingCaretRef.current = offsetForTokenCount(wrapped, caretTokenCount(v, caretPos));
    setText(wrapped);
    setEvents(ev);
    onPatch({ strip: wrapped, events: ev });
    if (selRef.current >= ev.length) setSel(ev.length - 1);
  };
```

**D7 (added during Task 3 execution, supersedes this step's original text):** the first version of this step reserialized unconditionally on every keystroke. That destroyed data: typing a second note via ordinary sequential keystrokes (anywhere — mid-string or at the end, even from an empty field) silently deleted the immediately preceding valid note. Root cause: `MUS.serialize` never emits trailing/pending whitespace (`parts.join(' ')`, no trailing separator), so the live reserialize right after a bare space keystroke collapsed that space away before the next letter arrived, fusing the next character onto the previous token into a two-letter string `parseToken`'s regex (`/^([A-Ga-g])([#b]?)([,']*)$/`) rejects — `parseStrip` then silently drops the whole fused token, taking the old valid note with it.

The first fix round (skip reserialize specifically when the just-typed character is whitespace) handles that case correctly — verified via `node` for both the reported end-of-text repro and a mid-string insertion case, both using the only grammatically valid way to add a note after existing content: type the separator *first*, then the letter. It left one narrower case unhandled: a keystroke that fuses onto the *previous* token with no separator at all (e.g. typing a letter directly adjacent to existing content, skipping the separator by mistake) still reserialized immediately, since that keystroke's last character isn't whitespace — silently hiding the ambiguous text (and the note it swallowed) from the screen the instant it happened, worse than this editor's pre-Task-3 behavior of leaving the raw, visibly-wrong text on screen for the user to notice and fix. Added a second guard, `droppedContent`: if reconciling the raw text produced *fewer* events than before this keystroke, something got silently dropped — skip canonicalizing so the raw (visibly wrong) text stays on screen instead of vanishing, exactly matching the pre-Task-3 fallback behavior for this unresolvable ambiguity (there is no way to distinguish "meant to extend the previous token," e.g. `D`→`Db`, which stays a single valid token and is unaffected by this guard, from "meant to start a new one and forgot the separator," e.g. `D`→`DC`, which isn't — both guards were re-verified together via `node` before this round: the correct leading-separator sequence still reaches 33 events exactly as before, and the no-separator case now leaves the ambiguous text visible instead of erasing it, self-correcting via `droppedContent` becoming false again as soon as a later keystroke both adds a separator and doesn't reduce the count).

- [ ] **Step 4: Restore the caret after each reflow**

Add this `useLayoutEffect` right after the `onText` definition:

```js
  useLayoutEffect(() => {
    if (pendingCaretRef.current == null) return;
    const pos = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const el = textareaRef.current;
    if (el) el.setSelectionRange(pos, pos);
  }, [text]);
```

- [ ] **Step 5: Wire the textarea to pass the caret position and attach the ref**

Change the textarea (current lines 352-353) from:
```jsx
            <textarea className="strip-input" value={text} onChange={(e) => onText(e.target.value)}
              spellCheck={false} placeholder="Ej.  C E G c | A, F# -" rows={2} />
```
to:
```jsx
            <textarea ref={textareaRef} className="strip-input" value={text}
              onChange={(e) => onText(e.target.value, e.target.selectionStart)}
              spellCheck={false} placeholder="Ej.  C E G c | A, F# -" />
```

(the `rows={2}` prop is dropped here — Task 4 gives `.strip-input` a fixed CSS height instead)

- [ ] **Step 6: Verify in the browser**

Re-add the temporary `vite.config.js` proxy, start `npm run dev`, open the `TEST multilinea (borrar)` song from Task 2 (find it via the songs list — same idempotent lookup curl if you need its id again — it has 30 events, and its text ends in a complete token with no trailing separator, e.g. `...F G A B |\nC D`). Click into the "Tira de notas" textarea, place the cursor at the very end of the text, and type 3 more notes **as individual sequential keystrokes, separator first**: `Space`, `C`, `Space`, `E`, `Space`, `G` — six separate keystrokes (the leading `Space` is required: the existing text has no trailing separator, so it must be typed before the first new letter, exactly as a real user would naturally type it — typing the letter first, skipping the separator, is a different and separately-covered case below). Whatever tool you use to type must not re-click/re-focus the element between keystrokes, since that can itself move the caret and mask what you're testing. After each keystroke, read the textarea's actual `value` (not just a screenshot) to confirm. Confirm:
- **The event count only grows, never shrinks.** After all 6 keystrokes the "Línea de tiempo" count must read 33 events (30 + 3), not fewer at any point along the way.
- The 29th, 30th, 31st (through 33rd) events appear on what is now line 2 of the text (a `\n` shows up right after the 28th token as soon as you cross it).
- The cursor stays right after the last character you typed at every keystroke — it must NOT jump to the start or end of the textarea while you're still typing.
- Typing an invalid character (e.g. `x`, which `parseToken` cannot parse) is dropped from the text on the very next keystroke — this is expected (D6's accepted tradeoff), not a bug.
- **Separately, the no-leading-separator case (D7's `droppedContent` guard):** reload the fixture fresh, place the cursor at the very end again, and this time type `C` directly with **no** leading space, then `Space`, then `E`. Confirm the count temporarily reads 29 after the first `C` (the pre-existing last note fuses with it into one invalid, dropped token — this is expected, not fixable, per D7's writeup: it's genuinely ambiguous input) but the raw text stays visibly on screen showing the fusion (e.g. `...A B |\nC D` immediately followed by the typed `C` with no gap) rather than silently vanishing — confirm you can still SEE what went wrong at this point, unlike before this fix round. This scenario does not need to reach any particular final count; it only needs to not hide the mistake from the screen.

Revert the `vite.config.js` proxy change before committing.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Editor.jsx
git commit -m "$(cat <<'EOF'
feat: live caret-preserving text reflow at 28 events/line (D7)

onText re-serializes on keystrokes that extend a token (needed for
the \n wrap to appear live) and restores the caret by token index
rather than raw character offset, since re-serialization can shift
whitespace. Skips reserialization on a bare separator keystroke
(D7) — serialize() never emits trailing whitespace, so collapsing
it immediately would fuse the next typed character onto the
previous token and silently drop both when parseStrip rejects the
fused token.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GzLJquQ5cwGmfQFYQ2DLFs
EOF
)"
```

---

### Task 4: `.strip-input` CSS — monospace, `white-space: pre`, fixed-height scroll

**Files:**
- Modify: `frontend/src/studio.css:327-335`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `.strip-input` whose `line-height` (28px) must stay equal to `lineWrap.js`'s `TEXT_LINE_HEIGHT_PX`, consumed by Task 7's scroll math.

- [ ] **Step 1: Replace the `.strip-input` rule**

Replace (current lines 327-335):

```css
.strip-input {
  width: 100%; min-height: 58px; resize: none; border-radius: 12px;
  background: rgba(0,0,0,0.32); border: 1px solid var(--line);
  color: var(--ink); font-size: 18px; line-height: 1.7; letter-spacing: 0.06em;
  padding: 13px 16px; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
  font-family: "Sora", monospace;
}
.strip-input:focus { border-color: rgba(233,196,106,0.45); box-shadow: 0 0 0 3px rgba(233,196,106,0.07); }
.strip-input::placeholder { color: var(--ink-faint); letter-spacing: 0.04em; }
```

with:

```css
.strip-input {
  /* line-height must match TEXT_LINE_HEIGHT_PX in lineWrap.js — used for scrollTop math */
  width: 100%; height: 150px; resize: none; border-radius: 12px;
  background: rgba(0,0,0,0.32); border: 1px solid var(--line);
  color: var(--ink); font-size: 15px; line-height: 28px; letter-spacing: 0.02em;
  padding: 13px 16px; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  white-space: pre; overflow: auto; scroll-behavior: smooth;
}
.strip-input:focus { border-color: rgba(233,196,106,0.45); box-shadow: 0 0 0 3px rgba(233,196,106,0.07); }
.strip-input::placeholder { color: var(--ink-faint); letter-spacing: 0.04em; }
.strip-input::-webkit-scrollbar { width: 8px; height: 8px; }
.strip-input::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
```

- [ ] **Step 2: Verify in the browser**

Re-add the temporary proxy, open the `TEST multilinea (borrar)` song. Confirm the textarea now uses a monospace font, does not soft-wrap mid-token (`white-space: pre` — a long line scrolls horizontally instead of wrapping by pixel width), and is a fixed 150px tall with a vertical scrollbar once there's more than ~5 lines of text (create a temporary 150-note test song only if you need to see the vertical scrollbar in action; the 30-note fixture is enough to confirm the 2-line wrap and horizontal overflow behavior). Take a screenshot for the record.

Revert the `vite.config.js` proxy change before committing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/studio.css
git commit -m "$(cat <<'EOF'
style: monospace + white-space:pre + fixed-height scroll for strip-input

Needed so text line i visually lines up with staff row i (Task 5),
and so the line has a hard boundary the browser won't soft-wrap.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GzLJquQ5cwGmfQFYQ2DLFs
EOF
)"
```

---

### Task 5: Pentagram — stacked rows, one per 28-event line

**Files:**
- Modify: `frontend/src/components/Editor.jsx:1` (imports), `:31-61` (refs), `:116-145` (starts/activeIdx), `:356-371` (staff-block JSX)
- Modify: `frontend/src/studio.css:337-356`

**Interfaces:**
- Consumes: `LINE_SIZE`, `lineOf` from `frontend/src/lineWrap.js`; `StaffPreview`, `beatToX`, `staffWidth` from `frontend/src/components/Ui.jsx` (unchanged).
- Produces: `staffRowRefs` (array ref, one DOM node per line row), `lineChunks` (array of event-array slices), `totalLines` (number) — all consumed by Task 6 (pills) and Task 7 (auto-scroll).

- [ ] **Step 1: Import `lineOf`**

Change the `lineWrap.js` import (from Task 3) from:
```js
import { LINE_SIZE, caretTokenCount, offsetForTokenCount } from '../lineWrap.js';
```
to:
```js
import { LINE_SIZE, lineOf, caretTokenCount, offsetForTokenCount } from '../lineWrap.js';
```

- [ ] **Step 2: Add `staffRowRefs`**

Add alongside `textareaRef` (from Task 3):

```js
  const staffRowRefs = useRef([]);
```

- [ ] **Step 3: Split `activeIdx` into a playing-gated value and an always-on `playheadIdx`, and compute line chunks**

Replace the existing `activeIdx` memo (current lines 142-145):

```js
  const activeIdx = useMemo(
    () => playing ? findActiveIdx(playBeat, events, starts) : -1,
    [playing, playBeat, events, starts]
  );
```

with:

```js
  const playheadIdx = useMemo(
    () => findActiveIdx(playBeat, events, starts),
    [playBeat, events, starts]
  );
  const activeIdx = playing ? playheadIdx : -1;

  const totalLines = Math.max(1, Math.ceil(events.length / LINE_SIZE));
  const lineChunks = useMemo(() => {
    const out = [];
    for (let L = 0; L < totalLines; L++) out.push(events.slice(L * LINE_SIZE, L * LINE_SIZE + LINE_SIZE));
    return out;
  }, [events, totalLines]);
  const playheadLine = playheadIdx >= 0 ? lineOf(playheadIdx) : (playBeat <= 0 ? 0 : totalLines - 1);
  const playheadLocalBeat = playBeat - (starts[playheadLine * LINE_SIZE] || 0);
```

- [ ] **Step 4: Replace the staff-block JSX with stacked rows**

Replace (current lines 356-371):

```jsx
          <div className="staff-block">
            <div className="staff-frame">
              {countdownBeat !== null && (
                <div className="countdown-overlay" key={countdownBeat}>
                  <span className="countdown-num">{countdownBeat}</span>
                </div>
              )}
              <div className="staff-scroll" ref={scrollRef}>
                <div style={{ position: "relative", width: staffWidth(events), height: "100%", minHeight: 210 }}>
                  <StaffPreview events={events} beatsPerBar={song.beats_per_bar} selectedIdx={sel} activeIdx={activeIdx} onSelect={selectAndSeek} />
                  {events.length > 0 && <div className="staff-playhead" style={{ left: beatToX(playBeat) }} />}
                </div>
              </div>
              {events.length === 0 && <div className="staff-empty">Teclea una tira de notas arriba para ver el pentagrama</div>}
            </div>
          </div>
```

with:

```jsx
          <div className="staff-block">
            <div className="staff-frame">
              {countdownBeat !== null && (
                <div className="countdown-overlay" key={countdownBeat}>
                  <span className="countdown-num">{countdownBeat}</span>
                </div>
              )}
              <div className="staff-scroll" ref={scrollRef}>
                {lineChunks.map((chunk, L) => {
                  const lineStart = L * LINE_SIZE;
                  return (
                    <div key={L} className="staff-row" ref={(el) => { staffRowRefs.current[L] = el; }}
                      style={{ position: "relative", width: staffWidth(chunk), minHeight: 210 }}>
                      <StaffPreview events={chunk} beatsPerBar={song.beats_per_bar}
                        selectedIdx={sel - lineStart} activeIdx={activeIdx - lineStart}
                        onSelect={(i) => selectAndSeek(lineStart + i)} />
                      {chunk.length > 0 && L === playheadLine && (
                        <div className="staff-playhead" style={{ left: beatToX(playheadLocalBeat) }} />
                      )}
                    </div>
                  );
                })}
              </div>
              {events.length === 0 && <div className="staff-empty">Teclea una tira de notas arriba para ver el pentagrama</div>}
            </div>
          </div>
```

- [ ] **Step 5: Flip `.staff-scroll` to vertical and add `.staff-row`**

Replace (current lines 337-356):

```css
/* staff preview */
.staff-block { flex: 1; min-height: 0; margin-top: 18px; display: flex; flex-direction: column; }
.staff-frame {
  flex: 1; min-height: 150px; position: relative; border-radius: 16px; overflow: hidden;
  background: radial-gradient(140% 130% at 16% -10%, #161320 0%, var(--card-1) 44%, var(--card-2) 100%);
  border: 1px solid var(--gold-line);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 20px 50px -30px rgba(0,0,0,0.8);
}
.staff-scroll { position: absolute; inset: 0; overflow-x: auto; overflow-y: hidden; }
.staff-scroll::-webkit-scrollbar { height: 8px; }
.staff-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
.staff-empty {
  position: absolute; inset: 0; display: grid; place-items: center; text-align: center;
  color: var(--ink-faint); font-size: 13.5px; pointer-events: none;
}
.staff-playhead {
  position: absolute; top: 14%; height: 72%; width: 3px; border-radius: 3px; z-index: 5; pointer-events: none;
  background: linear-gradient(180deg, rgba(255,224,150,0) 0%, var(--gold) 16%, #fff4d6 50%, var(--gold) 84%, rgba(255,224,150,0) 100%);
  box-shadow: 0 0 18px rgba(255,221,140,0.8), 0 0 40px rgba(233,196,106,0.36);
}
```

with:

```css
/* staff preview */
.staff-block { flex: 1; min-height: 0; margin-top: 18px; display: flex; flex-direction: column; }
.staff-frame {
  flex: 1; min-height: 150px; position: relative; border-radius: 16px; overflow: hidden;
  background: radial-gradient(140% 130% at 16% -10%, #161320 0%, var(--card-1) 44%, var(--card-2) 100%);
  border: 1px solid var(--gold-line);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 20px 50px -30px rgba(0,0,0,0.8);
}
.staff-scroll { position: absolute; inset: 0; overflow: auto; scroll-behavior: smooth; padding: 6px; }
.staff-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.staff-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
.staff-row + .staff-row { margin-top: 6px; }
.staff-empty {
  position: absolute; inset: 0; display: grid; place-items: center; text-align: center;
  color: var(--ink-faint); font-size: 13.5px; pointer-events: none;
}
.staff-playhead {
  position: absolute; top: 14%; height: 72%; width: 3px; border-radius: 3px; z-index: 5; pointer-events: none;
  background: linear-gradient(180deg, rgba(255,224,150,0) 0%, var(--gold) 16%, #fff4d6 50%, var(--gold) 84%, rgba(255,224,150,0) 100%);
  box-shadow: 0 0 18px rgba(255,221,140,0.8), 0 0 40px rgba(233,196,106,0.36);
}
```

**Design note:** `.staff-scroll` is a single 2-axis scroll container (both `overflow-x` and `overflow-y` auto), not one vertical container with independently-scrolling rows — a per-row `overflow-x: auto` combined with the row's own inline `width: staffWidth(chunk)` would never actually overflow *itself* (its width already equals its content's natural width), so the real horizontal clipping would happen invisibly at whatever ancestor has `overflow-x: hidden`, cropping wide lines instead of letting them scroll. Keeping one shared 2-axis scroll container avoids that trap. It also means horizontal scroll position is shared across rows — scrolling right moves every row in lockstep, which is fine (Task 7 only actively drives it for the currently-playing row; other rows briefly showing blank space past their shorter content during that is a harmless, unnoticed visual artifact).

- [ ] **Step 6: Verify in the browser**

Re-add the temporary proxy, open the `TEST multilinea (borrar)` song (30 events → 2 rows). Confirm:
- Two SVG staff rows are stacked vertically, with a vertical scrollbar on the `.staff-frame`.
- Clicking a notehead in row 2 highlights it gold (`.nh.sel`) in row 2 only — row 1 shows no selection highlight.
- The gold playhead marker appears in exactly one row (the one containing the current seek/playback position) and moves to row 2 when you click a note there.

Revert the `vite.config.js` proxy change before committing.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Editor.jsx frontend/src/studio.css
git commit -m "$(cat <<'EOF'
feat: render pentagram as stacked 28-event rows with vertical scroll

StaffPreview needed no changes — it already takes an arbitrary events
slice. Splits activeIdx into a playing-gated value and an always-on
playheadIdx so the playhead marker keeps working while paused.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GzLJquQ5cwGmfQFYQ2DLFs
EOF
)"
```

---

### Task 6: Pills panel — scoped to one line

**Files:**
- Modify: `frontend/src/components/Editor.jsx:31-43` (state), `:63-79` (effects area), `:373-397` (timeline JSX)

**Interfaces:**
- Consumes: `LINE_SIZE`, `lineOf` (Task 1/5); `totalLines` (Task 5).
- Produces: `visibleLine` (state, the line currently shown in the pills panel) — not consumed elsewhere, this is a leaf feature.

- [ ] **Step 1: Add `visibleLine` state and the effect that drives it**

Add alongside `canUndo` (current line 43):
```js
  const [visibleLine, setVisibleLine] = useState(0);
```

Add a new effect near the other small effects (after the `wasSavingRef` effect, current lines 72-79):
```js
  useEffect(() => {
    if (playing) { setVisibleLine(lineOf(activeIdx)); return; }
    if (sel >= 0) setVisibleLine(lineOf(sel));
  }, [playing, activeIdx, sel]);
```

- [ ] **Step 2: Clamp and use `visibleLine` in the timeline JSX**

Replace the `tl-head` count span and the pills block (current lines 373-397):

```jsx
          <div className="timeline">
            <div className="tl-head">
              <span className="lbl">Línea de tiempo</span>
              <span className="count">{events.length} evento{events.length === 1 ? "" : "s"} · {(+total.toFixed(2))} tiempos</span>
            </div>
            <div className="pills">
              {events.map((ev, i) => {
                const cls = "pill" + (i === sel ? " sel" : "") + (i === activeIdx ? " active" : "") + (ev.isRest ? " rest" : "");
                return (
                  <Fragment key={i}>
                    {i > 0 && barStarts.has(i) && <div className="tl-bar-sep" />}
                    <button className={cls} onClick={() => selectAndSeek(i)}>
                      {ev.dotted && <span className="badge">·</span>}
                      {ev.triplet && <span className="badge" style={{ right: ev.dotted ? 12 : -6 }}>3</span>}
                      {ev.isRest
                        ? <span className="pname" style={{ color: "var(--ink-faint)", fontFamily: "var(--music)", fontSize: 22 }}>{MUS.restGlyph(ev)}</span>
                        : <span className="pname">{ev.letter}{ev.acc && <sup>{ev.acc === "#" ? "♯" : "♭"}</sup>}</span>}
                      <span className="pglyph">{MUS.durGlyph(ev)}</span>
                      <span className="pdur">{ev.isRest ? "silencio" : MUS.LADDER[MUS.LADDER_INDEX[ev.base ?? "4"]].name.slice(0, 7)}</span>
                    </button>
                  </Fragment>
                );
              })}
              {events.length === 0 && <div style={{ color: "var(--ink-faint)", fontSize: 13, padding: "22px 4px" }}>Sin eventos todavía.</div>}
            </div>
```

with:

```jsx
          <div className="timeline">
            <div className="tl-head">
              <span className="lbl">Línea de tiempo</span>
              <span className="count">Línea {clampedLine + 1}/{totalLines} · {events.length} evento{events.length === 1 ? "" : "s"} · {(+total.toFixed(2))} tiempos</span>
            </div>
            <div className="pills">
              {events.slice(clampedLine * LINE_SIZE, clampedLine * LINE_SIZE + LINE_SIZE).map((ev, i) => {
                const globalIdx = clampedLine * LINE_SIZE + i;
                const cls = "pill" + (globalIdx === sel ? " sel" : "") + (globalIdx === activeIdx ? " active" : "") + (ev.isRest ? " rest" : "");
                return (
                  <Fragment key={globalIdx}>
                    {i > 0 && barStarts.has(globalIdx) && <div className="tl-bar-sep" />}
                    <button className={cls} onClick={() => selectAndSeek(globalIdx)}>
                      {ev.dotted && <span className="badge">·</span>}
                      {ev.triplet && <span className="badge" style={{ right: ev.dotted ? 12 : -6 }}>3</span>}
                      {ev.isRest
                        ? <span className="pname" style={{ color: "var(--ink-faint)", fontFamily: "var(--music)", fontSize: 22 }}>{MUS.restGlyph(ev)}</span>
                        : <span className="pname">{ev.letter}{ev.acc && <sup>{ev.acc === "#" ? "♯" : "♭"}</sup>}</span>}
                      <span className="pglyph">{MUS.durGlyph(ev)}</span>
                      <span className="pdur">{ev.isRest ? "silencio" : MUS.LADDER[MUS.LADDER_INDEX[ev.base ?? "4"]].name.slice(0, 7)}</span>
                    </button>
                  </Fragment>
                );
              })}
              {events.length === 0 && <div style={{ color: "var(--ink-faint)", fontSize: 13, padding: "22px 4px" }}>Sin eventos todavía.</div>}
            </div>
```

Immediately above this JSX block (right after the `refIdx`/`refNote`/`refKeys`/`beatInBar` derived-value lines, current lines 284-287), add:
```js
  const clampedLine = Math.min(visibleLine, totalLines - 1);
```

- [ ] **Step 3: Verify in the browser**

Re-add the temporary proxy, open the `TEST multilinea (borrar)` song. Confirm:
- The pills panel shows only 28 pills initially (line 1), with the header reading "Línea 1/2".
- Clicking a notehead in staff row 2 switches the pills panel to show only that line's 2 pills, header reading "Línea 2/2".
- Clicking a pill still edits duration/puntillo/tresillo/borrar for the right note (check the dur-bar reflects the right note name).

Revert the `vite.config.js` proxy change before committing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Editor.jsx
git commit -m "$(cat <<'EOF'
feat: scope pills panel to one line (D4)

Follows sel while paused, activeIdx while playing, and otherwise
keeps showing the last line the user interacted with.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GzLJquQ5cwGmfQFYQ2DLFs
EOF
)"
```

---

### Task 7: Auto-scroll both panels when playback crosses a line

**Files:**
- Modify: `frontend/src/components/Editor.jsx:1` (imports), `:31-61` (refs), `:203-256` (rAF effect)

**Interfaces:**
- Consumes: `TEXT_LINE_HEIGHT_PX`, `LINE_SIZE`, `lineOf` (Task 1); `textareaRef` (Task 3); `staffRowRefs` (Task 5).
- Produces: nothing consumed elsewhere — this is the last piece of D5.

- [ ] **Step 1: Import `TEXT_LINE_HEIGHT_PX`**

Change the `lineWrap.js` import (from Task 5) from:
```js
import { LINE_SIZE, lineOf, caretTokenCount, offsetForTokenCount } from '../lineWrap.js';
```
to:
```js
import { LINE_SIZE, TEXT_LINE_HEIGHT_PX, lineOf, caretTokenCount, offsetForTokenCount } from '../lineWrap.js';
```

- [ ] **Step 2: Add `prevLineRef`**

Add alongside `prevActiveIdxRef` (current line 58):
```js
  const prevLineRef = useRef(-1);
```

- [ ] **Step 3: Replace the note-crossing + old horizontal-scroll tail of the rAF loop**

Inside the rAF effect (current lines 203-256), replace this block (current lines 236-250):

```js
        const newIdx = findActiveIdx(beatRef.current, evs, st);
        if (newIdx !== prevActiveIdxRef.current) {
          prevActiveIdxRef.current = newIdx;
          if (newIdx >= 0 && !evs[newIdx].isRest && playingRef.current) {
            const durSec = MUS.durBeats(evs[newIdx]) * 60 / (bpmRef.current * speedRef.current);
            Audio.playNote(evs[newIdx], durSec);
          }
        }
        setPlayBeat(beatRef.current);
        const sc = scrollRef.current;
        if (sc) {
          const x = beatToX(beatRef.current);
          const target = x - sc.clientWidth * 0.45;
          if (Math.abs(sc.scrollLeft - target) > 2) sc.scrollLeft = Math.max(0, target);
        }
```

with:

```js
        const newIdx = findActiveIdx(beatRef.current, evs, st);
        if (newIdx !== prevActiveIdxRef.current) {
          prevActiveIdxRef.current = newIdx;
          if (newIdx >= 0 && !evs[newIdx].isRest && playingRef.current) {
            const durSec = MUS.durBeats(evs[newIdx]) * 60 / (bpmRef.current * speedRef.current);
            Audio.playNote(evs[newIdx], durSec);
          }
        }
        setPlayBeat(beatRef.current);

        const newLine = newIdx >= 0 ? lineOf(newIdx) : prevLineRef.current;
        if (newLine !== prevLineRef.current && newLine >= 0) {
          prevLineRef.current = newLine;
          const ta = textareaRef.current;
          if (ta) ta.scrollTop = TEXT_LINE_HEIGHT_PX * newLine;
          const rowEl = staffRowRefs.current[newLine];
          if (rowEl) rowEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        const activeLine = newLine >= 0 ? newLine : 0;
        const sc = scrollRef.current;
        if (sc) {
          const lineStartBeat = st[activeLine * LINE_SIZE] || 0;
          const localX = beatToX(beatRef.current - lineStartBeat);
          const target = localX - sc.clientWidth * 0.45;
          if (Math.abs(sc.scrollLeft - target) > 2) sc.scrollLeft = Math.max(0, target);
        }
```

Note: `st` (not the outer `starts` memo) is used deliberately — the rest of this effect already reads the freshly-recomputed local `st`/`evs` rather than the memoized outer values, since the effect has an empty dependency array and relies on refs for freshness. `scrollRef` is the same single 2-axis `.staff-scroll` container from Task 5 — horizontal follow now drives its `scrollLeft` directly (mirroring the pre-multiline code's `sc.scrollLeft` pattern), since rows don't have their own independent horizontal scroll (see Task 5's design note).

- [ ] **Step 4: Verify in the browser**

Re-add the temporary proxy, open the `TEST multilinea (borrar)` song (30 notes, 180 BPM → line 1 takes 28 beats ≈ 9.3s at BPM 180 with speed 1.0 — set the speed slider to 1.0× and toggle "1-2-3-4" (skip countdown) on for a faster test loop). Click the play button, let it run past the 28th note, and confirm:
- The textarea auto-scrolls so line 2 becomes visible right when the 29th note starts sounding.
- The staff view auto-scrolls (or is already positioned, if it fit) so row 2 is visible at the same moment.
- The gold playhead marker and the horizontal scroll continue to track the currently-sounding note within its row exactly as they did within a single line before this change.

Revert the `vite.config.js` proxy change before committing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Editor.jsx
git commit -m "$(cat <<'EOF'
feat: auto-scroll text + staff panels on line crossing during playback (D5)

Detects the line change inside the existing rAF clock (no new timer)
and scrolls the textarea by line-height*line, plus scrollIntoView on
the newly-active staff row. Horizontal within-row follow keeps using
scrollRef, now computed against the active row's local beat offset.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GzLJquQ5cwGmfQFYQ2DLFs
EOF
)"
```

---

### Task 8: Full integration pass, lint/build, cleanup

**Files:** none expected to change unless verification surfaces a bug (if so, fix in the relevant file from Tasks 1-7 and note it below).

**Interfaces:** none — this task only verifies and cleans up.

- [ ] **Step 1: Lint and build**

```bash
cd /data/saxhero/frontend
npm run lint
npm run build
```

Expected: `npm run lint` shows the same 8 pre-existing errors as before this feature (in `SongList.jsx` and `Ui.jsx`, unrelated to this work — confirmed via `git stash` comparison earlier this project) and **zero new errors** in `Editor.jsx`, `music.js`, or `lineWrap.js`. `npm run build` must exit 0.

- [ ] **Step 2: Full manual walkthrough**

Re-add the temporary proxy, start `npm run dev`, open the `TEST multilinea (borrar)` song (find via title if the id from earlier tasks was lost) and walk through, in order:
1. Type a few more notes past the current end — confirm live wrap + caret behavior (Task 3) still holds.
2. Click a note in line 2's pentagram row — confirm the pills panel (Task 6) and the text caret both make sense for that note.
3. Toggle "Puntillo"/"Tresillo" on a note in line 2 — confirm it applies to the right note (not shifted by the line offset).
4. Insert a rest early in line 1 so the total event count grows past a line boundary — confirm everything downstream (line 2's content, pills, staff row 2) reflows automatically, per D2's promise that reordering is free.
5. Play from the start with speed 1.0× and skip-countdown on — confirm the full D5 auto-scroll behavior across the line crossing, and that audio still plays the correct notes in order (no note skipped/doubled at the boundary).

If any step reveals a bug, fix it in the appropriate file from Tasks 1-7, re-run `npm run lint`, and commit the fix with a `fix:` message referencing which task's behavior it corrects.

- [ ] **Step 3: Clean up the disposable test song**

```bash
SID=$(curl -s http://127.0.0.1:8000/api/songs/ | jq -r '.[] | select(.title=="TEST multilinea (borrar)") | .id' | head -1)
if [ -n "$SID" ]; then curl -s -X DELETE http://127.0.0.1:8000/api/songs/$SID -o /dev/null -w "deleted %{http_code}\n"; fi
```

Expected: `deleted 204` (or the app's actual success code — check `backend/songs.py`'s DELETE route if this doesn't match).

- [ ] **Step 4: Confirm `vite.config.js` is clean and commit any fixes**

```bash
git diff --stat -- frontend/vite.config.js
```

Expected: empty output. If this task's Step 2 produced fixes, they should already be committed from Step 2; otherwise there is nothing to commit for this task.

---

## Self-Review Notes

- **Spec coverage:** D1 (Task 1's `LINE_SIZE`) · D2 (no persistence anywhere — verified `strip` isn't in the backend, confirmed again in Global Constraints) · D6/D3-superseded (Tasks 2-4, single textarea + `\n` wrap) · pentagram reflow (Task 5) · D4 pills (Task 6) · D5 auto-scroll (Task 7). All spec sections have a task.
- **Placeholder scan:** no TBD/TODO; every step has literal code or a literal verification command.
- **Type/name consistency checked:** `LINE_SIZE`, `TEXT_LINE_HEIGHT_PX`, `lineOf`, `caretTokenCount`, `offsetForTokenCount` (from `lineWrap.js`), `playheadIdx`, `activeIdx`, `totalLines`, `lineChunks`, `playheadLine`, `playheadLocalBeat`, `staffRowRefs`, `textareaRef`, `pendingCaretRef`, `prevLineRef`, `visibleLine`, `clampedLine` are spelled identically everywhere they're introduced and later consumed across Tasks 1, 3, 5, 6, 7.
