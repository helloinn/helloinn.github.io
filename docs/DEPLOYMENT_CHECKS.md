# Taxipic deployment checks — Netlify and Vercel

## What was observed on PR #11

The PR head is `Ze0ro99/Taxipic:main` and the base is `helloinn/helloinn.github.io:main`.

The fork's GitHub Actions run for the PR head completed successfully:
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`

The base repository reported failed Netlify Deploy Preview checks from two Netlify projects:
- `taxipic`
- `taxipick`

For each project, the check summaries reported failures for redirect rules, header rules and changed pages. The check summary does not expose the underlying Netlify build log to this repository, so these results alone do not prove a syntax or application-code failure.

The base repository also reported a Vercel check with `Authorization required to deploy`. That is a Vercel/GitHub integration authorization issue and cannot be repaired by changing application source code in this fork.

## Required Netlify dashboard review

A repository should normally have one intended production Netlify site connected to the correct Git repository and production branch. In the Netlify team dashboard:

1. Identify the canonical production site. This project documents `taxipic.netlify.app` as the canonical hostname.
2. Confirm the site is connected to `Ze0ro99/Taxipic` (or to the intended upstream repository if that is the deployment design).
3. Confirm the base directory is the repository root.
4. Confirm build command is `npm run build`, publish directory is `dist`, and functions directory is `netlify/functions`. These values are also declared in `netlify.toml`.
5. Review the failed deploy's full build log and the Redirects, Headers and Pages/changed-files sections.
6. If `taxipick` is an obsolete duplicate project, disconnect its repository integration or disable its Deploy Preview checks. Do not delete a production site until its domain and deployment role are confirmed.
7. Trigger a fresh Deploy Preview after saving the dashboard settings.

Do not try to fix duplicate Netlify site connections by adding site IDs or secrets to the repository. Site ownership, repository connections, domains and deploy permissions are dashboard-level settings.

## Vercel authorization

If Vercel is still an intended deployment provider, a Vercel team administrator must authorize the GitHub integration for the repository and approve access to the relevant team/project. If Vercel is not used, remove the obsolete Vercel GitHub integration/check from the repository's integration settings. A source-code commit cannot grant this permission.

## Repository configuration

- `netlify.toml` is the source-controlled build configuration.
- Netlify custom domains are managed in the Netlify dashboard.
- A root `CNAME` file is a GitHub Pages convention, not a Netlify site-domain setting. The stale `taxipick.netlify.app` CNAME was removed from this fork because it conflicted with the documented canonical hostname.
- Keep deploy credentials, Netlify tokens, Pi API keys and wallet seeds out of Git.

## Evidence required before calling deployment successful

- The latest Netlify Deploy Preview for the intended site is green.
- The deployment log shows the expected commit SHA and successful build.
- Redirect and header rule checks pass.
- The generated `dist` output contains the main app, provider portal and public validation assets.
- The deployed provider API functions are present and respond as expected.
- Pi Browser authentication and provider CRUD smoke tests pass against the preview environment.

A green GitHub Actions run is not a substitute for a successful Netlify deployment.
