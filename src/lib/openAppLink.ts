import type { NavigateFunction } from "react-router-dom";

const APP_HOSTS = new Set([
  "app.merarashan.pk",
  "merarashan.lovable.app",
  "id-preview--6fdf31a4-3e34-4895-b782-2f7c14c350ba.lovable.app",
  "6fdf31a4-3e34-4895-b782-2f7c14c350ba.lovableproject.com",
]);

function toInternalPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.origin === window.location.origin || APP_HOSTS.has(parsed.hostname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    }
  } catch {
    return "/";
  }

  return null;
}

export function openAppLink(url: string | undefined, navigate: NavigateFunction) {
  if (!url) return;
  const internalPath = toInternalPath(url);
  if (internalPath) {
    navigate(internalPath);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}