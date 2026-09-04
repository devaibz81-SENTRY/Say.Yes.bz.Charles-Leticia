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
      attendance: args.attendance ?? "not_invited",
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

export const resetAllGuestsToNotInvited = internalMutation({
  args: {},
  handler: async (ctx) => {
    const guests = await ctx.db.query("guests").collect();
    let count = 0;
    for (const g of guests) {
      if (!g.attendance || g.attendance === "invited") {
        await ctx.db.patch(g._id, { attendance: "not_invited" });
        count++;
      }
    }
    return count;
  },
});

// ---------- public RSVP ----------

function normalizeText(str?: string | null): string {
  if (!str) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPhone(str?: string | null): string {
  if (!str) return "";
  return str.replace(/\D/g, "");
}

export const submitRsvp = internalMutation({
  args: {
    guestId: v.string(),
    attendance: v.string(),
    guests: v.optional(v.number()),
    name: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    plus_names: v.optional(v.string()),
    song: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let existing: any = null;

    // 1. Try finding by direct ID if valid
    if (args.guestId && !args.guestId.startsWith("guest_")) {
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
    }

    // 2. Try finding by smart name/phone matching
    if (!existing) {
      existing = await findGuestByName(ctx, args.name, args.lastName, args.phone);
    }

    const attendance =
      args.attendance === "yes"
        ? "attending"
        : args.attendance === "maybe"
          ? "later"
          : "declined";

    const requestedSeats = Math.max(1, args.guests || 1);
    const confirmedCount = attendance === "attending" ? requestedSeats : 0;

    // 3. Strict Check: If guest is not found on invitation guest list, reject RSVP.
    if (!existing) {
      return { error: "Name not found on invitation guest list. Please contact Charles & Leticia." };
    }

    // 4. Update existing guest
    const patch: Record<string, unknown> = {
      attendance,
      attending_count: confirmedCount,
    };
    if (args.phone !== undefined && args.phone !== null) patch.phone = String(args.phone).trim();
    if (args.plus_names !== undefined && args.plus_names !== null) patch.plus_names = String(args.plus_names).trim();
    if (args.song !== undefined && args.song !== null) patch.song = String(args.song).trim();
    if (args.message !== undefined && args.message !== null) patch.message = String(args.message).trim();

    await ctx.db.patch(existing._id, patch);
    return { ok: true, attendance, guestId: existing._id, isNew: false };
  },
});

async function findGuestByName(ctx: any, name?: string, lastName?: string, phone?: string) {
  const normFirst = normalizeText(name);
  const normLast = normalizeText(lastName);
  const userPhone = cleanPhone(phone);

  if (!normFirst && !normLast && !userPhone) return null;

  // If user entered full name into first name input ("John Doe", "")
  const combinedInput = `${normFirst} ${normLast}`.trim();
  const inputParts = combinedInput.split(/\s+/).filter(Boolean);

  const all = await ctx.db.query("guests").collect();

  // Try phone match first if provided (exact 7+ digits)
  if (userPhone && userPhone.length >= 7) {
    const phoneMatch = all.find((g: any) => {
      const gPhone = cleanPhone(g.phone);
      return gPhone && (gPhone === userPhone || gPhone.endsWith(userPhone) || userPhone.endsWith(gPhone));
    });
    if (phoneMatch) return phoneMatch;
  }

  // 1. Exact full name match (first + last OR spouse name)
  for (const g of all) {
    const gFirst = normalizeText(g.first_name);
    const gLast = normalizeText(g.last_name);
    const gSpouse = normalizeText(g.spouse_name);
    const gFull = `${gFirst} ${gLast}`.trim();

    if (combinedInput && (gFull === combinedInput || gSpouse === combinedInput)) {
      return g;
    }
  }

  // 2. Token overlap match (e.g. "Charles Gale" matches DB "Charles", "Gale")
  if (inputParts.length >= 2) {
    for (const g of all) {
      const gFirst = normalizeText(g.first_name);
      const gLast = normalizeText(g.last_name);
      if (inputParts.includes(gFirst) && inputParts.includes(gLast)) {
        return g;
      }
    }
  }

  // 3. First name match (when last name is empty or matches)
  if (normFirst) {
    const firstOnlyMatches = all.filter((g: any) => {
      const gFirst = normalizeText(g.first_name);
      const gSpouse = normalizeText(g.spouse_name);
      if (gFirst === normFirst) return true;
      if (gSpouse && (gSpouse === normFirst || gSpouse.startsWith(normFirst))) return true;
      return false;
    });

    if (firstOnlyMatches.length === 1) {
      return firstOnlyMatches[0];
    }
    // If multiple first names match, pick the one matching last name if given
    if (firstOnlyMatches.length > 1 && normLast) {
      const best = firstOnlyMatches.find((g: any) => normalizeText(g.last_name) === normLast);
      if (best) return best;
    }
  }

  return null;
}

// ---------- photo hearts & song requests ----------

export const getPhotoHearts = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const record = await ctx.db
      .query("photo_hearts")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return record ? record.count : 0;
  },
});

