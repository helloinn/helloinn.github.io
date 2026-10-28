# taxipic

## Pi Studio domain

Use `https://taxipic.fr` as the app URL in Pi Studio. A browser may display the
root URL with a trailing `/`; both spellings identify the same root resource.
Changing a domain name does not remove that browser behavior.

The `CNAME` file configures GitHub Pages only. To serve this domain from Netlify:

1. In [Netlify domain management](https://app.netlify.com/projects/taxipic/domain-management),
   add `taxipic.fr` as a production domain and set it as the primary domain.
2. At the domain's DNS provider, replace the GitHub Pages apex A records with
   the external DNS records shown by Netlify. If the provider supports apex
   ALIAS or ANAME records, Netlify's target is `apex-loadbalancer.netlify.com`.
   Otherwise, use the A record specified by Netlify's domain setup screen.
3. Wait for DNS verification and an active HTTPS certificate in Netlify.
4. Ensure production is publicly accessible under Netlify's visitor access
   settings so Pi Studio can fetch the app and validation file.
5. Set the Pi Studio app URL to `https://taxipic.fr`. Confirm that both
   `https://taxipic.fr/pi-app-validation.txt` and
   `https://taxipic.fr/pi-app-validation.txt/` return HTTP 200 directly, with
   the expected validation file contents and no `Location` redirect header.

`public/_redirects` already rewrites both validation URL variants directly to
the same file. These rules take effect when Netlify serves the custom domain;
they do not affect a domain that still points to GitHub Pages.
