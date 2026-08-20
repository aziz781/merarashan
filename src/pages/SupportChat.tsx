import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertCircle,
  Paperclip,
  X,
  Check,
  CheckCheck,
  Headphones,
  FileText,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useSupportTyping } from "@/hooks/useSupportTyping";
import { TypingIndicator } from "@/components/TypingIndicator";

interface SupportConversation {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_type: "user" | "agent";
  content: string | null;
  read_at: string | null;
  created_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
}

const MESSAGE_COLUMNS =
  "id, conversation_id, sender_type, content, read_at, created_at, attachment_path, attachment_name, attachment_type";

const QUICK_REPLIES = [
  "My Mera Rashan card is not working",
  "I can't generate a Rashan Code",
  "A transaction looks wrong",
  "How do I update my mobile number?",
];

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function SupportChat() {
  const navigate = useNavigate();
  const [session, setSession] = useState<{
    userId: string;
    mobile: string;
  } | null>(null);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract mobile from session metadata.
  useEffect(() => {
    const extractMobile = (email?: string | null, meta?: Record<string, unknown> | null) => {
      const fromMeta = typeof meta?.mobile === "string" ? meta.mobile : null;
      if (fromMeta) return fromMeta;
      const PHONE_EMAIL_DOMAIN = "phone.merarashan.local";
      if (email && email.endsWith(`@${PHONE_EMAIL_DOMAIN}`)) {
        return email.slice(0, -1 - PHONE_EMAIL_DOMAIN.length);
      }
      return null;
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s?.user) {
        navigate("/", { replace: true });
        return;
      }
      const mobile = extractMobile(s.user.email, s.user.user_metadata as Record<string, unknown> | null);
      setSession({ userId: s.user.id, mobile: mobile || "" });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s?.user) {
        navigate("/", { replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // Load or create conversation.
  useEffect(() => {
    if (!session) return;

    const loadConversation = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: existing, error: fetchErr } = await supabase
          .from("support_conversations")
          .select("id, user_id, status, created_at, updated_at")
          .eq("user_id", session.userId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        let conv = existing as SupportConversation | null;
        if (!conv) {
          const { data: created, error: createErr } = await supabase
            .from("support_conversations")
            .insert({ user_id: session.userId, status: "open" })
            .select("id, user_id, status, created_at, updated_at")
            .single();
          if (createErr) throw createErr;
          conv = created as SupportConversation;
        }

        setConversation(conv);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not load chat";
        setError(msg);
        toast.error("Support chat unavailable", { description: msg });
      } finally {
        setLoading(false);
      }
    };

    void loadConversation();
  }, [session]);

  // Load messages and subscribe to realtime updates.
  useEffect(() => {
    if (!conversation) return;

    const loadMessages = async () => {
      const { data, error: msgErr } = await supabase
        .from("support_messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (msgErr) {
        toast.error("Could not load messages", { description: msgErr.message });
        return;
      }
      setMessages((data || []) as SupportMessage[]);
    };

    void loadMessages();

    const channel = supabase
      .channel(`support-chat-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMessage = payload.new as SupportMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as SupportMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation]);

  // Resolve signed URLs for attachments.
  useEffect(() => {
    const missing = messages.filter((m) => m.attachment_path && !attachmentUrls[m.attachment_path]);
    if (missing.length === 0) return;
    let cancelled = false;

    void (async () => {
      const entries: [string, string][] = [];
      for (const m of missing) {
        const path = m.attachment_path as string;
        const { data } = await supabase.storage.from("support-attachments").createSignedUrl(path, 3600);
        if (data?.signedUrl) entries.push([path, data.signedUrl]);
      }
      if (!cancelled && entries.length > 0) {
        setAttachmentUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, attachmentUrls]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep textarea focused.
  useEffect(() => {
    if (!loading) {
      textareaRef.current?.focus();
    }
  }, [loading, conversation]);

  // Auto-grow composer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const isClosed = conversation?.status === "closed";

  const { otherTyping, notifyTyping, notifyStopped } = useSupportTyping(
    conversation?.id ?? null,
    "user",
  );

  const handleSend = useCallback(
    async (override?: string) => {
      const content = (override ?? input).trim();
      const file = pendingFile;
      if ((!content && !file) || !conversation || !session || sending) return;

      setSending(true);
      try {
        let attachment: { path: string; name: string; type: string } | null = null;
        if (file) {
          const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
          const path = `${session.userId}/${conversation.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("support-attachments")
            .upload(path, file, { contentType: file.type || "application/octet-stream" });
          if (upErr) throw upErr;
          attachment = { path, name: file.name, type: file.type || "application/octet-stream" };
        }

        const { error: sendErr } = await supabase.from("support_messages").insert({
          conversation_id: conversation.id,
          sender_type: "user",
          content: content || null,
          attachment_path: attachment?.path ?? null,
          attachment_name: attachment?.name ?? null,
          attachment_type: attachment?.type ?? null,
        });
        if (sendErr) throw sendErr;
        setInput("");
        setPendingFile(null);
        notifyStopped();
        textareaRef.current?.focus();
        // Notify support agents (push + their in-app inbox). Best-effort.
        void supabase.functions
          .invoke("support-notify", {
            body: {
              conversation_id: conversation.id,
              preview: (content || `Sent an attachment: ${attachment?.name ?? "file"}`).slice(0, 160),
            },
          })
          .catch(() => undefined);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Send failed";
        toast.error("Message not sent", { description: msg });
      } finally {
        setSending(false);
      }
    },
    [input, pendingFile, conversation, session, sending],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large", { description: "Please attach a file under 5 MB." });
      return;
    }
    setPendingFile(file);
    textareaRef.current?.focus();
  };

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));
    } catch {
      return "";
    }
  };

  const formatDay = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return "Today";
    if (same(d, yesterday)) return "Yesterday";
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(d);
    } catch {
      return "";
    }
  };

  // Group messages by day for separators.
  const grouped = useMemo(() => {
    const out: { day: string; items: SupportMessage[] }[] = [];
    for (const m of messages) {
      const day = formatDay(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_type === "user") return messages[i].id;
    }
    return null;
  }, [messages]);

  const renderAttachment = (msg: SupportMessage, isUser: boolean) => {
    if (!msg.attachment_path) return null;
    const url = attachmentUrls[msg.attachment_path];
    const isImage = (msg.attachment_type || "").startsWith("image/");

    if (isImage) {
      return url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img
            src={url}
            alt={msg.attachment_name || "Attachment"}
            loading="lazy"
            className="max-h-56 w-auto rounded-lg object-cover"
          />
        </a>
      ) : (
        <div className="mt-1 h-24 w-40 animate-pulse rounded-lg bg-foreground/10" />
      );
    }

    return (
      <a
        href={url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 ${
          isUser ? "bg-primary-foreground/15" : "bg-foreground/5"
        }`}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate text-xs">{msg.attachment_name || "Attachment"}</span>
        <Download className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70" />
      </a>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground ring-1 ring-white/25 hover:bg-white/25 transition-colors dark:bg-primary/25 dark:text-primary dark:ring-primary/50 dark:hover:bg-primary/35"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Customer Support</h1>
            <p className="text-xs text-primary-foreground/80 dark:text-foreground/70">
              {conversation?.status === "open" ? "We typically reply within a few hours" : "This conversation is closed"}
            </p>
          </div>
        </div>
      </PageHeader>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Headphones className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium">How can we help?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Send us a message and our team will reply here.
                </p>
                {session?.mobile && (
                  <p className="text-xs text-muted-foreground mt-1">Account: +{session.mobile}</p>
                )}
                {!isClosed && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void handleSend(q)}
                        disabled={sending}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-60"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.day} className="space-y-4">
                <div className="flex items-center justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">
                    {group.day}
                  </span>
                </div>
                {group.items.map((msg) => {
                  const isUser = msg.sender_type === "user";
                  const showReceipt = isUser && msg.id === lastUserMessageId;
                  return (
                    <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          isUser
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md border border-border"
                        }`}
                      >
                        {msg.content && (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        )}
                        {renderAttachment(msg, isUser)}
                        <span
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            isUser ? "justify-end text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                          {showReceipt &&
                            (msg.read_at ? (
                              <CheckCheck className="h-3 w-3" aria-label="Read" />
                            ) : (
                              <Check className="h-3 w-3" aria-label="Sent" />
                            ))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {otherTyping && <TypingIndicator label="Support is typing…" />}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="max-w-2xl mx-auto space-y-2">
              {pendingFile && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-xs">{pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    aria-label="Remove attachment"
                    className="ml-auto rounded-full p-1 hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handlePickFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isClosed || sending}
                  className="h-12 w-12 shrink-0 rounded-xl"
                  aria-label="Attach a file"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message…"
                  disabled={isClosed}
                  rows={1}
                  className="min-h-[48px] max-h-[140px] resize-none rounded-xl bg-background border-border focus-visible:ring-primary"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={() => void handleSend()}
                  disabled={(!input.trim() && !pendingFile) || sending || isClosed}
                  className="h-12 w-12 shrink-0 rounded-xl"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            {isClosed && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                This conversation is closed. Start a new chat from the help menu if you need more help.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
