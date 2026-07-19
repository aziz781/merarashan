import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
  messages: ChatMessage[];
};

const THREADS_KEY = "mr_ai_threads_v1";
const LEGACY_KEY = "mr_ai_chat_v1";
const MAX_THREADS = 30;
const MAX_MESSAGES_PER_THREAD = 100;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw);
    return p ?? fallback;
  } catch { return fallback; }
}

function emitThreadsUpdated() {
  try { window.dispatchEvent(new CustomEvent("mr:threads-updated")); } catch { /* ignore */ }
}

export function loadThreads(): ChatThread[] {
  try {
    const arr = safeParse<ChatThread[]>(localStorage.getItem(THREADS_KEY), []);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter((t) => t && typeof t.id === "string" && Array.isArray(t.messages))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    // Migrate legacy single-conversation storage
    const legacy = safeParse<ChatMessage[]>(localStorage.getItem(LEGACY_KEY), []);
    if (Array.isArray(legacy) && legacy.length > 0) {
      const migrated: ChatThread = {
        id: crypto.randomUUID(),
        title: deriveTitle(legacy),
        createdAt: legacy[0]?.createdAt ?? Date.now(),
        updatedAt: legacy[legacy.length - 1]?.createdAt ?? Date.now(),
        messages: legacy,
      };
      localStorage.setItem(THREADS_KEY, JSON.stringify([migrated]));
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      return [migrated];
    }
    return [];
  } catch { return []; }
}

function persist(threads: ChatThread[]) {
  try {
    const trimmed = threads
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, MAX_THREADS)
      .map((t) => ({ ...t, messages: t.messages.slice(-MAX_MESSAGES_PER_THREAD) }));
    localStorage.setItem(THREADS_KEY, JSON.stringify(trimmed));
    emitThreadsUpdated();
  } catch { /* ignore */ }
}

export function getThread(id: string): ChatThread | undefined {
  return loadThreads().find((t) => t.id === id);
}

export function createThread(): ChatThread {
  const thread: ChatThread = {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  const all = [thread, ...loadThreads()];
  persist(all);
  return thread;
}

export function updateThread(id: string, patch: Partial<Omit<ChatThread, "id">>) {
  const all = loadThreads();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const next: ChatThread = { ...all[idx], ...patch, id };
  if (patch.messages) {
    next.title = all[idx].title === "New chat" || !all[idx].title
      ? deriveTitle(patch.messages) || all[idx].title || "New chat"
      : all[idx].title;
    next.updatedAt = Date.now();
  }
  all[idx] = next;
  persist(all);
}

export function deleteThread(id: string) {
  const all = loadThreads().filter((t) => t.id !== id);
  persist(all);
}

export function clearAllThreads() {
  try {
    localStorage.removeItem(THREADS_KEY);
    emitThreadsUpdated();
  } catch { /* ignore */ }
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const t = firstUser.content.trim().replace(/\s+/g, " ");
  return t.length > 48 ? `${t.slice(0, 45)}…` : t || "New chat";
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
