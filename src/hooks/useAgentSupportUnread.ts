import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgentConversationSummary {
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

export async function fetchAgentConversations(): Promise<AgentConversationSummary[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return [];
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
  const json = (await res.json()) as { conversations: AgentConversationSummary[] };
  return json.conversations || [];
}

/**
 * Polls the agent support inbox and returns the total number of unread user
 * messages. Returns 0 for non-agents. RLS hides other users' conversations
 * from realtime, so we poll the admin edge function instead.
 */
export function useAgentSupportUnread(pollMs = 30000) {
  const [isAgent, setIsAgent] = useState<boolean | null>(null);
  const [unread, setUnread] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          if (!cancelled) setIsAgent(false);
          return;
        }
        const res = await supabase.functions.invoke("is-admin", { body: {} });
        if (!cancelled) setIsAgent(!res.error && !!res.data?.isAdmin);
      } catch {
        if (!cancelled) setIsAgent(false);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isAgent) return;
    try {
      const conversations = await fetchAgentConversations();
      const total = conversations.reduce((sum, c) => sum + (c.unread_user_messages || 0), 0);
      if (mounted.current) setUnread(total);
    } catch {
      /* ignore transient failures */
    }
  }, [isAgent]);

  useEffect(() => {
    if (!isAgent) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [isAgent, pollMs, refresh]);

  return { isAgent: !!isAgent, unread, refresh };
}
