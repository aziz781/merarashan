import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, RefreshCw, CheckCircle2, Circle, MessageSquare, Inbox, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminConversation {
  id: string;
  user_id: string;
  mobile: string;
  status: "open" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
  latest_message: {
    sender_type: "user" | "agent";
    content: string;
    created_at: string;
    read_at: string | null;
  } | null;
  unread_user_messages: number;
}

interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_type: "user" | "agent";
  content: string;
  read_at: string | null;
  created_at: string;
}

export default function AdminSupport() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevUnreadRef = useRef<number | null>(null);


  // Verify admin access.
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setIsAdmin(false);
          return;
        }
        const res = await supabase.functions.invoke("is-admin", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.error) throw res.error;
        setIsAdmin(!!res.data?.isAdmin);
      } catch {
        setIsAdmin(false);
      }
    };
    void checkAdmin();
  }, []);

  const loadConversations = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setRefreshing(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-support?action=list`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { conversations: AdminConversation[] };
      const next = json.conversations || [];
      const nextUnread = next.reduce((s, c) => s + (c.unread_user_messages || 0), 0);
      if (
        prevUnreadRef.current !== null &&
        nextUnread > prevUnreadRef.current &&
        document.visibilityState !== "hidden"
      ) {
        toast.message("New support message", {
          description: `${nextUnread} unread message${nextUnread === 1 ? "" : "s"} waiting.`,
        });
      }
      prevUnreadRef.current = nextUnread;
      setConversations(next);
    } catch (e) {
      if (!opts?.silent) {
        const msg = e instanceof Error ? e.message : "Could not load conversations";
        toast.error("Load failed", { description: msg });
      }
    } finally {
      if (!opts?.silent) setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadConversations();
    // RLS hides other users' rows from realtime for agents, so poll instead.
    const id = window.setInterval(() => void loadConversations({ silent: true }), 15000);
    const onFocus = () => void loadConversations({ silent: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Load messages for selected conversation (and keep them fresh).
  useEffect(() => {
    if (!selectedId) return;

    const loadMessages = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-support?action=messages&conversation_id=${selectedId}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { messages: SupportMessage[] };
        setMessages(json.messages || []);
        // Opening the thread marks user messages read server-side.
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unread_user_messages: 0 } : c)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not load messages";
        toast.error("Load failed", { description: msg });
      }
    };

    void loadMessages();
    const id = window.setInterval(() => void loadMessages(), 10000);
    return () => window.clearInterval(id);
  }, [selectedId]);


  // Realtime subscription for selected conversation.
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`admin-support-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${selectedId}`,
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
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedId) {
      textareaRef.current?.focus();
    }
  }, [selectedId]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !selectedId || sending) return;

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-support?action=send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversation_id: selectedId, content }),
      });
      if (!res.ok) throw new Error(await res.text());
      setInput("");
      textareaRef.current?.focus();
      // Refresh conversation list to update latest message.
      void loadConversations();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      toast.error("Message not sent", { description: msg });
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (id: string, status: "open" | "resolved" | "closed") => {
    setStatusBusy(id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-support?action=status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversation_id: id, status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      );
      toast.success(`Conversation ${status}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast.error("Status update failed", { description: msg });
    } finally {
      setStatusBusy(null);
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
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));
    } catch {
      return "";
    }
  };

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3 bg-background">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => navigate("/")}>Go home</Button>
      </div>
    );
  }

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_user_messages || 0), 0);

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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Support Dashboard</h1>
              {totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread} unread messages`}
                  className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground"
                >
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <p className="text-xs text-primary-foreground/80 dark:text-foreground/70">
              {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
              {totalUnread > 0 ? ` · ${totalUnread} unread` : ""}
            </p>
          </div>

        </div>
        <button
          type="button"
          onClick={() => void loadConversations()}
          disabled={refreshing}
          aria-label="Refresh"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-primary-foreground ring-1 ring-white/25 hover:bg-white/25 transition-colors dark:bg-primary/25 dark:text-primary dark:ring-primary/50 dark:hover:bg-primary/35 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
        </button>
      </PageHeader>

      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
        {/* Conversation list */}
        <div className="w-full sm:w-80 border-b sm:border-b-0 sm:border-r border-border bg-card/50 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No support conversations yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
                    selectedId === c.id ? "bg-muted" : ""
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">+{c.mobile || "Unknown"}</span>
                    {c.unread_user_messages > 0 && (
                      <span className="shrink-0 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5">
                        {c.unread_user_messages}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {c.latest_message
                      ? `${c.latest_message.sender_type === "user" ? "User" : "You"}: ${c.latest_message.content}`
                      : "No messages"}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        c.status === "open"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : c.status === "resolved"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {c.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatTime(c.updated_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <MessageSquare className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Select a conversation to start replying.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-card/50">
                <div>
                  <p className="font-medium text-sm">+{selectedConversation.mobile || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {messages.filter((m) => m.sender_type === "user" && !m.read_at).length} unread
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedConversation.status !== "resolved" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={statusBusy === selectedConversation.id}
                      onClick={() => void handleStatusChange(selectedConversation.id, "resolved")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Resolve
                    </Button>
                  )}
                  {selectedConversation.status !== "closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={statusBusy === selectedConversation.id}
                      onClick={() => void handleStatusChange(selectedConversation.id, "closed")}
                    >
                      <Circle className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  )}
                  {selectedConversation.status !== "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={statusBusy === selectedConversation.id}
                      onClick={() => void handleStatusChange(selectedConversation.id, "open")}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg) => {
                  const isAgent = msg.sender_type === "agent";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          isAgent
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md border border-border"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <span
                          className={`block text-[10px] mt-1 ${
                            isAgent ? "text-primary-foreground/70" : "text-muted-foreground"
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
                <div className="flex items-end gap-2 max-w-3xl mx-auto">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a reply…"
                    rows={1}
                    className="min-h-[48px] max-h-[120px] resize-none rounded-xl bg-background border-border focus-visible:ring-primary"
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || sending}
                    className="h-12 w-12 shrink-0 rounded-xl"
                    aria-label="Send reply"
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
