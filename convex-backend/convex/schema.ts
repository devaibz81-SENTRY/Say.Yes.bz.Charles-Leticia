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
});
