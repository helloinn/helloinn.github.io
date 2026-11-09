# Taxipic

<p align="center">
  <img src="public/taxipic-logo.svg" alt="Taxipic application logo" width="220">
</p>

<p align="center"><strong>Ride-hailing · Delivery · Local commerce · Pi Network</strong></p>

<p align="center">
  <a href="https://github.com/Ze0ro99/Taxipic/actions/workflows/ci.yml"><img src="https://github.com/Ze0ro99/Taxipic/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://taxipic.netlify.app"><img src="https://img.shields.io/badge/Production-taxipic.netlify.app-ffcc33" alt="Production site"></a>
</p>

Taxipic is a Pi-enabled local services platform with customer, driver and merchant workflows. The provider marketplace gives each merchant an independent business profile and category-specific catalog.

| Area | Technology |
|---|---|
| Production URL | https://taxipic.netlify.app |
| Hosting | Netlify |
| Frontend | Vite, HTML/CSS/JavaScript, Leaflet |
| Pi integration | Pi SDK 2.0 and Pi Platform API v2 |
| Backend | Netlify Functions (TypeScript) |
| Database | Netlify Database / PostgreSQL with Drizzle ORM |
| Blockchain | Pi Network Horizon via `@stellar/stellar-sdk` |

## Product capabilities

- **Pi sign-in** — Pi SDK authentication, server-side identity verification and app sessions.
- **Taxi and delivery foundation** — location-aware dispatch and captain workflows.
- **Provider marketplace** — independent merchant profiles, provider-owned catalogs and availability controls.
- **Business-specific templates** — restaurants, supermarkets, groceries, juice shops, bakeries, pharmacies, fashion, electronics, salons, barbers, laundry, home services, auto services, florists, bookstores and general providers.
- **Pi payments** — server-side payment approval/completion and App-to-User payout support. Live payments require correctly configured network-specific credentials and wallets.
- **Rewards and subscriptions** — XP, reputation and subscription foundations.

## Provider portal

Open **https://taxipic.netlify.app/provider-portal.html** after the provider portal has been deployed, or run it locally through Netlify Dev.

Each provider can:
1. Sign in using Pi Browser.
2. Create or update one business profile.
3. Select a business category and its matching catalog template.
4. Maintain products or services, Pi prices, units, stock and availability.
5. Manage only records owned by their authenticated account.

Provider API routes:
- `GET /api/provider/catalog`
- `PUT /api/provider/profile`
- `POST /api/provider/items`
- `PATCH /api/provider/items/:id`
- `DELETE /api/provider/items/:id`

All provider endpoints require an authenticated app session. Catalog mutations are scoped to the signed-in merchant.

## Local development

**Requirements:** Node.js 22.13+ and npm.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

For a local frontend plus Netlify Functions, use the Netlify CLI:

```bash
npx netlify dev
```

Configure the local database connection and development-only credentials through your local environment. Never commit `.env` files, API keys, access tokens, wallet seeds or private keys.

## Database migrations

Migration files are versioned in `netlify/database/migrations/`.

The provider marketplace migration is:

```text
netlify/database/migrations/0002_provider_marketplace.sql
```

Before applying a migration:
1. Confirm the target database and environment.
2. Take and verify a restorable database backup.
3. Apply the SQL using the database migration workflow configured for the target Netlify site. If your deployment exposes a direct PostgreSQL connection, the equivalent controlled command is:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f netlify/database/migrations/0002_provider_marketplace.sql
```

4. Verify the new columns and indexes, then run the provider portal smoke tests.
5. Never apply a production migration using Testnet credentials or an unverified database URL.

Do not manually edit an already-applied migration. Add a new numbered migration for subsequent schema changes.

## Pi Testnet and Mainnet release path

Pi Developer Portal binds an app to the network selected when that app is created. The network cannot be changed later. Maintain **two separate Pi Developer Portal apps**:

- **Testnet app:** development, QA and payment-flow testing with Test-Pi.
- **Mainnet app:** production release, connected to the production URL and production app wallet.

Recommended release sequence:

1. Register/configure the Testnet app and a distinct development URL.
2. Configure Testnet app credentials and a dedicated Testnet app wallet in the development deployment.
3. Complete authentication, U2A payment, A2U payout, cancellation, retry, database and provider-isolation tests.
4. Back up production data and apply reviewed migrations to the intended database.
5. Register/configure the separate Mainnet app in Pi Developer Portal. Verify the app URL and validation file there.
6. Configure the Mainnet Server API Key and Mainnet app wallet only in the production secret store. Do not reuse Testnet credentials.
7. Verify wallet ownership, balances, payment limits, server logs, rollback/incident procedures and Pi app approval requirements.
8. Run a controlled low-value production smoke test only after explicit operator approval.

**Important:** the code being Mainnet-capable does not mean the app is approved, deployed, funded or ready to process live Pi. Mainnet activation requires the separate Mainnet app registration, correct production secrets/wallet, production database and a verified deployment.

## Environment secrets

Set secrets in Netlify environment configuration, not in source control.

| Variable | Purpose |
|---|---|
| `PI_API_KEY` | Pi Platform server API key |
| `PI_WALLET_PRIVATE_SEED` | App wallet seed used for App-to-User payments |
| `DATABASE_URL` | PostgreSQL connection, only if required by the configured database runtime |

Use different values and wallets for Testnet and Mainnet deployments. Never place private seeds in browser code, README files, issue comments or CI logs.

## Developer test plan

See:
- [Provider portal test plan](docs/PROVIDER_PORTAL_TEST_PLAN.md)
- [Testnet-to-Mainnet release checklist](docs/MAINNET_RELEASE_CHECKLIST.md)

GitHub Actions type-checks the server/database TypeScript, runs the automated Node test suite and builds the production frontend on pushes and pull requests. Passing CI is necessary, but does not replace live Pi Browser, database migration or payment testing.

## Pi configuration

- Production app URL: `https://taxipic.netlify.app`
- Validation file: `https://taxipic.netlify.app/pi-app-validation.txt`
- Static source: `public/pi-app-validation.txt`

Verify that the URL registered in each Pi Developer Portal app matches its own deployment. The Testnet app must use its separate development URL.

## Security and legal

- Never expose `PI_API_KEY` or wallet private seeds to the client.
- Keep production and Testnet databases, secrets and app wallets isolated.
- Do not treat Test-Pi as real value.
- Review [Privacy policy](privacy.md) and [Terms of service](terms.md) before public launch.
