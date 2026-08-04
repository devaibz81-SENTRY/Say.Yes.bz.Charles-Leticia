import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ---------- sessions ----------

export const getSessionByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) =>
    await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first(),
});

export const insertSession = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) =>
    await ctx.db.insert("sessions", { token, createdAt: Date.now() }),
});

export const deleteSession = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.delete(sessionId);
  },
});

// ---------- guests ----------

export const listGuests = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("guests").collect(),
});

export const getGuest = internalQuery({
  args: { guestId: v.string() },
  handler: async (ctx, { guestId }) => {
    try {
      return await ctx.db.get(guestId as Id<"guests">);
    } catch {
      return null;
    }
  },
});

export const insertGuest = internalMutation({
  args: {
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    spouse_name: v.optional(v.string()),
    guest_type: v.optional(v.string()),
    max_party: v.optional(v.number()),
    phone: v.optional(v.string()),
    deadline: v.optional(v.string()),
    attendance: v.optional(v.string()),
    easy_mode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("guests", {
      first_name: args.first_name,
      last_name: args.last_name,
      spouse_name: args.spouse_name,
      guest_type: args.guest_type ?? "single",
      max_party: args.max_party ?? 1,
      phone: args.phone,
      deadline: args.deadline,
      attendance: args.attendance ?? "invited",
      easy_mode: args.easy_mode ?? undefined,
    }),
});

export const patchGuest = internalMutation({
  args: {
    guestId: v.string(),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    spouse_name: v.optional(v.string()),
    guest_type: v.optional(v.string()),
    max_party: v.optional(v.number()),
    phone: v.optional(v.string()),
    deadline: v.optional(v.string()),
    attendance: v.optional(v.string()),
    easy_mode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const guestId = args.guestId as Id<"guests">;
    const patch: Record<string, unknown> = {};
    const keys: (keyof typeof args)[] = [
      "first_name",
      "last_name",
      "spouse_name",
      "guest_type",
      "max_party",
      "phone",
      "deadline",
      "attendance",
      "easy_mode",
    ];
    for (const key of keys) {
      if (args[key] !== undefined) patch[key] = args[key];
    }
    await ctx.db.patch(guestId, patch);
  },
});

export const deleteGuest = internalMutation({
  args: { guestId: v.string() },
  handler: async (ctx, { guestId }) => {
    try {
      await ctx.db.delete(guestId as Id<"guests">);
    } catch {
      // ignore invalid ids
    }
  },
});

// ---------- public RSVP ----------

export const submitRsvp = internalMutation({
  args: {
    guestId: v.string(),
    attendance: v.string(),
    name: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    plus_names: v.optional(v.string()),
    song: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let existing: any = null;
    try {
      existing = await ctx.db.get(args.guestId as Id<"guests">);
    } catch {
      existing = null;
    }
    if (!existing) {
      const cleanId = args.guestId.split(":")[0];
      try {
        existing = await ctx.db.get(cleanId as Id<"guests">);
      } catch {
        existing = null;
      }
    }
    if (!existing) {
      existing = await findGuestByName(ctx, args.name, args.lastName);
    }
    if (!existing) throw new Error("Guest not found");

    const attendance =
      args.attendance === "yes"
        ? "attending"
        : args.attendance === "maybe"
          ? "later"
          : "declined";

    const patch: Record<string, unknown> = { attendance };
    if (args.phone !== undefined && args.phone !== null) patch.phone = args.phone;
    if (args.plus_names !== undefined && args.plus_names !== null) patch.plus_names = args.plus_names;
    if (args.song !== undefined && args.song !== null) patch.song = args.song;
    if (args.message !== undefined && args.message !== null) patch.message = args.message;
    await ctx.db.patch(existing._id, patch);
    return { ok: true, attendance, guestId: existing._id };
  },
});

async function findGuestByName(ctx: any, name?: string, lastName?: string) {
  const first = (name || "").trim();
  const last = (lastName || "").trim();
  if (!first && !last) return null;

  const fullKey = `${first} ${last}`.replace(/\s+/g, " ").trim().toLowerCase();
  const firstKey = first.toLowerCase();

  const all = await ctx.db.query("guests").collect();
  return (
    all.find((g: any) => {
      const gFirst = (g.first_name || "").trim();
      const gLast = (g.last_name || "").trim();
      const gFull = `${gFirst} ${gLast}`.replace(/\s+/g, " ").trim().toLowerCase();
      if (fullKey && gFull === fullKey) return true;
      if (firstKey && gFirst.toLowerCase() === firstKey && (!last || gLast.toLowerCase() === last.toLowerCase())) {
        return true;
      }
      return false;
    }) || null
  );
}
