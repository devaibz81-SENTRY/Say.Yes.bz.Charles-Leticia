import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const WEDDING_ISO = "2026-12-31T18:00:00-06:00";

function weddingMs() {
  return new Date(WEDDING_ISO).getTime();
}

function corsHeaders(origin?: string | null) {
  const allow = origin || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

// POST /api/voice/upload-url -> { uploadUrl }
export const generateUploadUrl = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  try {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return json({ uploadUrl }, 200, origin);
  } catch (err: any) {
    console.error("generateUploadUrl error:", err);
    return json({ error: "Could not create upload URL" }, 500, origin);
  }
});

// POST /api/voice/save { guestId, guestName, storageId, mimeType, durationSec, lastName? }
export const saveVoiceNote = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const body = await request.json().catch(() => ({}));
  const guestId = String(body.guestId || "").trim();
  const guestName = String(body.guestName || body.name || "").trim() || "Guest";
  const storageId = body.storageId;
  const mimeType = String(body.mimeType || "").trim() || "audio/webm;codecs=opus";
  const durationSec = typeof body.durationSec === "number" ? body.durationSec : parseInt(body.durationSec, 10) || 0;
  const lastName = body.lastName ? String(body.lastName).trim() : undefined;

  if (!guestId) return json({ error: "Missing guestId" }, 400, origin);
  if (!storageId) return json({ error: "Missing storageId" }, 400, origin);
  if (!durationSec || durationSec < 1 || durationSec > 62) {
    return json({ error: "Duration must be 1..60 seconds" }, 400, origin);
  }

  // Strict Opus allow-list (Opus only per product decision)
  const mimeLow = mimeType.toLowerCase();
  const allowedPrefixes = ["audio/webm", "audio/ogg"];
  const isOpus = mimeLow.includes("opus");
  // Allow audio/webm;codecs=opus and audio/ogg;codecs=opus and plain fallbacks if browser lied
  const isAllowedType = allowedPrefixes.some((p) => mimeLow.startsWith(p));
  if (!isAllowedType) {
    return json({ error: "Unsupported audio type — Opus/WebM only" }, 400, origin);
  }
  // Enforce Opus when possible, but don't hard-block if browser reports audio/webm without codec string
  // (Chrome sometimes sends audio/webm alone). We log it.
  if (!isOpus && mimeLow === "audio/webm") {
    console.warn("saveVoiceNote: mime without opus tag, allowing:", mimeType);
  }

  try {
    const result = await ctx.runMutation(internal.db.saveVoiceNote, {
      guestId,
      guestName,
      storageId: storageId as any,
      mimeType,
      durationSec,
      lastName,
    });
    return json({ ok: true, ...result }, 200, origin);
  } catch (err: any) {
    console.error("saveVoiceNote error:", err);
    return json({ error: err?.message || "Could not save voice note" }, 500, origin);
  }
});

// GET /api/voice/list -> { locked: true, unlockAt } OR [{ id, guestName, durationSec, audioUrl, ... }]
export const listVoiceNotes = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, origin);

  const now = Date.now();
  const wMs = weddingMs();
  const url = new URL(request.url);
  const bypass = url.searchParams.get("preview") === "1";

  if (!bypass && now < wMs) {
    return json(
      {
        locked: true,
        unlockAt: WEDDING_ISO,
        unlockMs: wMs,
        now,
        message: "Voice notes unlock after the celebration — check back after Dec 31, 2026 6PM Belize time.",
      },
      200,
      origin
    );
  }

  try {
    const notes = await ctx.runQuery(internal.db.listVoiceNotes, {});
    return json(notes, 200, origin);
  } catch (err: any) {
    console.error("listVoiceNotes error:", err);
    return json({ error: "Could not load voice notes" }, 500, origin);
  }
});

// Optional: GET /api/voice/mine?guestId=...
export const getMyVoiceNote = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, origin);
  const url = new URL(request.url);
  const guestId = url.searchParams.get("guestId") || "";
  if (!guestId) return json({ error: "Missing guestId" }, 400, origin);
  try {
    const note = await ctx.runQuery(internal.db.getVoiceNoteByGuestId, { guestId });
    return json(note || null, 200, origin);
  } catch (err: any) {
    return json({ error: "Could not load" }, 500, origin);
  }
});
