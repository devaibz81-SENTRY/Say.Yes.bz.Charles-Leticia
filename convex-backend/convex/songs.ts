import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { json } from "./auth";

export const listSongsHttp = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const songs = await ctx.runQuery(internal.db.listSongs);
  return json(
    songs.map((s) => ({
      id: s._id,
      title: s.title,
      artist: s.artist || "",
      requested_by: s.requested_by || "",
      votes: s.votes,
      createdAt: s.createdAt,
    }))
  );
});

export const createSongHttp = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return json({ error: "Missing title" }, 400);

  const result = await ctx.runMutation(internal.db.createSong, {
    title,
    artist: body.artist ? String(body.artist) : undefined,
    requested_by: body.requested_by ? String(body.requested_by) : undefined,
    deviceId: body.deviceId ? String(body.deviceId) : undefined,
  });
  return json(result);
});

export const voteSongHttp = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await request.json().catch(() => ({}));
  const songId = body.songId;
  if (!songId) return json({ error: "Missing songId" }, 400);

  try {
    const result = await ctx.runMutation(internal.db.voteSong, {
      songId,
      deviceId: body.deviceId ? String(body.deviceId) : undefined,
    });
    return json(result);
  } catch (err: any) {
    if (err && String(err.message).includes("Song not found")) {
      return json({ error: "Song not found" }, 404);
    }
    throw err;
  }
});
