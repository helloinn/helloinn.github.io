import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { createSession, publicUser } from "../../server/auth.js";
import { HttpError } from "../../server/http.js";
import { loginWithPi } from "../../server/pi-login.js";

export default async (req: Request) => {
  const headers = { "Cache-Control": "no-store" };
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...headers, Allow: "POST" } });
  }
  // Cross-origin pages cannot use this endpoint as an authenticated browser action.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return Response.json({ error: "Invalid origin" }, { status: 403, headers });
  }
  try {
    const result = await loginWithPi(req, async (identity) => {
      const [user] = await db.insert(users).values({ piUid: identity.uid, username: identity.username })
        .onConflictDoUpdate({ target: users.piUid, set: { username: identity.username } }).returning();
      const sessionToken = await createSession(user.id);
      return { sessionToken, user: publicUser(user) };
    });
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof HttpError ? error.message : "Unable to sign in. Please try again." },
      { status: error instanceof HttpError ? error.status : 500, headers },
    );
  }
};

export const config: Config = { path: "/api/auth/pi" };
