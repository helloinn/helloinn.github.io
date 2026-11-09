# Provider Portal — QA Test Plan

This plan covers the provider portal at `/provider-portal.html` and the authenticated `/api/provider/*` routes.

## Test environment

- Use a dedicated Pi Testnet Developer Portal app and a non-production deployment.
- Use a disposable test database with migration `0002_provider_marketplace.sql` applied.
- Use two different Pi test accounts: Provider A and Provider B.
- Do not use production API keys, wallet seeds, customer data or live Pi.

## Automated checks

Run:

```bash
npm ci
npm test
npm run build
```

The provider regression tests verify that the provider category registry, schema/migration, portal endpoints and owner-scoped update/delete queries remain aligned.

## Manual end-to-end scenarios

### 1. Authentication and session
- Open the portal in Pi Browser using the Testnet app.
- Sign in with Provider A.
- Confirm a valid app session is created only after the server verifies the Pi access token.
- Try opening the API without a session; it must return an authentication error.
- Try an expired/invalid session; it must not reveal a catalog.

### 2. Business profile and templates
- Create a profile for each supported category: restaurant, supermarket, grocery, juice shop, bakery, pharmacy, fashion, electronics, beauty salon, barber, laundry, home services, auto service, flowers, bookstore and other.
- Verify the expected template key is returned and the matching helper text appears.
- Save valid latitude/longitude boundaries and reject out-of-range values.
- Update the profile and confirm the same provider profile is updated rather than duplicated.
- Verify logo/cover URLs are optional and use HTTPS.

### 3. Catalog lifecycle
- Add a product with a positive Pi price, category, unit, SKU and optional stock.
- Add a service for a service-oriented provider.
- Reload the page and confirm the saved items persist.
- Update item title, price, details, stock and availability.
- Disable an item and confirm it remains in the catalog but is unavailable.
- Delete an item and confirm it is removed.
- Reject zero/negative prices, invalid stock, malformed options and oversized input.

### 4. Provider isolation (critical)
- Create a profile and items for Provider A and Provider B.
- Authenticate as Provider A and attempt to PATCH or DELETE Provider B's item ID.
- The API must return not found/denied and must not alter Provider B's record.
- Confirm GET catalog returns only the current provider's profile and items.

### 5. Resilience and usability
- Test mobile widths and Arabic RTL layout.
- Test slow/offline requests and verify the UI reports failure without showing false success.
- Test missing Pi SDK outside Pi Browser; the page should explain that Pi Browser is required.
- Verify no private key or server API key appears in browser source, network responses or logs.

## Acceptance criteria

- Automated tests and production build pass.
- The migration is applied to the test database and schema checks pass.
- All supported provider categories can create and reload a profile.
- Provider A cannot read, update or delete Provider B's catalog.
- No real Pi payment or payout is triggered by provider profile/catalog tests.
- Test evidence (commit, workflow run, database migration result and screenshots) is attached to the pull request before merge.
