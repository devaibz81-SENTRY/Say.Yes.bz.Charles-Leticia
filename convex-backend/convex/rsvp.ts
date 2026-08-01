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
  if (attendance !== "yes" && attendance !== "no") {
    return json({ error: "attendance must be 'yes' or 'no'" }, 400);
  }

  try {
    const result = await ctx.runMutation(internal.db.submitRsvp, {
      guestId,
      attendance,
      phone: body.phone ?? undefined,
      plus_names: body.plusNames ?? body.plus_names ?? undefined,
      song: body.song ?? undefined,
      message: body.message ?? undefined,
    });
    return json(result);
  } catch (err: any) {
    if (err && err.message === "Guest not found") return json({ error: "Guest not found" }, 404);
    throw err;
  }
});
