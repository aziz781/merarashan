const formatTimestamp = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export function AppVersionInfo() {
  const versionName = __APP_VERSION_NAME__;
  const versionCode = __APP_VERSION_CODE__;
  const builtAt = formatTimestamp(__BUILD_TIMESTAMP__);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">Version</span>
        <span className="tabular-nums">
          {versionName} <span className="opacity-60">({versionCode})</span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">Built</span>
        <span className="tabular-nums">{builtAt}</span>
      </div>
    </div>
  );
}
