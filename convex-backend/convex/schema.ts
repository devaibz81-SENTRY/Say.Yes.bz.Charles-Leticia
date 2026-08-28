import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  guests: defineTable({
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    spouse_name: v.optional(v.string()),
    guest_type: v.optional(v.string()),
    max_party: v.optional(v.number()),
    phone: v.optional(v.string()),
    attendance: v.optional(v.string()),
    attending_count: v.optional(v.number()),
    deadline: v.optional(v.string()),
    easy_mode: v.optional(v.boolean()),
    plus_names: v.optional(v.string()),
    song: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  sessions: defineTable({
    token: v.string(),
    createdAt: v.number(),
  }).index("by_token", ["token"]),
  photo_hearts: defineTable({
    key: v.string(),
    count: v.number(),
  }).index("by_key", ["key"]),
  songs: defineTable({
    title: v.string(),
    artist: v.optional(v.string()),
    requested_by: v.optional(v.string()),
    votes: v.number(),
    voters: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }),
  voice_notes: defineTable({
    guestId: v.string(),
    guestName: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    durationSec: v.number(),
    createdAt: v.number(),
    lastName: v.optional(v.string()),
  })
    .index("by_guestId", ["guestId"])
    .index("by_createdAt", ["createdAt"]),
});
