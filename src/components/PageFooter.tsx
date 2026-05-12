import { ShieldCheck } from "lucide-react";

declare const __BUILD_VERSION__: string;

export function PageFooter() {
  return (
    <div className="flex flex-col items-center text-center pt-6 pb-4 mt-4">
      <ShieldCheck className="w-5 h-5 text-muted-foreground mb-1" />
      <p className="text-sm font-semibold text-muted-foreground">MeraRashan.pk</p>
      <p className="text-xs text-muted-foreground">Safe and transparent service in every step of the way.</p>
      <p className="text-xs font-mono text-muted-foreground/80 mt-2 bg-muted-foreground/10 px-2 py-0.5 rounded">Build {__BUILD_VERSION__}</p>
    </div>
  );
}