export const addPhotoHeart = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query("photo_hearts")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
      return existing.count + 1;
    } else {
      await ctx.db.insert("photo_hearts", { key, count: 1 });
      return 1;
    }
  },
});

export const listSongs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const songs = await ctx.db.query("songs").collect();
    return songs.sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
  },
});

export const createSong = internalMutation({
  args: {
    title: v.string(),
    artist: v.optional(v.string()),
    requested_by: v.optional(v.string()),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const artist = (args.artist || "").trim();
    const deviceId = args.deviceId || "";

    const existing = await ctx.db.query("songs").collect();
    const match = existing.find((s) =>
      s.title.toLowerCase() === title.toLowerCase() &&
      (artist === "" || (s.artist || "").toLowerCase() === artist.toLowerCase())
    );

    if (match) {
      if (deviceId && (match.voters || []).includes(deviceId)) {
        return { id: match._id, votes: match.votes, alreadyVoted: true };
      }
      const voters = match.voters || [];
      if (deviceId) voters.push(deviceId);
      await ctx.db.patch(match._id, { votes: match.votes + 1, voters });
      return { id: match._id, votes: match.votes + 1, alreadyVoted: false };
    }

    const newId = await ctx.db.insert("songs", {
      title: args.title,
      artist: args.artist || "Unknown Artist",
      requested_by: args.requested_by || "Guest",
      votes: 1,
      voters: deviceId ? [deviceId] : [],
      createdAt: Date.now(),
    });
    return { id: newId, votes: 1, alreadyVoted: false };
  },
});

export const voteSong = internalMutation({
  args: { songId: v.id("songs"), deviceId: v.optional(v.string()) },
  handler: async (ctx, { songId, deviceId }) => {
    const song = await ctx.db.get(songId);
    if (!song) throw new Error("Song not found");

    if (deviceId && (song.voters || []).includes(deviceId)) {
      return { votes: song.votes, alreadyVoted: true };
    }

    const voters = song.voters || [];
    if (deviceId) voters.push(deviceId);
    const updatedVotes = song.votes + 1;
    await ctx.db.patch(songId, { votes: updatedVotes, voters });
    return { votes: updatedVotes, alreadyVoted: false };
  },
});

export const deleteSong = internalMutation({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    await ctx.db.delete(songId);
    return { ok: true };
  },
});

export const listMessages = internalQuery({
  args: {},
  handler: async (ctx) => {
    const guests = await ctx.db.query("guests").collect();
    return guests
      .filter((g) => g.message && g.message.trim() !== "")
      .map((g) => ({
        id: g._id,
        name: `${g.first_name || ""} ${g.last_name || ""}`.trim() || "Anonymous Guest",
        message: g.message,
        attendance: g.attendance || "invited",
        song: g.song || null,
      }));
  },
});

export const countAttending = internalQuery({
  args: {},
  handler: async (ctx) => {
    const guests = await ctx.db.query("guests").collect();
    let confirmedSeats = 0;
    let confirmedGuests = 0;
    let totalInvited = 0;
    for (const g of guests) {
      totalInvited += g.max_party || 1;
      if (g.attendance === "attending") {
        confirmedGuests += 1;
        const seats =
          g.attending_count !== undefined && g.attending_count !== null
            ? g.attending_count
            : (g.max_party || 1);
        confirmedSeats += seats;
      }
    }
    return { confirmedSeats, confirmedGuests, totalInvited };
  },
});
