const BASE = "/api";

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (r.status === 204) return null;
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${r.status} ${text}`);
  }
  return r.json();
}

export const getSongs = () => req("/songs/");
export const createSong = (data) => req("/songs/", { method: "POST", body: JSON.stringify(data) });
export const getSong = (id) => req(`/songs/${id}`);
export const updateSong = (id, data) => req(`/songs/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSong = (id) => req(`/songs/${id}`, { method: "DELETE" });
