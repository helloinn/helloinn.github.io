export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

type Handler = (req: Request, params: Record<string, string>) => Promise<Response>;
type Route = { method: string; segments: string[]; handler: Handler };

function matchPath(segments: string[], pathname: string): Record<string, string> | null {
  const parts = pathname.replace(/\/+$/, "").split("/");
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].startsWith(":")) params[segments[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (segments[i] !== parts[i]) return null;
  }
  return params;
}

// Tiny router so each Netlify Function can serve a family of related endpoints.
export function router(routes: [method: string, path: string, handler: Handler][]) {
  const compiled: Route[] = routes.map(([method, path, handler]) => ({
    method,
    segments: path.split("/"),
    handler,
  }));

  return async (req: Request) => {
    const url = new URL(req.url);
    let pathMatched = false;
    for (const route of compiled) {
      const params = matchPath(route.segments, url.pathname);
      if (!params) continue;
      pathMatched = true;
      if (route.method !== req.method) continue;
      try {
        return await route.handler(req, params);
      } catch (error) {
        if (error instanceof HttpError) return json({ error: error.message }, error.status);
        console.error(`${req.method} ${url.pathname} failed:`, error);
        return json({ error: "Internal server error" }, 500);
      }
    }
    return json({ error: pathMatched ? "Method not allowed" : "Not found" }, pathMatched ? 405 : 404);
  };
}

export function requireNumber(value: unknown, field: string, min = -Infinity, max = Infinity): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
    throw new HttpError(400, `Invalid ${field}`);
  }
  return n;
}

export function requireString(value: unknown, field: string, maxLength = 255): string {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${field} is required`);
  return value.trim().slice(0, maxLength);
}

export function optionalString(value: unknown, maxLength = 255): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new HttpError(400, "Invalid text field");
  return value.trim().slice(0, maxLength);
}

export function requirePoint(value: unknown, field: string): { lat: number; lng: number } {
  const p = value as { lat?: unknown; lng?: unknown } | undefined;
  if (!p || typeof p !== "object") throw new HttpError(400, `${field} is required`);
  return { lat: requireNumber(p.lat, `${field}.lat`, -90, 90), lng: requireNumber(p.lng, `${field}.lng`, -180, 180) };
}

export const roundPi = (value: number) => Math.round(value * 10000) / 10000;
