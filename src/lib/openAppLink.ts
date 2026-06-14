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

const FALLBACK_PATH = "/notifications";

/**
 * Known top-level routes inside the SPA. Used as a safety net so a payload
 * like "rashans/detail/123" or a stray "https://example.com/rashans/detail/123"
 * still resolves to the matching client-side route.
 */
const KNOWN_ROUTE_PREFIXES = [
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
  const pathname = path.split(/[?#]/)[0] || "/";
  if (pathname === "/") return true;
  return KNOWN_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function sanitizePath(raw: string): string {
  // Strip control characters and whitespace, collapse duplicate slashes.
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\\/g, "/");
  if (!cleaned) return "/";
  const withSlash = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return withSlash.replace(/\/{2,}/g, "/");
}

function safeKnownPath(raw: string, fallback = FALLBACK_PATH): string {
  const path = sanitizePath(raw);
  return isKnownRoute(path) ? path : fallback;
}

/**
 * Normalize any notification URL into a known internal SPA path.
 * External, unsafe, unknown, or malformed inputs fall back to the notifications
 * screen so native taps never hard-load an invalid URL and blank the app.
 */
export function toInternalPath(url: string | undefined | null, fallback = FALLBACK_PATH): string {
  if (url == null) return fallback;
  const trimmed = String(url).trim();
  if (!trimmed) return fallback;

  // Reject unsafe schemes outright.
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return fallback;

  // Pure fragment or query -> stay on current route.
  if (trimmed.startsWith("#") || trimmed.startsWith("?")) {
    return safeKnownPath(`${window.location.pathname}${trimmed}`, fallback);
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);

  // Relative or root-relative path. Protocol-relative URLs (//host/path) are
  // treated as malformed for notification navigation and safely ignored.
  if (!hasScheme) {
    if (trimmed.startsWith("//")) return fallback;
    return safeKnownPath(trimmed, fallback);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fallback;
  }

  const sameOrigin = parsed.origin === window.location.origin;
  const knownHost = APP_HOSTS.has(parsed.hostname);
  const nativeAppOrigin = ["capacitor:", "ionic:"].includes(parsed.protocol) && knownHost;
  const httpUrl = ["http:", "https:"].includes(parsed.protocol);
  const path = sanitizePath(`${parsed.pathname}${parsed.search}${parsed.hash}`);

  if (sameOrigin || knownHost || nativeAppOrigin) return safeKnownPath(path, fallback);

  // Last-resort: if an external link happens to point at one of our known
  // SPA routes, treat it as internal to avoid a hard reload to a blank page.
  if (httpUrl && isKnownRoute(path)) return path;

  return fallback;
}

export function openAppLink(url: string | undefined | null, navigate: NavigateFunction) {
  const internalPath = toInternalPath(url);
  navigate(internalPath);
}
