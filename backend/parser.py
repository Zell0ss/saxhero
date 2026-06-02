import re
from typing import Optional

BASE_OCT_UPPER = 4
BASE_OCT_LOWER = 5

_DURATION_TABLE = [
    (6.0,      "1",  True,  False),
    (4.0,      "1",  False, False),
    (8.0/3,    "1",  False, True),
    (3.0,      "2",  True,  False),
    (2.0,      "2",  False, False),
    (4.0/3,    "2",  False, True),
    (1.5,      "4",  True,  False),
    (1.0,      "4",  False, False),
    (2.0/3,    "4",  False, True),
    (0.75,     "8",  True,  False),
    (0.5,      "8",  False, False),
    (1.0/3,    "8",  False, True),
    (0.375,    "16", True,  False),
    (0.25,     "16", False, False),
    (1.0/6,    "16", False, True),
]


def parse_token(tok: str) -> Optional[dict]:
    if tok == "-":
        return {"type": "rest"}
    if tok == "|":
        return {"type": "bar"}
    m = re.match(r"^([A-Ga-g])([#b]?)([,']*)$", tok)
    if not m:
        return None
    raw_letter = m.group(1)
    letter = raw_letter.upper()
    acc_str = m.group(2) or None
    octave = BASE_OCT_UPPER if raw_letter == letter else BASE_OCT_LOWER
    for ch in m.group(3):
        octave += -1 if ch == "," else 1
    return {"type": "note", "letter": letter, "acc": acc_str, "octave": octave}


def parse_strip(text: str) -> list[dict]:
    """Parse note strip text → list of {type, letter, acc, octave} dicts."""
    out = []
    for tok in (text or "").split():
        p = parse_token(tok)
        if p and p["type"] != "bar":
            out.append(p)
    return out


def _token_for_event(ev: dict) -> str:
    if ev.get("kind") == "rest":
        return "-"
    letter: str = ev["pitch"]
    octave: int = ev["octave"]
    raw = letter.lower() if octave >= BASE_OCT_LOWER else letter
    marks = ""
    if octave > BASE_OCT_LOWER:
        marks = "'" * (octave - BASE_OCT_LOWER)
    elif octave < BASE_OCT_UPPER:
        marks = "," * (BASE_OCT_UPPER - octave)
    acc = ev.get("accidental") or ""
    if acc == "sharp":
        acc = "#"
    elif acc == "flat":
        acc = "b"
    else:
        acc = ""
    return raw + acc + marks


def serialize_events(events: list[dict], beats_per_bar: int = 4) -> str:
    """Serialize DB-format events → note strip string (pitch only, no durations)."""
    parts: list[str] = []
    acc_beats = 0.0
    for ev in events:
        parts.append(_token_for_event(ev))
        acc_beats += float(ev.get("duration_beats", 1))
        if beats_per_bar and acc_beats >= beats_per_bar - 1e-6:
            acc_beats = 0.0
            parts.append("|")
    if parts and parts[-1] == "|":
        parts.pop()
    return " ".join(parts)


def beats_to_base(beats: float) -> tuple[str, bool, bool]:
    """Reverse-map a duration in beats → (base, dotted, triplet)."""
    best = min(_DURATION_TABLE, key=lambda x: abs(x[0] - beats))
    return best[1], best[2], best[3]
