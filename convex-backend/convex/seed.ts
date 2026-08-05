import { mutation } from "./_generated/server";
import { GUESTS } from "./seedData";

export const seed = mutation(async (ctx) => {
  const existing = await ctx.db.query("guests").first();
  if (existing) {
    return { seeded: false, reason: "guests table not empty" };
  }
  let count = 0;
  for (const g of GUESTS) {
    await ctx.db.insert("guests", { ...g });
    count++;
  }
  return { seeded: true, count };
});

export const clearAllGuests = mutation(async (ctx) => {
  const all = await ctx.db.query("guests").collect();
  for (const g of all) {
    await ctx.db.delete(g._id);
  }
  return { cleared: all.length };
});

export const clearAllSongs = mutation(async (ctx) => {
  const all = await ctx.db.query("songs").collect();
  for (const s of all) {
    await ctx.db.delete(s._id);
  }
  return { cleared: all.length };
});
