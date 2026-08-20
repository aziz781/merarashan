import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Role = "user" | "agent";

const TYPING_TTL_MS = 4000;
const THROTTLE_MS = 1500;

/**
 * Broadcast-based typing indicator for the support chat.
 * Each side broadcasts "typing"/"stop" events on a per-conversation channel
 * and listens for the other side's events.
 */
export function useSupportTyping(conversationId: string | null, role: Role) {
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);
  const expireTimer = useRef<number | null>(null);

  useEffect(() => {
    setOtherTyping(false);
    if (!conversationId) return;

    const channel = supabase.channel(`support-typing-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if ((payload.payload as { role?: Role })?.role === role) return;
        setOtherTyping(true);
        if (expireTimer.current) window.clearTimeout(expireTimer.current);
        expireTimer.current = window.setTimeout(() => setOtherTyping(false), TYPING_TTL_MS);
      })
      .on("broadcast", { event: "stop" }, (payload) => {
        if ((payload.payload as { role?: Role })?.role === role) return;
        if (expireTimer.current) window.clearTimeout(expireTimer.current);
        setOtherTyping(false);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (expireTimer.current) window.clearTimeout(expireTimer.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, role]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) return;
    lastSentRef.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { role } });
  }, [role]);

  const notifyStopped = useCallback(() => {
    lastSentRef.current = 0;
    void channelRef.current?.send({ type: "broadcast", event: "stop", payload: { role } });
  }, [role]);

  return { otherTyping, notifyTyping, notifyStopped };
}
