import type { NavigateFunction } from "react-router-dom";

/**
 * Hosts that are considered "this app" regardless of which environment
 * (preview, published, custom domain, native webview) the user is on.
 * Any URL pointing to one of these hosts is converted to an internal
 * client-side route so React Router handles it without a full reload.
 */
const APP_HOSTS = new Set<string>([
  "app.merarashan.pk",
  "merarashan.lovable.app",
  "id-preview--6fdf31a4-3e34-4895-b782-2f7c14c350ba.lovable.app",
  "6fdf31a4-3e34-4895-b782-2f7c14c350ba.lovableproject.com",
  // Capacitor native webview origins
  "localhost",
]);

/**
 * Known top-level routes inside the SPA. Used as a safety net so a payload
 * like "rashans/detail/123" or a stray "https://example.com/rashans/detail/123"
 * still resolves to the matching client-side route.
 */
const KNOWN_ROUTE_PREFIXES = [
  "/",
  "/cards",
  "/rashans",
  "/statements",
  "/transactions",
  "/customers",
  "/notifications",
  "/admin",
  "/dev",
];

function isKnownRoute(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return KNOWN_ROUTE_PREFIXES.some(
    (p) => path === p || path.startsWith(p === "/" ? "/" : `${p}/`) || path.startsWith(`${p}?`) || path.startsWith(`${p}#`),
  );
}

function sanitizePath(raw: string): string {
  // Strip control characters and whitespace, collapse duplicate slashes.
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned) return "/";
  const withSlash = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return withSlash.replace(/\/{2,}/g, "/");
}

/**
 * Normalize any notification URL into an internal SPA path when possible.
 * Returns null when the URL is genuinely external and should open in a
 * browser tab. Returns "/" for unparseable inputs to avoid a blank screen.
 */
export function toInternalPath(url: string | undefined | null): string | null {
  if (url == null) return "/";
  const trimmed = String(url).trim();
  if (!trimmed) return "/";

  // Reject unsafe schemes outright.
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return "/";

  // Pure fragment or query -> stay on current route.
  if (trimmed.startsWith("#") || trimmed.startsWith("?")) {
    return `${window.location.pathname}${trimmed}`;
  }

  // Relative or root-relative path.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return sanitizePath(trimmed);
  }

  // Absolute URL: only http(s) is considered for internal routing.
  if (!/^https?:\/\//i.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "/";
  }

  const sameOrigin = parsed.origin === window.location.origin;
  const knownHost = APP_HOSTS.has(parsed.hostname);
  const path = sanitizePath(`${parsed.pathname}${parsed.search}${parsed.hash}`);

  if (sameOrigin || knownHost) return path || "/";

  // Last-resort: if an external link happens to point at one of our known
  // SPA routes, treat it as internal to avoid a hard reload to a blank page.
  if (isKnownRoute(path)) return path;

  return null;
}

export function openAppLink(url: string | undefined | null, navigate: NavigateFunction) {
  const internalPath = toInternalPath(url);
  if (internalPath != null) {
    navigate(internalPath);
    return;
  }
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
