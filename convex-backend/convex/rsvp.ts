import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { json } from "./auth";

export const submitRsvp = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId || body.guest_id || body.id;
  const attendance = body.attendance;
  if (!guestId) return json({ error: "Missing guestId" }, 400);
  if (attendance !== "yes" && attendance !== "no" && attendance !== "maybe") {
    return json({ error: "attendance must be 'yes', 'no' or 'maybe'" }, 400);
  }

  try {
    const result = await ctx.runMutation(internal.db.submitRsvp, {
      guestId,
      attendance,
      name: body.name ?? undefined,
      lastName: body.lastName ?? undefined,
      phone: body.phone ?? undefined,
      plus_names: body.plusNames ?? body.plus_names ?? undefined,
      song: body.song ?? undefined,
      message: body.message ?? undefined,
    });
    if (body.song && String(body.song).trim()) {
      await ctx.runMutation(internal.db.createSong, {
        title: String(body.song).trim(),
        requested_by: body.name ? String(body.name) : undefined,
      });
    }
    return json(result);
  } catch (err: any) {
    if (err && String(err.message).includes("Guest not found")) {
      return json({ error: "Guest not found" }, 404);
    }
    throw err;
  }
});

export const rsvpStatus = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(request.url);
  const guestId = url.searchParams.get("guestId") || "";
  if (!guestId) return json({ error: "Missing guestId" }, 400);

  const guest = await ctx.runQuery(internal.db.getGuest, { guestId });
  if (!guest) return json({ status: "unknown" });

  return json({
    status: guest.attendance || "invited",
    name: `${guest.first_name || ""} ${guest.last_name || ""}`.trim() || guest.spouse_name || "",
  });
});

export const rsvpCount = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const stats = await ctx.runQuery(internal.db.countAttending);
  return json(stats);
});
