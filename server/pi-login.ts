import { HttpError } from "./http.js";

export type PiIdentity = { uid: string; username: string };

export async function verifyAccessToken(accessToken: string): Promise<PiIdentity> {
  let response: Response;
  try {
    response = await fetch("https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch {
    throw new HttpError(502, "Pi sign-in service is unavailable. Please try again.");
  }
  if (!response.ok) {
    throw new HttpError(response.status === 401 || response.status === 403 ? 401 : 502, "Pi sign-in could not be verified.");
  }
  const result = await response.json().catch(() => null);
  if (typeof result?.sessionToken !== "string" || !result.sessionToken ||
      typeof result?.user?.uid !== "string" || !result.user.uid || result.user.uid.length > 255 ||
      typeof result?.user?.username !== "string" || !result.user.username || result.user.username.length > 100) {
    throw new HttpError(502, "Pi sign-in service returned an invalid response.");
  }
  return { uid: result.user.uid, username: result.user.username };
}

// Only the verified identity reaches account/session creation, regardless of extra request fields.
export async function loginWithPi(
  req: Request,
  establishSession: (identity: PiIdentity) => Promise<unknown>,
) {
  const body = await req.json().catch(() => null);
  if (typeof body?.accessToken !== "string" || !body.accessToken.trim() || body.accessToken.length > 16384) {
    throw new HttpError(400, "A Pi access token is required.");
  }
  const identity = await verifyAccessToken(body.accessToken);
  return establishSession(identity);
}
