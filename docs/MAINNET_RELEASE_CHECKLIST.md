# Taxipic — Testnet to Mainnet Release Checklist

## Network architecture

Pi Developer Portal fixes the network when an app is registered. A Testnet app and a Mainnet app must be registered separately; do not assume that changing a frontend setting converts one into the other.

Use separate:
- Pi Developer Portal app records and app URLs
- Server API keys
- App wallets and private seeds
- Netlify deployment contexts / secret sets
- Database environments where practical
- Test data and production data

The Platform API host used by this code is `https://api.minepi.com`. The Stellar/Horizon endpoint and network passphrase for App-to-User transactions are selected from the network returned by the Pi payment. Verify the actual payment network before signing or submitting any transaction.

## Testnet exit criteria

- [ ] Pi Testnet app registered and its development URL verified.
- [ ] Testnet Server API Key stored only in the development secret store.
- [ ] Testnet app wallet connected and funded with Test-Pi as required.
- [ ] Pi sign-in succeeds in Pi Browser; invalid access tokens fail server verification.
- [ ] User-to-App payment approve/complete/cancel flows tested with Test-Pi.
- [ ] App-to-User flow tested with a dedicated Testnet wallet.
- [ ] Payment retries and duplicate callbacks are safe and idempotent.
- [ ] Provider onboarding, CRUD, template selection and cross-provider isolation tests pass.
- [ ] Database migrations applied to a disposable Testnet database and verified.
- [ ] `npm test`, `npm run build` and CI pass.
- [ ] Logs, alerting, backup/restore and incident response are reviewed.

## Mainnet preparation

- [ ] Create a separate Mainnet app in Pi Developer Portal. Do not try to change the Testnet app's network.
- [ ] Register and verify the production App URL: `https://taxipic.netlify.app`.
- [ ] Verify `https://taxipic.netlify.app/pi-app-validation.txt` returns the exact configured validation token as plain text.
- [ ] Complete the Pi Developer Portal checklist and any required app review/approval.
- [ ] Connect the intended Mainnet app wallet and verify its public address in the portal.
- [ ] Store the Mainnet Server API Key and Mainnet wallet private seed in the production secret store only.
- [ ] Confirm the production database, backup and migration history independently of Testnet.
- [ ] Review withdrawal/payout controls, operational limits, support and refund/incident procedures.
- [ ] Confirm the production deployment is built from the reviewed commit and the expected Git branch.

## Controlled release

1. Freeze the release commit and record its SHA.
2. Take a restorable production database backup.
3. Apply only reviewed, additive migrations to the production database.
4. Deploy the reviewed commit to the production site.
5. Verify health, static validation file, API authentication and provider portal.
6. Perform a low-value Mainnet transaction only with explicit operator authorization and a verified recipient.
7. Confirm the Platform API state, Horizon transaction and application ledger agree.
8. Monitor errors and balances before opening the release to all users.

## Rollback and safety

- A code rollback does not reverse an applied database migration or a blockchain transaction.
- Keep migrations additive and use a forward-fix migration for schema corrections.
- Never reuse Testnet secrets or wallet seeds in Mainnet.
- Never commit a secret or paste it into an issue, pull request or chat.
- Never claim Mainnet readiness based solely on a successful frontend build.
- Do not automatically approve, send, cancel or delete a user payout/withdrawal during release testing.

## Current repository limitations to resolve before live launch

- A passing GitHub Actions run is required; local/source inspection is not CI evidence.
- The production database migration must be applied and verified by an authorized operator.
- Live Pi Browser authentication and both payment directions must be verified against the separate Mainnet app.
- App approval, production wallet funding and deployment are external operational steps; code changes cannot complete them on their own.
