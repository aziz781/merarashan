import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const BASE_URL = "https://data.merarashan.pk";
const ALLOWED = new Set(["cards", "transactions", "customers", "statements"]);
const FORWARD_PARAMS = ["month", "year", "monthYear", "rcNum", "status", "customerNumber"];
const ALLOWED_METHODS = new Set(["GET", "DELETE"]);

// Only compress JSON-ish payloads above ~1KB — below that the framing
// overhead negates the gains.
const MIN_COMPRESS_BYTES = 1024;

function pickEncoding(acceptEncoding: string | null): "br" | "gzip" | null {
  if (!acceptEncoding) return null;
  const ae = acceptEncoding.toLowerCase();
  // Prefer brotli when both are offered — typically 15-25% smaller than gzip.
  if (ae.includes("br")) return "br";
  if (ae.includes("gzip")) return "gzip";
  return null;
}

async function compressBody(
  body: Uint8Array,
  encoding: "br" | "gzip",
): Promise<Uint8Array | null> {
  // Deno's CompressionStream supports "gzip" and "deflate" but not "br".
  // Fall back to gzip if brotli was requested but unsupported.
  const format = encoding === "br" ? "gzip" : encoding;
  try {
    const stream = new Response(body).body!.pipeThrough(
      new CompressionStream(format as "gzip"),
    );
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!ALLOWED_METHODS.has(req.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = Deno.env.get("MERARASHAN_API_TOKEN");
    if (!token) throw new Error("MERARASHAN_API_TOKEN not configured");

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") ?? "";
    const mobile = url.searchParams.get("mobile") ?? "";

    if (!ALLOWED.has(resource)) {
      return new Response(JSON.stringify({ error: "Invalid resource" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^\d{6,15}$/.test(mobile)) {
      return new Response(JSON.stringify({ error: "Invalid mobile number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstreamUrl = new URL(`${BASE_URL}/${resource}`);
    upstreamUrl.searchParams.set("mobile", mobile);
    for (const key of FORWARD_PARAMS) {
      const v = url.searchParams.get(key);
      if (v) upstreamUrl.searchParams.set(key, v);
    }

    // Retry on upstream throttling (DynamoDB ProvisionedThroughputExceeded) with backoff
    let upstream!: Response;
    let text = "";
    const delays = [200, 500, 1000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      upstream = await fetch(upstreamUrl.toString(), {
        method: req.method,
        headers: {
          "x-api-key": token,
          Accept: "application/json",
          // Forward the client's encoding preference so the upstream can
          // gzip its own response — saves egress on the upstream → edge hop.
          "Accept-Encoding": req.headers.get("accept-encoding") ?? "gzip",
        },
      });
      text = await upstream.text();
      const throttled =
        upstream.status === 429 ||
        (!upstream.ok && /provisioned throughput|throughput.*exceeded|throttl/i.test(text));
      if (!throttled || attempt === delays.length) break;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      // Allow the SW + browser HTTP cache to reuse responses briefly while
      // still revalidating in the background.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
      Vary: "Accept-Encoding",
    };

    const bodyBytes = new TextEncoder().encode(text);
    const wantEncoding = pickEncoding(req.headers.get("accept-encoding"));

    if (
      wantEncoding &&
      upstream.ok &&
      bodyBytes.byteLength >= MIN_COMPRESS_BYTES &&
      /json|text/i.test(contentType)
    ) {
      const compressed = await compressBody(bodyBytes, wantEncoding);
      if (compressed && compressed.byteLength < bodyBytes.byteLength) {
        responseHeaders["Content-Encoding"] = "gzip";
        responseHeaders["Content-Length"] = String(compressed.byteLength);
        return new Response(compressed, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }
    }

    return new Response(text, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
