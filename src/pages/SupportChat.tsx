import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  content: string;
  read_at: string | null;
  created_at: string;
}

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        .select("id, conversation_id, sender_type, content, read_at, created_at")
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation]);

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

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !conversation || sending) return;

    setSending(true);
    try {
      const { error: sendErr } = await supabase.from("support_messages").insert({
        conversation_id: conversation.id,
        sender_type: "user",
        content,
      });
      if (sendErr) throw sendErr;
      setInput("");
      textareaRef.current?.focus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      toast.error("Message not sent", { description: msg });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
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
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-sm">Start a conversation with our support team.</p>
                {session?.mobile && (
                  <p className="text-xs mt-1">Account: +{session.mobile}</p>
                )}
              </div>
            )}
            {messages.map((msg) => {
              const isUser = msg.sender_type === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md border border-border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <span
                      className={`block text-[10px] mt-1 ${
                        isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-end gap-2 max-w-2xl mx-auto">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message…"
                disabled={conversation?.status === "closed"}
                rows={1}
                className="min-h-[48px] max-h-[120px] resize-none rounded-xl bg-background border-border focus-visible:ring-primary"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending || conversation?.status === "closed"}
                className="h-12 w-12 shrink-0 rounded-xl"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
            {conversation?.status === "closed" && (
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
