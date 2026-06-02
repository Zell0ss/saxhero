from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_db_connection
from parser import beats_to_base
from logger import setup_logger

log = setup_logger()
router = APIRouter(prefix="/api/songs")


class EventIn(BaseModel):
    position: int
    kind: str
    pitch: Optional[str] = None
    accidental: Optional[str] = None
    octave: Optional[int] = None
    duration_beats: float = 1.0


class SongIn(BaseModel):
    title: str = ""
    bpm: int = 100
    beats_per_bar: int = 4
    stars: int = 1
    key_name: Optional[str] = None
    cover_image: Optional[str] = None
    events: Optional[list[EventIn]] = None


def _enrich_events(raw: list[dict]) -> list[dict]:
    out = []
    for ev in raw:
        base, dotted, triplet = beats_to_base(float(ev["duration_beats"]))
        out.append({
            "position": ev["position"],
            "kind": ev["kind"],
            "pitch": ev["pitch"],
            "accidental": ev["accidental"],
            "octave": ev["octave"],
            "duration_beats": float(ev["duration_beats"]),
            "base": base,
            "dotted": dotted,
            "triplet": triplet,
        })
    return out


def _get_song_or_404(cur, song_id: int) -> dict:
    cur.execute(
        "SELECT id, title, bpm, beats_per_bar, stars, key_name, cover_image FROM songs WHERE id = %s",
        (song_id,),
    )
    song = cur.fetchone()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@router.get("/")
def list_songs():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, bpm, beats_per_bar, stars, key_name, cover_image "
                "FROM songs ORDER BY updated_at DESC"
            )
            return cur.fetchall()
    finally:
        if conn:
            conn.close()


@router.post("/", status_code=201)
def create_song(data: SongIn):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO songs (title, bpm, beats_per_bar, stars, key_name, cover_image) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (data.title, data.bpm, data.beats_per_bar, data.stars, data.key_name, data.cover_image),
            )
            song_id = cur.lastrowid
            conn.commit()
            return _get_song_or_404(cur, song_id)
    finally:
        if conn:
            conn.close()


@router.get("/{song_id}")
def get_song(song_id: int):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            song = _get_song_or_404(cur, song_id)
            cur.execute(
                "SELECT position, kind, pitch, accidental, octave, duration_beats "
                "FROM song_events WHERE song_id = %s ORDER BY position",
                (song_id,),
            )
            song["events"] = _enrich_events(cur.fetchall())
            return song
    finally:
        if conn:
            conn.close()


@router.put("/{song_id}")
def update_song(song_id: int, data: SongIn):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            _get_song_or_404(cur, song_id)
            cur.execute(
                "UPDATE songs SET title=%s, bpm=%s, beats_per_bar=%s, stars=%s, key_name=%s, cover_image=%s "
                "WHERE id=%s",
                (data.title, data.bpm, data.beats_per_bar, data.stars, data.key_name, data.cover_image, song_id),
            )
            cur.execute("DELETE FROM song_events WHERE song_id = %s", (song_id,))
            if data.events:
                for ev in data.events:
                    cur.execute(
                        "INSERT INTO song_events (song_id, position, kind, pitch, accidental, octave, duration_beats) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                        (song_id, ev.position, ev.kind, ev.pitch, ev.accidental, ev.octave, ev.duration_beats),
                    )
            conn.commit()
            return get_song(song_id)
    finally:
        if conn:
            conn.close()


@router.delete("/{song_id}", status_code=204)
def delete_song(song_id: int):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            _get_song_or_404(cur, song_id)
            cur.execute("DELETE FROM songs WHERE id = %s", (song_id,))
            conn.commit()
    finally:
        if conn:
            conn.close()
