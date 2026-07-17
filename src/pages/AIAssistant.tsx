import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageFooter } from "@/components/PageFooter";
import {
  clearMessages,
  loadMessages,
  saveMessages,
  streamChat,
  type ChatMessage,
} from "@/lib/aiChat";

const MessageMarkdown = lazy(() => import("@/components/MessageMarkdown"));

const SUGGESTIONS = [
  "How much did I spend this month?",
  "Which cards have not been delivered this month?",
  "Show a summary of my last 3 rashans.",
  "How many statements are unpaid this year?",
];

const AIAssistant = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoPromptRef = useRef<string | null>(null);
  const autoPromptFiredRef = useRef(false);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "AI Assistant — Mera Rashan";
    return () => { document.title = prevTitle; };
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => { saveMessages(messages); }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      await streamChat(
        history,
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
          );
        },
        controller.signal,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to get response";
      if (msg !== "AbortError") {
        toast.error("AI assistant failed", { description: msg });
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: `_Error: ${msg}_` }
            : m,
        ),
      );
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [messages, sending]);

  // Auto-send a prompt passed via navigation state (from home quick-action chips)
  useEffect(() => {
    const state = location.state as { prompt?: string } | null;
    if (state?.prompt && !autoPromptFiredRef.current) {
      autoPromptRef.current = state.prompt;
      // Clear state so it won't fire again on back/forward navigation
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (autoPromptRef.current && signedIn && !sending && !autoPromptFiredRef.current) {
      autoPromptFiredRef.current = true;
      const p = autoPromptRef.current;
      autoPromptRef.current = null;
      void send(p);
    }
  }, [signedIn, sending, send]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onClear = () => {
    if (sending) abortRef.current?.abort();
    clearMessages();
    setMessages([]);
  };

  if (signedIn === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <Sparkles className="w-10 h-10 text-primary mb-3" />
        <h1 className="text-lg font-semibold mb-1">AI Assistant</h1>
        <p className="text-sm text-muted-foreground mb-4">Please sign in to chat with the assistant.</p>
        <Button onClick={() => navigate("/")}>Go to sign in</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <header
        className="px-5 pt-10 pb-5 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-white/10 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-primary-foreground hover:bg-white/10"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Sparkles className="w-6 h-6 opacity-90" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">AI Assistant</h1>
            <p className="text-xs opacity-80 truncate">Ask about your rashans, statements & cards</p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="max-w-md mx-auto text-center pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Ask a question about your rashan data. Try:
            </p>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-border/60 bg-card hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap break-words"
                    : "max-w-[90%] text-sm text-foreground [&_p]:mb-2 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_a]:text-primary [&_a]:underline"
                }
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <Suspense fallback={<span className="whitespace-pre-wrap">{m.content}</span>}>
                      <MessageMarkdown>{m.content}</MessageMarkdown>
                    </Suspense>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                    </span>
                  )
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 border-t border-border/60 bg-background/95 backdrop-blur px-3 py-3"
      >
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your rashans…"
            rows={1}
            className="min-h-[44px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim()}
            aria-label="Send"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
      <PageFooter />
    </div>
  );
};

export default AIAssistant;
