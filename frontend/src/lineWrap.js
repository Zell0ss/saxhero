// lineWrap.js — line-reflow helpers shared by the text editor and the staff view.
// TEXT_LINE_HEIGHT_PX must match .strip-input's `line-height` in studio.css.
export const LINE_SIZE = 28;
export const TEXT_LINE_HEIGHT_PX = 28;

export function lineOf(idx, size = LINE_SIZE) {
  return idx < 0 ? 0 : Math.floor(idx / size);
}

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
