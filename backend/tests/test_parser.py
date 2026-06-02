from parser import parse_strip, serialize_events, beats_to_base


def test_parse_note_uppercase():
    events = parse_strip("C")
    assert len(events) == 1
    assert events[0] == {"type": "note", "letter": "C", "acc": None, "octave": 4}


def test_parse_note_lowercase():
    events = parse_strip("c")
    assert len(events) == 1
    assert events[0]["octave"] == 5


def test_parse_comma_lowers_octave():
    events = parse_strip("C,")
    assert events[0]["octave"] == 3


def test_parse_apostrophe_raises_octave():
    events = parse_strip("c'")
    assert events[0]["octave"] == 6


def test_parse_sharp():
    events = parse_strip("F#")
    assert events[0]["acc"] == "#"


def test_parse_flat():
    events = parse_strip("Bb")
    assert events[0]["acc"] == "b"


def test_parse_rest():
    events = parse_strip("-")
    assert len(events) == 1
    assert events[0]["type"] == "rest"


def test_barline_ignored():
    events = parse_strip("C | E")
    assert len(events) == 2


def test_parse_multiple():
    events = parse_strip("C E G c")
    assert len(events) == 4
    assert events[3]["octave"] == 5


def test_invalid_token_skipped():
    events = parse_strip("C xyz G")
    assert len(events) == 2


def test_serialize_events_basic():
    events = [
        {"kind": "note", "pitch": "C", "accidental": None, "octave": 4, "duration_beats": 1.0},
        {"kind": "note", "pitch": "E", "accidental": None, "octave": 4, "duration_beats": 1.0},
    ]
    result = serialize_events(events, beats_per_bar=4)
    assert "C" in result and "E" in result


def test_serialize_rest():
    events = [{"kind": "rest", "pitch": None, "accidental": None, "octave": None, "duration_beats": 1.0}]
    assert serialize_events(events, beats_per_bar=4) == "-"


def test_beats_to_base_quarter():
    base, dotted, triplet = beats_to_base(1.0)
    assert base == "4" and not dotted and not triplet


def test_beats_to_base_eighth():
    base, dotted, triplet = beats_to_base(0.5)
    assert base == "8" and not dotted and not triplet


def test_beats_to_base_dotted_quarter():
    base, dotted, triplet = beats_to_base(1.5)
    assert base == "4" and dotted and not triplet
