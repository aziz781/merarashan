import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

const STORAGE_KEY = "mr_ai_chat_v1";

export function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveMessages(messages: ChatMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100))); } catch { /* ignore */ }
}

export function clearMessages() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ---------- Recent quick-action prompts ----------
const RECENT_PROMPTS_KEY = "mr_ai_recent_prompts_v1";
const RECENT_PROMPTS_MAX = 8;

export type RecentPrompt = { prompt: string; usedAt: number };

export function loadRecentPrompts(): RecentPrompt[] {
  try {
    const raw = localStorage.getItem(RECENT_PROMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.prompt === "string") : [];
  } catch { return []; }
}

export function addRecentPrompt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return;
  try {
    const current = loadRecentPrompts().filter((p) => p.prompt !== trimmed);
    const next = [{ prompt: trimmed, usedAt: Date.now() }, ...current].slice(0, RECENT_PROMPTS_MAX);
    localStorage.setItem(RECENT_PROMPTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("mr:recent-prompts-updated"));
  } catch { /* ignore */ }
}

export function clearRecentPrompts() {
  try {
    localStorage.removeItem(RECENT_PROMPTS_KEY);
    window.dispatchEvent(new CustomEvent("mr:recent-prompts-updated"));
  } catch { /* ignore */ }
}


/**
 * Send messages to the ai-chat edge function and stream the assistant's
 * reply. `onDelta` is called for each text chunk.
 */
export async function streamChat(
  history: { role: "user" | "assistant"; content: string }[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages: history }),
    signal,
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames: lines of "data: <json>" separated by blank lines.
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch { /* skip malformed frame */ }
    }
  }
}
