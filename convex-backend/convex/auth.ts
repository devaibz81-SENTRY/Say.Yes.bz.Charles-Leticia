import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const TOKEN_PREFIX = "cl_admin_";

export function getToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const login = httpAction(async (ctx, request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  const password = body.password ?? "";
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || password !== expected) {
    return json({ error: "Invalid password" }, 401);
  }
  const token = TOKEN_PREFIX + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const sessionId = await ctx.runMutation(internal.db.insertSession, { token });
  return json({ token, sessionId });
});

export const logout = httpAction(async (ctx, request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = getToken(request);
  if (token) {
    const session = await ctx.runQuery(internal.db.getSessionByToken, { token });
    if (session) await ctx.runMutation(internal.db.deleteSession, { sessionId: session._id });
  }
  return json({ ok: true });
});

export const me = httpAction(async (ctx, request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const token = getToken(request);
  const session = token ? await ctx.runQuery(internal.db.getSessionByToken, { token }) : null;
  if (!session) return json({ error: "Unauthorized" }, 401);
  return json({ ok: true });
});
