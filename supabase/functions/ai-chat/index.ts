// AI Assistant chat endpoint — streams a Lovable AI Gateway completion back to
// the client as text/event-stream, with the signed-in user's own rashan
// transactions and statements injected into the system prompt.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const UPSTREAM = "https://data.merarashan.pk";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function normalize(m: string): string {
  return String(m || "").replace(/\D/g, "");
}

async function getMobile(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.replace("Bearer ", "");
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const meta = (data.user.user_metadata || {}) as { mobile?: string };
  const email = data.user.email || "";
  const mobile = normalize(meta.mobile || email.split("@")[0] || "");
  if (!/^\d{6,15}$/.test(mobile)) throw new Error("No mobile identity");
  return mobile;
}

async function fetchResource(resource: string, mobile: string, extra?: Record<string, string>) {
  const token = Deno.env.get("MERARASHAN_API_TOKEN");
  if (!token) throw new Error("MERARASHAN_API_TOKEN not configured");
  const url = new URL(`${UPSTREAM}/${resource}`);
  url.searchParams.set("mobile", mobile);
  if (extra) for (const [k, v] of Object.entries(extra)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { "x-api-key": token, Accept: "application/json" },
  });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const mobile = await getMobile(req);
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull the current year of transactions + statements + cards + customer.
    const year = String(new Date().getFullYear());
    const [customers, cards, transactions, statements] = await Promise.all([
      fetchResource("customers", mobile),
      fetchResource("cards", mobile),
      fetchResource("transactions", mobile, { monthYear: year }),
      fetchResource("statements", mobile, { year }),
    ]);

    // Cap the size of each blob to keep the prompt reasonable.
    const cap = (v: unknown, n: number) => JSON.stringify(v).slice(0, n);
    const systemPrompt = [
      "You are the in-app AI assistant for Mera Rashan (a Pakistani grocery-ration management app).",
      "Answer the signed-in user's questions about their own rashan cards, transactions (deliveries), and monthly statements using ONLY the JSON data provided below.",
      "Reply in the language of the user's question (English or Urdu). Use short, clear answers with markdown when helpful. Format amounts as `Rs. 1,234`.",
      "If the data does not contain the answer, say you don't have that information rather than guessing.",
      `Today's date: ${new Date().toISOString().slice(0, 10)}. Signed-in mobile: ${mobile}.`,
      "",
      `CUSTOMER: ${cap(customers, 4000)}`,
      `CARDS: ${cap(cards, 6000)}`,
      `TRANSACTIONS (${year}): ${cap(transactions, 18000)}`,
      `STATEMENTS (${year}): ${cap(statements, 8000)}`,
    ].join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway error: ${text.slice(0, 300)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
