# Taxipic

Ride-hailing, food delivery and merchant super app for the **Pi Network**.

| | |
|---|---|
| Production URL | https://taxipic.netlify.app |
| Hosting | Netlify (site `taxipic`, branch `main`) |
| Frontend | Vite + Leaflet, Pi SDK 2.0 |
| Backend | Netlify Functions (TypeScript), Netlify Database (Postgres + Drizzle) |
| Blockchain | Pi Network (Stellar-based) via `@stellar/stellar-sdk` |

## Features

- **Pi sign-in** — Pi SDK `authenticate` → server verification → app session (`/api/auth/pi`).
- **High-accuracy GPS map** — continuous GPS (`enableHighAccuracy`), coarse-fix filtering, jitter smoothing and an accuracy circle.
- **Taxi & delivery dispatch** — nearest-captain offers (3 → 5 → 8 km), 15 s offer window, VIP priority.
- **Dynamic pricing** — distance/time fare with demand-based surge (max 2.5×).
- **Pi payments** — User-to-App (approve/complete) and App-to-User payouts.
- **Subscriptions** — VIP and Merchant monthly plans (`server/subscriptions.ts`), activated only after a completed Pi payment; renewals stack.
- **App token** — issuance script for a Taxipic token on Pi Testnet/Mainnet (`token/issue-token.mjs`).
- **Rewards** — XP, levels, badges and reputation.

## Project structure

```text
index.html              App shell (Pi SDK, sign-in, map)
pi-auth.js / pi-login.js  Client sign-in flow
map.js                  Leaflet map + GPS tracking
netlify/functions/      Serverless API endpoints
server/                 Business logic (auth, dispatch, pricing, payments, subscriptions)
db/                     Drizzle schema and client
netlify/database/       SQL migrations
token/                  App token issuance script
public/                 Static files (validation keys, headers, redirects, stellar.toml)
tests/                  Node test suite
```

## Getting started

```bash
npm install
npm run dev        # local dev server
npm test           # run tests (Node 22.13+)
npm run build      # production build -> dist/
```

## Environment variables (Netlify → Site configuration → Environment variables)

| Name | Purpose |
|---|---|
| `PI_API_KEY` | Pi Developer Portal server API key (payments, ads) |
| `PI_WALLET_PRIVATE_SEED` | App wallet seed for App-to-User payouts |
| `TOKEN_CODE`, `TOKEN_ISSUER_PUBLIC`, `TOKEN_DISTRIBUTOR_PUBLIC` | App token identifiers (public) |

Seeds and keys are **never** committed. See [`DEVELOPER_REQUIREMENTS.md`](DEVELOPER_REQUIREMENTS.md).

## Pi Studio / domain

- App URL in Pi Studio: `https://taxipic.netlify.app`
- `https://taxipic.netlify.app/pi-app-validation.txt` and `.../pi-app-validation.txt/` must both return HTTP 200 with no redirect (handled by `public/_redirects`).
- Production must be publicly accessible in Netlify visitor access settings.
- No custom domain or GitHub Pages `CNAME` is used.

## Issuing the app token

1. Create and fund two Pi Testnet accounts (issuer, distributor).
2. Set the `TOKEN_*` variables listed in `token/issue-token.mjs`.
3. `npm run token:issue` and record the printed public values.
4. Update `public/.well-known/stellar.toml`. Repeat on Mainnet only after Pi approval.

## Legal

- [Privacy policy](privacy.md)
- [Terms of service](terms.md)
