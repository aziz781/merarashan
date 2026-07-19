import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, Trash2, Loader2, Menu, Plus, MessageSquare, ChevronRight, Wallet, PackageCheck, ReceiptText, ClipboardList, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageFooter } from "@/components/PageFooter";
import {
  addRecentPrompt,
  clearRecentPrompts,
  createThread,
  deleteThread,
  getThread,
  loadRecentPrompts,
  loadThreads,
  streamChat,
  updateThread,
  type ChatMessage,
  type ChatThread,
  type RecentPrompt,
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
  const { threadId } = useParams<{ threadId?: string }>();

  const [threads, setThreads] = useState<ChatThread[]>(() => loadThreads());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [threadListOpen, setThreadListOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoPromptRef = useRef<string | null>(null);
  const autoPromptFiredRef = useRef(false);
  const [recentPrompts, setRecentPrompts] = useState<RecentPrompt[]>(() => loadRecentPrompts());

  const refreshThreads = useCallback(() => setThreads(loadThreads()), []);

  useEffect(() => {
    const onRecent = () => setRecentPrompts(loadRecentPrompts());
    const onThreads = () => refreshThreads();
    window.addEventListener("mr:recent-prompts-updated", onRecent);
    window.addEventListener("mr:threads-updated", onThreads);
    window.addEventListener("storage", onRecent);
    window.addEventListener("storage", onThreads);
    return () => {
      window.removeEventListener("mr:recent-prompts-updated", onRecent);
      window.removeEventListener("mr:threads-updated", onThreads);
      window.removeEventListener("storage", onRecent);
      window.removeEventListener("storage", onThreads);
    };
  }, [refreshThreads]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Ask Mera AI";
    return () => { document.title = prevTitle; };
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  // Route sync: if no threadId, pick most recent or create one and navigate.
  useEffect(() => {
    if (threadId) {
      const t = getThread(threadId);
      if (!t) {
        // Unknown id — create fresh
        const created = createThread();
        navigate(`/assistant/${created.id}`, { replace: true, state: location.state });
        return;
      }
      setMessages(t.messages);
      return;
    }
    const all = loadThreads();
    const target = all[0] ?? createThread();
    refreshThreads();
    navigate(`/assistant/${target.id}`, { replace: true, state: location.state });
  }, [threadId, navigate, location.state, refreshThreads]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !threadId) return;
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
    const nextMessages = [...messages, userMsg, assistantMsg];
    setMessages(nextMessages);
    updateThread(threadId, { messages: nextMessages });
    setInput("");
    setSending(true);
    addRecentPrompt(trimmed);

    const controller = new AbortController();
    abortRef.current = controller;

    let currentAssistant = "";
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      await streamChat(
        history,
        (delta) => {
          currentAssistant += delta;
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
      if (!currentAssistant) {
        currentAssistant = `_Error: ${msg}_`;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId && !m.content ? { ...m, content: currentAssistant } : m)),
        );
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      // Persist final assistant content
      const finalMessages = nextMessages.map((m) =>
        m.id === assistantId ? { ...m, content: currentAssistant } : m,
      );
      updateThread(threadId, { messages: finalMessages });
      refreshThreads();
    }
  }, [messages, sending, threadId, refreshThreads]);

  // Auto-send a prompt passed via navigation state (from home quick-action chips)
  useEffect(() => {
    const state = location.state as { prompt?: string } | null;
    if (state?.prompt && !autoPromptFiredRef.current) {
      autoPromptRef.current = state.prompt;
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (autoPromptRef.current && signedIn && !sending && threadId && !autoPromptFiredRef.current) {
      autoPromptFiredRef.current = true;
      const p = autoPromptRef.current;
      autoPromptRef.current = null;
      void send(p);
    }
  }, [signedIn, sending, threadId, send]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onNewChat = () => {
    if (sending) abortRef.current?.abort();
    // If current thread is empty, just reuse it
    if (threadId) {
      const cur = getThread(threadId);
      if (cur && cur.messages.length === 0) {
        setThreadListOpen(false);
        return;
      }
    }
    const t = createThread();
    refreshThreads();
    setThreadListOpen(false);
    navigate(`/assistant/${t.id}`);
  };

  const onSelectThread = (id: string) => {
    if (sending) abortRef.current?.abort();
    setThreadListOpen(false);
    navigate(`/assistant/${id}`);
  };

  const onDeleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteThread(id);
    const remaining = loadThreads();
    setThreads(remaining);
    if (id === threadId) {
      const next = remaining[0] ?? createThread();
      navigate(`/assistant/${next.id}`, { replace: true });
    }
  };

  const activeThread = useMemo(
    () => threads.find((t) => t.id === threadId),
    [threads, threadId],
  );

  if (signedIn === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <Sparkles className="w-10 h-10 text-primary mb-3" />
        <h1 className="text-lg font-semibold mb-1">Ask Mera AI</h1>
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewChat}
              className="text-primary-foreground hover:bg-white/10"
              aria-label="New chat"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Sheet open={threadListOpen} onOpenChange={setThreadListOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-white/10"
                  aria-label="Conversations"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85%] sm:w-96 p-0 flex flex-col">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Conversations</SheetTitle>
                </SheetHeader>
                <div className="p-3 border-b">
                  <Button className="w-full" onClick={onNewChat}>
                    <Plus className="w-4 h-4 mr-2" /> New chat
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {threads.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No conversations yet.
                    </p>
                  ) : (
                    threads.map((t) => (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectThread(t.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") onSelectThread(t.id); }}
                        className={`group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          t.id === threadId ? "bg-muted" : "hover:bg-muted/60"
                        }`}
                      >
                        <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{t.title || "New chat"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(t.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                              aria-label="Delete conversation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove "{t.title || "New chat"}" and its messages from this device. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => onDeleteThread(t.id, e as unknown as React.MouseEvent)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Sparkles className="w-6 h-6 opacity-90" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Ask Mera AI</h1>
            <p className="text-xs opacity-80 truncate">
              {activeThread?.title && activeThread.messages.length > 0
                ? activeThread.title
                : "Ask about your rashans, statements & cards"}
            </p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="max-w-md mx-auto pt-6 space-y-6">
            {recentPrompts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recent prompts
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear recent prompts?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove all your recent prompt suggestions. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => { clearRecentPrompts(); setRecentPrompts([]); }}
                        >
                          Clear
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="grid gap-2">
                  {recentPrompts.map((r) => (
                    <button
                      key={r.usedAt + r.prompt}
                      type="button"
                      onClick={() => void send(r.prompt)}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-border/60 bg-card hover:bg-muted transition-colors flex items-start gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                      <span className="line-clamp-2">{r.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="text-center">
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
        {messages.length > 0 && (
          <div className="max-w-2xl mx-auto mb-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                disabled={sending}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border/60 bg-card hover:bg-muted transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
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
