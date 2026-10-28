# taxipic

## Production domain

Use `https://taxipic.netlify.app` as the production URL and app URL in Pi Studio. A browser may display the
root URL with a trailing `/`; both spellings identify the same root resource.
Changing a domain name does not remove that browser behavior.

Netlify serves the production deployment from the `main` branch at
`https://taxipic.netlify.app`. Keep the Netlify project name set to `taxipic`
and the default Netlify subdomain as the primary production domain. No custom
domain or GitHub Pages `CNAME` file is required.

Manage the primary domain in [Netlify domain management](https://app.netlify.com/projects/taxipic/domain-management).
Netlify also provides deployment-specific and branch URLs; these do not replace
the primary production URL.

For Pi Studio, production must be publicly accessible under Netlify's visitor
access settings so it can fetch the app and validation file. Set the Pi Studio
app URL to `https://taxipic.netlify.app` and confirm that both
`https://taxipic.netlify.app/pi-app-validation.txt` and
`https://taxipic.netlify.app/pi-app-validation.txt/` return HTTP 200 directly,
with the expected validation file contents and no `Location` redirect header.

`public/_redirects` already rewrites both validation URL variants directly to
the same file on the production domain.
