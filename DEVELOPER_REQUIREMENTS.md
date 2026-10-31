# Taxipic — Developer Requirements Sheet

Hello developer,

The code for Taxipic is ready. To finish the launch we need the items below.
Fill in each `____` field, then send this completed file to the Netlify agent.

> **Security:** Do NOT paste secrets (API keys, wallet seeds) into GitHub, chat or email.
> Fields marked 🔒 go only into **Netlify → Site configuration → Environment variables**.
> In this file, write just "set in Netlify ✅" for those fields.

---

## 1. Project & hosting

| # | Requirement | Your value |
|---|---|---|
| 1.1 | Netlify site name (keep `taxipic`) | ____ |
| 1.2 | Production URL (keep `https://taxipic.netlify.app`) | ____ |
| 1.3 | GitHub repository and branch Netlify deploys from | ____ |
| 1.4 | Netlify Database connected? (yes/no) | ____ |
| 1.5 | Migrations applied (`netlify/database/migrations`)? (yes/no) | ____ |

## 2. Pi Developer Portal / Pi Studio

| # | Requirement | Your value |
|---|---|---|
| 2.1 | App name in Pi Developer Portal | ____ |
| 2.2 | App URL set to `https://taxipic.netlify.app`? (yes/no) | ____ |
| 2.3 | Network: Testnet or Mainnet | ____ |
| 2.4 | Validation key matches `public/pi-app-validation.txt`? (yes/no) | ____ |
| 2.5 | App Studio auth backend URL (currently `https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com`) — confirm or replace | ____ |
| 2.6 | 🔒 `PI_API_KEY` (server API key) | ____ |

## 3. App wallet (payments and payouts)

| # | Requirement | Your value |
|---|---|---|
| 3.1 | App wallet public address (G...) | ____ |
| 3.2 | 🔒 `PI_WALLET_PRIVATE_SEED` (S...) | ____ |
| 3.3 | Wallet funded with test-Pi / Pi for fees? (yes/no) | ____ |

## 4. App token

| # | Requirement | Your value |
|---|---|---|
| 4.1 | Token code (1–12 letters/numbers, e.g. `TAXI`) | ____ |
| 4.2 | Total supply | ____ |
| 4.3 | Fixed supply (lock issuer)? (yes/no) | ____ |
| 4.4 | Issuer account public key (G...) | ____ |
| 4.5 | 🔒 `TOKEN_ISSUER_SECRET` (S...) — used only when issuing | ____ |
| 4.6 | Distributor account public key (G...) | ____ |
| 4.7 | 🔒 `TOKEN_DISTRIBUTOR_SECRET` (S...) | ____ |
| 4.8 | Home domain for `stellar.toml` (default `taxipic.netlify.app`) | ____ |
| 4.9 | Issue on Testnet first, then Mainnet after Pi approval? (confirm) | ____ |

Command: `npm run token:issue` (see `token/issue-token.mjs`).

## 5. Subscriptions

| # | Requirement | Your value |
|---|---|---|
| 5.1 | VIP monthly price in Pi (current: 1) | ____ |
| 5.2 | Merchant monthly price in Pi (current: 5) | ____ |
| 5.3 | Period length in days (current: 30) | ____ |
| 5.4 | Pay subscriptions in Pi, the app token, or both? | ____ |

## 6. Protocol / PiRC

| # | Requirement | Your value |
|---|---|---|
| 6.1 | Required protocol version (requested: v28) — confirm the exact source (Pi SDK, Horizon, PiRC) | ____ |
| 6.2 | Link to the PiRC document / team instructions to follow | ____ |
| 6.3 | Smart-contract features needed beyond subscriptions/token (describe) | ____ |

## 7. Other services (optional)

| # | Requirement | Your value |
|---|---|---|
| 7.1 | EmailJS service ID / template ID (allowed in CSP) | ____ |
| 7.2 | Support email shown to users | ____ |

---

### Message to send to the Netlify agent

```text
Please complete the Taxipic setup with the values in this file:
- Keep site name "taxipic" and URL https://taxipic.netlify.app unchanged.
- Set the 🔒 environment variables in Netlify (already entered by me: ____).
- Apply the database migrations.
- Deploy branch main and confirm /pi-app-validation.txt returns 200.
- Run token issuance on Testnet with the values in section 4, then update public/.well-known/stellar.toml.
```
