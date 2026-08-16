# Cloudflare Worker — sitemap proxy

Serves `https://eliasmas.es/sitemap.xml` by transparently proxying the single
sitemap generator (Supabase Edge Function). No URLs are defined here.

Upstream: `https://ukjljyrejfkyurebksqz.supabase.co/functions/v1/sitemap`

## Manual setup (Cloudflare Dashboard)

Prerequisite: the zone `eliasmas.es` is on Cloudflare (nameservers pointed at
Cloudflare) and the root record is proxied (orange cloud). DNS changes are done
by the owner — nothing here touches DNS.

1. **Workers & Pages → Create → Worker**
   - Name: `eliasmas-sitemap-proxy`
   - Deploy the placeholder, then **Edit code** and paste `worker.js` (contents
     of this folder). Save & Deploy.
2. **Worker → Settings → Domains & Routes → Add route**
   - Route: `eliasmas.es/sitemap.xml*`
   - Zone: `eliasmas.es`
   - Failure mode: `Fail open (proceed)`
3. Optional second route for the `www` host: `www.eliasmas.es/sitemap.xml*`
   (only if `www` is not already 301-redirected to the apex).
4. Verify:
   ```
   curl -sI https://eliasmas.es/sitemap.xml
   # expect: HTTP/2 200, content-type: application/xml; charset=utf-8,
   #         cache-control: public, max-age=60, x-sitemap-proxy: cloudflare-worker
   ```

## CLI alternative

```
cd infrastructure/cloudflare/sitemap-proxy
npx wrangler deploy
```

No secrets, no KV namespaces, no bindings are required.
