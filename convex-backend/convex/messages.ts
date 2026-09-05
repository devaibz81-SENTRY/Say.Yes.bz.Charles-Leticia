import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { json } from "./auth";

export const listMessagesHttp = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const messages = await ctx.runQuery(internal.db.listMessages, {});
  return json(messages);
});
