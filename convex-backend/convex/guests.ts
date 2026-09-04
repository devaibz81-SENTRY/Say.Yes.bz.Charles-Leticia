import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getToken, json } from "./auth";

async function hasSession(ctx: any, request: Request): Promise<boolean> {
  const token = getToken(request);
  if (!token) return false;
  const session = await ctx.runQuery(internal.db.getSessionByToken, { token });
  return !!session;
}

export const listGuests = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!(await hasSession(ctx, request))) return json({ error: "Unauthorized" }, 401);
  const guests = await ctx.runQuery(internal.db.listGuests);
  return json(guests);
});

export const upsertGuest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await hasSession(ctx, request))) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  const fields = {
    first_name: body.first_name,
    last_name: body.last_name,
    spouse_name: body.spouse_name,
    guest_type: body.guest_type,
    max_party: body.max_party,
    phone: body.phone,
    deadline: body.deadline,
    attendance: body.attendance,
    invite_sent: body.invite_sent,
  };

  if (action === "add_guest") {
    const id = await ctx.runMutation(internal.db.insertGuest, {
      ...fields,
      attendance: fields.attendance ?? "not_invited",
      guest_type: fields.guest_type ?? "single",
      max_party: fields.max_party ?? 1,
      easy_mode: body.easy_mode === true ? true : undefined,
    });
    return json({ id });
  }

  if (action === "update_guest") {
    const guestId = body.guest_id;
    if (!guestId) return json({ error: "Missing guest_id" }, 400);
    const existing = await ctx.runQuery(internal.db.getGuest, { guestId });
    if (!existing) return json({ error: "Guest not found" }, 404);

    await ctx.runMutation(internal.db.patchGuest, {
      guestId,
      ...fields,
      easy_mode: body.easy_mode !== undefined ? body.easy_mode === true : undefined,
    });
    return json({ ok: true });
  }

  if (action === "reset_not_invited") {
    const count = await ctx.runMutation(internal.db.resetAllGuestsToNotInvited);
    return json({ ok: true, count });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});

export const deleteGuest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await hasSession(ctx, request))) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId || body.guest_id;
  if (!guestId) return json({ error: "Missing guestId" }, 400);

  await ctx.runMutation(internal.db.deleteGuest, { guestId });
  return json({ ok: true });
});

export const importGuests = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await hasSession(ctx, request))) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body.guests) ? body.guests : body;
  if (!Array.isArray(rows)) return json({ error: 'Expecting JSON array of guests' }, 400);

  const results: { inserted: number; errors: any[] } = { inserted: 0, errors: [] };

  for (const [i, r] of rows.entries()) {
    try {
      const args = {
        first_name: r.first_name || r.firstName || undefined,
        last_name: r.last_name || r.lastName || undefined,
        spouse_name: r.spouse_name || r.spouseName || undefined,
        guest_type: r.guest_type || r.guestType || undefined,
        max_party: r.max_party !== undefined ? Number(r.max_party) : undefined,
        phone: r.phone || undefined,
        deadline: r.deadline || undefined,
        attendance: r.attendance || undefined,
        easy_mode: r.easy_mode === true || r.easy_mode === 'true' ? true : undefined,
      };

      await ctx.runMutation(internal.db.insertGuest, args);
      results.inserted++;
    } catch (err) {
      results.errors.push({ row: i, error: String(err) });
    }
  }

  return json(results);
});

export const markInviteSentAction = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await hasSession(ctx, request))) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const guestId = body.guestId || body.guest_id;
  if (!guestId) return json({ error: "Missing guestId" }, 400);

  const result = await ctx.runMutation(internal.db.markInviteSent, { guestId });
  return json(result);
});
