# Changes in this update

## Fixes
- **Sign-in button did nothing**: `index.html` had its own inline `Pi.init({ sandbox: true })` and never called the server. It now uses the existing `pi-login.js` / `pi-auth.js` flow (server-verified session). Same look.
- **Map never loaded**: `map.js` used Google Maps, which wasn't loaded and was blocked by the security policy. Replaced with Leaflet (already a dependency) on CARTO tiles, which the policy already allows.
- **Conflicting domain info**: removed the `CNAME` file (pointed to a workers.dev host; the README says none is needed) and the root `_headers` (`X-Frame-Options: ALLOWALL` is invalid and conflicted with `public/_headers`).
- **Missing file**: README mentioned `public/_redirects`, which didn't exist. Added it.
- **No test command**: added `npm test`.

## Improvements
- High-accuracy GPS: continuous tracking, no cached fixes, coarse readings ignored, jitter smoothing, accuracy circle.
- `netlify.toml` with build settings only. Site name and domain are unchanged.
- `server/subscriptions.ts`: VIP and Merchant plans with stacked renewals, plus a test.
- `token/issue-token.mjs` and `public/.well-known/stellar.toml` for the app token.
- Professional `README.md` and `DEVELOPER_REQUIREMENTS.md`.

## Not changed
- Netlify site, domain, App Studio auth backend, validation keys, database schema, pricing, dispatch.
