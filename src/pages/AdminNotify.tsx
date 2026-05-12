import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  ok: boolean;
  sent?: number;
  total?: number;
  removed?: number;
  error?: string;
  startedAt: string;
  ms: number;
};

export default function AdminNotify() {
  const [broadcast, setBroadcast] = useState(false);
  const [mobile, setMobile] = useState("");
  const [title, setTitle] = useState("Test notification");
  const [body, setBody] = useState("Hello from Mera Rashan 👋");
  const [url, setUrl] = useState("/");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const send = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!broadcast && !mobile.trim()) {
      toast.error("Enter a mobile number or enable broadcast");
      return;
    }
    setBusy(true);
    setResult(null);
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    try {
      const payload: Record<string, unknown> = { title, body, url };
      if (!broadcast) payload.mobile = mobile.trim();

      const { data, error } = await supabase.functions.invoke("send-push", { body: payload });
      const ms = Math.round(performance.now() - t0);

      if (error) throw error;
      const d = (data || {}) as { sent?: number; total?: number; removed?: number };
      setResult({ ok: true, ...d, startedAt, ms });
      toast.success(`Sent to ${d.sent ?? 0} / ${d.total ?? 0} device(s)`);
    } catch (e: unknown) {
      const ms = Math.round(performance.now() - t0);
      const msg = e instanceof Error ? e.message : "Unknown error";
      setResult({ ok: false, error: msg, startedAt, ms });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" aria-label="Back">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Send Notification</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Broadcast to everyone</p>
              <p className="text-xs text-muted-foreground">Send to all subscribed devices</p>
            </div>
            <Switch checked={broadcast} onCheckedChange={setBroadcast} />
          </div>

          {!broadcast && (
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile number</Label>
              <Input
                id="mobile"
                placeholder="923001234567"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                inputMode="tel"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">Open URL on click</Label>
            <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <Button onClick={send} disabled={busy} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            {busy ? "Sending…" : "Send"}
          </Button>
        </Card>

        {result && (
          <Card
            className={`p-4 border ${
              result.ok ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <p className="text-sm font-semibold mb-2">
              {result.ok ? "Send result" : "Failed"}
            </p>
            {result.ok ? (
              <ul className="text-sm space-y-1">
                <li>
                  Delivered: <span className="font-medium">{result.sent ?? 0}</span> /{" "}
                  {result.total ?? 0}
                </li>
                {result.removed ? (
                  <li className="text-muted-foreground">
                    Removed {result.removed} expired subscription(s)
                  </li>
                ) : null}
                <li className="text-xs text-muted-foreground">
                  {new Date(result.startedAt).toLocaleString()} · {result.ms} ms
                </li>
              </ul>
            ) : (
              <p className="text-sm break-all text-destructive">{result.error}</p>
            )}
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Notifications only deliver in the published app. iOS requires the PWA installed to home screen.
        </p>
      </main>
    </div>
  );
}
