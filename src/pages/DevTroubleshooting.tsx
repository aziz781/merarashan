import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, ScrollText, MessageSquare, AlertTriangle, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageFooter } from "@/components/PageFooter";

const DevTroubleshooting = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-16">
      <header
        className="px-5 pt-10 pb-6 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-white/10 -ml-2 mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 opacity-90" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Developer Troubleshooting</h1>
            <p className="text-xs opacity-80 truncate">OTP &amp; SMS dev mode</p>
          </div>
        </div>
      </header>

      <main className="px-5 -mt-3 space-y-4">
        {/* DEV_SKIP_SMS */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              DEV_SKIP_SMS Secret
            </h2>
          </div>
          <p className="text-sm text-foreground mb-3">
            When set to <Badge variant="outline" className="font-mono">true</Badge>, the{" "}
            <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">send-otp</code>{" "}
            edge function skips Twilio and logs the OTP code instead.
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Monitor className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold">Desktop</p>
              </div>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Open <span className="text-foreground font-medium">Cloud</span> view (top nav)</li>
                <li>Go to <span className="text-foreground font-medium">Edge Functions → Secrets</span></li>
                <li>Find <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">DEV_SKIP_SMS</code> and edit its value</li>
              </ol>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Smartphone className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold">Mobile</p>
              </div>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Tap the <span className="text-foreground font-medium">…</span> icon (bottom-right, Chat mode)</li>
                <li>Open <span className="text-foreground font-medium">Cloud → Edge Functions → Secrets</span></li>
                <li>Edit <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">DEV_SKIP_SMS</code></li>
              </ol>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <Badge className="font-mono shrink-0">true</Badge>
              <span className="text-muted-foreground">Skip Twilio, log the OTP (dev mode)</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="font-mono shrink-0">false</Badge>
              <span className="text-muted-foreground">Send real SMS via Twilio (production)</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground italic">
            No redeploy needed — secret changes apply on the next function invocation.
          </p>
        </Card>

        {/* Viewing logs */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <ScrollText className="w-4 h-4 text-primary" />
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Viewing OTP Logs
            </h2>
          </div>
          <p className="text-sm text-foreground mb-3">
            With <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">DEV_SKIP_SMS=true</code>,
            the OTP appears in the <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">send-otp</code> function logs.
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Monitor className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold">Desktop</p>
              </div>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Open <span className="text-foreground font-medium">Cloud → Edge Functions</span></li>
                <li>Click <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">send-otp</code></li>
                <li>Open the <span className="text-foreground font-medium">Logs</span> tab</li>
              </ol>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Smartphone className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold">Mobile</p>
              </div>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Tap <span className="text-foreground font-medium">…</span> → <span className="text-foreground font-medium">Cloud → Edge Functions</span></li>
                <li>Tap <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">send-otp</code> → <span className="text-foreground font-medium">Logs</span></li>
              </ol>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground mb-1.5">Look for a line like:</p>
            <pre className="text-xs font-mono bg-muted/60 rounded p-2 overflow-x-auto">
              <code className="text-foreground">[DEV_SKIP_SMS] OTP for 923159600296: 123456</code>
            </pre>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-4 bg-card/90 backdrop-blur shadow-[var(--shadow-soft)] border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Notes
            </h2>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>OTP still expires in <span className="text-foreground font-medium">5 minutes</span>.</li>
            <li>Rate limit: <span className="text-foreground font-medium">3 sends per number per 10 minutes</span>.</li>
            <li>To return to production SMS, set <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">DEV_SKIP_SMS</code> to <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">false</code> or delete it.</li>
            <li>Ensure the Twilio connector remains linked and <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted">TWILIO_VERIFY_SERVICE_SID</code> is set for real SMS.</li>
          </ul>
        </Card>
      </main>
      <PageFooter />
    </div>
  );
};

export default DevTroubleshooting;
