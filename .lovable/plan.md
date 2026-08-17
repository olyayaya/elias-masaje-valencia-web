# Sitemap Content-Type production hotfix

## Scope
- Change only the `sitemap` Edge Function and its source/unit test.
- Return XML from success and error paths as UTF-8 binary data with a plain header object, preserving HTTP status, cache policy, CORS, and `nosniff`.
- Run the focused/full verification needed for the change, create a commit, and deploy only `sitemap`.
- Verify the public endpoint with at least three real GET requests (including cache-busting), HEAD, XML parsing and URL checks; confirm robots.txt is unchanged.

## Stop condition
If the external gateway still reports a non-XML GET Content-Type after the allowed response variants, stop without claiming success and report the captured headers.
