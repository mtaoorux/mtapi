const PROXY_DOMAIN = "https://mtaiiirus.reenachoudhary21999.workers.dev";
const ORIGIN_DOMAIN = "https://rarestudy.in";
const ORIGIN_HOST = "rarestudy.in";

const CF_HEADERS_TO_REMOVE = [
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
];

const RESPONSE_HEADERS_TO_REMOVE = [
  "x-frame-options",
  "content-security-policy",
  "x-content-type-options",
];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Rewrite origin
    url.hostname = ORIGIN_HOST;
    url.protocol = "https:";
    url.port = "";

    // Build forwarded headers
    const forwardedFor =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "";

    // Clone and sanitize request headers
    const newHeaders = new Headers(request.headers);
    newHeaders.set("host", ORIGIN_HOST);
    newHeaders.set("x-forwarded-host", request.headers.get("host") || PROXY_DOMAIN.replace("https://", ""));
    if (forwardedFor) {
      newHeaders.set("x-forwarded-for", forwardedFor);
    }

    // Remove Cloudflare internal headers
    for (const h of CF_HEADERS_TO_REMOVE) {
      newHeaders.delete(h);
    }

    // Build fetch init — include body only for non-GET/HEAD
    const method = request.method.toUpperCase();
    const fetchInit = {
      method,
      headers: newHeaders,
      redirect: "follow",
    };

    if (method !== "GET" && method !== "HEAD") {
      fetchInit.body = request.body;
    }

    // Fetch from origin
    let originResponse;
    try {
      originResponse = await fetch(url.toString(), fetchInit);
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }

    // Build response headers
    const respHeaders = new Headers(originResponse.headers);

    for (const h of RESPONSE_HEADERS_TO_REMOVE) {
      respHeaders.delete(h);
    }
    respHeaders.set("x-proxied-by", "mtaiiirus.reenachoudhary21999.workers.dev");

    const contentType = respHeaders.get("content-type") || "";

    // Rewrite HTML body
    if (contentType.includes("text/html")) {
      let body = await originResponse.text();

      body = body
        .replaceAll(`https://rarestudy.in`, PROXY_DOMAIN)
        .replaceAll(`http://rarestudy.in`, PROXY_DOMAIN)
        .replaceAll(`//rarestudy.in`, `//mtaiiirus.reenachoudhary21999.workers.dev`);

      // Remove content-length since body size may change after rewrite
      respHeaders.delete("content-length");

      return new Response(body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: respHeaders,
      });
    }

    // Non-HTML: stream body as-is
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: respHeaders,
    });
  },
};
