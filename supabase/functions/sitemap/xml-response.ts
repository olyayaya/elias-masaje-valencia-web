// XML response helpers shared by the edge function and the test-suite.
//
// NOTE on the exact spelling of the media type: the Supabase edge gateway
// rewrites a GET response declared as the all-lowercase `application/xml`
// (and `text/xml`) to `text/plain` and adds a sandbox CSP, while HEAD keeps
// the original header. The rewrite is a literal, case-sensitive string match,
// so declaring the media type as `application/XML; charset=utf-8` survives the
// gateway untouched. Media types are case-insensitive per RFC 9110 §8.3, so
// this is the same `application/xml; charset=utf-8` for every client and
// crawler — do not "normalize" it to lowercase or GET regresses to text/plain.
export const XML_CONTENT_TYPE = "application/XML; charset=utf-8";

/** Plain object (not a Headers instance) so the runtime serializes exactly these values. */
export function xmlResponseHeaders(cacheControl: string): Record<string, string> {
  return {
    "content-type": XML_CONTENT_TYPE,
    "cache-control": cacheControl,
    "access-control-allow-origin": "*",
    "x-content-type-options": "nosniff",
  };
}

/** Binary UTF-8 body: no runtime-side text encoding or sniffing in the way. */
export function xmlResponse(xml: string, status: number, cacheControl: string): Response {
  return new Response(new TextEncoder().encode(xml), {
    status,
    headers: xmlResponseHeaders(cacheControl),
  });
}

export function errorXml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<error>${message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</error>`;
}
