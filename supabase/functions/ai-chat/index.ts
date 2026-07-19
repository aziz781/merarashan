// AI Assistant chat endpoint — Lovable AI Gateway with OpenAI-compatible tool
// calling. The model runs a tool loop to fetch transactions, statements,
// notifications, and shop summaries on demand; the final answer is streamed
// back to the client as text/event-stream.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const UPSTREAM = "https://data.merarashan.pk";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_TOOL_ROUNDS = 5;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type GwMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

function normalize(m: string): string {
  return String(m || "").replace(/\D/g, "");
}

async function getMobileAndToken(req: Request): Promise<{ mobile: string; token: string }> {
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
  return { mobile, token };
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

// ---------- Helpers to normalize upstream shapes ----------

function toArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["data", "items", "results", "transactions", "statements", "cards"]) {
      if (Array.isArray(o[k])) return o[k] as any[];
    }
  }
  return [];
}

function pickDate(t: any): Date | null {
  const cand = t?.date || t?.created_at || t?.createdAt || t?.transaction_date || t?.txnDate || t?.monthYear;
  if (!cand) return null;
  const d = new Date(cand);
  return isNaN(d.getTime()) ? null : d;
}

function pickAmount(t: any): number {
  const n = Number(t?.amount ?? t?.total ?? t?.value ?? t?.price ?? 0);
  return isFinite(n) ? n : 0;
}

function pickShop(t: any): string {
  return String(t?.shop_name || t?.shopName || t?.shop || t?.merchant || t?.store || "Unknown").trim() || "Unknown";
}

function pickCategory(t: any): string {
  return String(t?.category || t?.item_category || t?.type || "Uncategorized").trim() || "Uncategorized";
}

// ---------- Tool definitions ----------

const tools = [
  {
    type: "function",
    function: {
      name: "get_transactions",
      description: "List the user's rashan transactions (deliveries). Optionally filter by year, month (1-12), or shop name substring. Returns up to `limit` records (default 50, max 200), newest first.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "string", description: "4-digit year, e.g. '2026'. Defaults to current year." },
          month: { type: "integer", description: "Month 1-12. Optional." },
          shop: { type: "string", description: "Case-insensitive shop name substring. Optional." },
          limit: { type: "integer", description: "Max records to return (default 50, max 200)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_summary",
      description: "Aggregate the user's transactions by month for a given year. Returns per-month totals (count, total amount).",
      parameters: {
        type: "object",
        properties: {
          year: { type: "string", description: "4-digit year. Defaults to current year." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_category_summary",
      description: "Aggregate the user's transactions by category for a given year. Returns per-category totals.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "string", description: "4-digit year. Defaults to current year." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shops_summary",
      description: "Aggregate the user's transactions by shop for a given year. Returns per-shop totals (count, total amount, last visit date).",
      parameters: {
        type: "object",
        properties: {
          year: { type: "string", description: "4-digit year. Defaults to current year." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_statements",
      description: "List the user's monthly rashan statements for a given year (paid/unpaid, amounts).",
      parameters: {
        type: "object",
        properties: {
          year: { type: "string", description: "4-digit year. Defaults to current year." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cards",
      description: "List the user's Mera Rashan cards (id, holder, status).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_notifications",
      description: "List the user's in-app notifications from the notification inbox, newest first.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max records (default 20, max 100)." },
          unread_only: { type: "boolean", description: "If true, only unread notifications." },
        },
      },
    },
  },
];

// ---------- Tool executors ----------

async function runTool(
  name: string,
  args: Record<string, any>,
  ctx: { mobile: string; token: string },
): Promise<unknown> {
  const currentYear = String(new Date().getFullYear());
  switch (name) {
    case "get_transactions": {
      const year = String(args.year || currentYear);
      const limit = Math.max(1, Math.min(200, Number(args.limit) || 50));
      const raw = await fetchResource("transactions", ctx.mobile, { monthYear: year });
      let list = toArray(raw);
      if (args.month) {
        const m = Number(args.month);
        list = list.filter((t) => {
          const d = pickDate(t);
          return d && d.getMonth() + 1 === m;
        });
      }
      if (args.shop) {
        const q = String(args.shop).toLowerCase();
        list = list.filter((t) => pickShop(t).toLowerCase().includes(q));
      }
      list.sort((a, b) => (pickDate(b)?.getTime() || 0) - (pickDate(a)?.getTime() || 0));
      return { count: list.length, transactions: list.slice(0, limit) };
    }
    case "get_monthly_summary": {
      const year = String(args.year || currentYear);
      const raw = await fetchResource("transactions", ctx.mobile, { monthYear: year });
      const list = toArray(raw);
      const buckets: Record<string, { month: number; count: number; total: number }> = {};
      for (const t of list) {
        const d = pickDate(t);
        if (!d) continue;
        const key = String(d.getMonth() + 1).padStart(2, "0");
        buckets[key] ??= { month: d.getMonth() + 1, count: 0, total: 0 };
        buckets[key].count += 1;
        buckets[key].total += pickAmount(t);
      }
      const months = Object.keys(buckets).sort().map((k) => buckets[k]);
      const grand = months.reduce((s, m) => s + m.total, 0);
      return { year, months, grand_total: Math.round(grand * 100) / 100 };
    }
    case "get_category_summary": {
      const year = String(args.year || currentYear);
      const raw = await fetchResource("transactions", ctx.mobile, { monthYear: year });
      const list = toArray(raw);
      const buckets: Record<string, { category: string; count: number; total: number }> = {};
      for (const t of list) {
        const c = pickCategory(t);
        buckets[c] ??= { category: c, count: 0, total: 0 };
        buckets[c].count += 1;
        buckets[c].total += pickAmount(t);
      }
      const categories = Object.values(buckets).sort((a, b) => b.total - a.total);
      return { year, categories };
    }
    case "get_shops_summary": {
      const year = String(args.year || currentYear);
      const raw = await fetchResource("transactions", ctx.mobile, { monthYear: year });
      const list = toArray(raw);
      const buckets: Record<string, { shop: string; count: number; total: number; last_visit: string | null }> = {};
      for (const t of list) {
        const s = pickShop(t);
        const d = pickDate(t);
        buckets[s] ??= { shop: s, count: 0, total: 0, last_visit: null };
        buckets[s].count += 1;
        buckets[s].total += pickAmount(t);
        const iso = d ? d.toISOString().slice(0, 10) : null;
        if (iso && (!buckets[s].last_visit || iso > buckets[s].last_visit!)) {
          buckets[s].last_visit = iso;
        }
      }
      const shops = Object.values(buckets).sort((a, b) => b.total - a.total);
      return { year, shops };
    }
    case "get_statements": {
      const year = String(args.year || currentYear);
      const raw = await fetchResource("statements", ctx.mobile, { year });
      return { year, statements: toArray(raw) };
    }
    case "get_cards": {
      const raw = await fetchResource("cards", ctx.mobile);
      return { cards: toArray(raw) };
    }
    case "get_notifications": {
      const limit = Math.max(1, Math.min(100, Number(args.limit) || 20));
      const supa = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${ctx.token}` } } },
      );
      let q = supa.from("notification_inbox")
        .select("id,title,body,tag,url,created_at,read_at")
        .eq("mobile", ctx.mobile)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.unread_only) q = q.is("read_at", null);
      const { data, error } = await q;
      if (error) return { error: error.message, notifications: [] };
      return { count: data?.length || 0, notifications: data || [] };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------- Gateway helpers ----------

function gwError(status: number, text: string) {
  if (status === 429) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (status === 402) {
    return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: `AI gateway error: ${text.slice(0, 300)}` }), {
    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callGateway(apiKey: string, body: unknown): Promise<Response> {
  return await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------- Weekly digest cache ----------
// In-memory per-isolate cache. Edge functions reuse warm isolates for a while,
// so this meaningfully cuts repeat Supabase reads for chatty users without
// changing correctness — TTL keeps the digest reasonably fresh.
const DIGEST_TTL_MS = 10 * 60 * 1000; // 10 minutes
const digestCache = new Map<string, { digest: string; expires: number }>();

function getCachedDigest(mobile: string): string | null {
  const hit = digestCache.get(mobile);
  if (!hit) return null;
  if (hit.expires < Date.now()) { digestCache.delete(mobile); return null; }
  return hit.digest;
}
function setCachedDigest(mobile: string, digest: string) {
  digestCache.set(mobile, { digest, expires: Date.now() + DIGEST_TTL_MS });
  if (digestCache.size > 500) {
    const oldest = digestCache.keys().next().value;
    if (oldest) digestCache.delete(oldest);
  }
}

// ---------- Weekly digest concurrency control ----------
// If multiple chat turns for the same user race to rebuild the digest (cache
// miss / expiry), we only want ONE Supabase 8-week query + aggregation in
// flight. Late arrivals await the same promise and reuse the result.
const digestInflight = new Map<string, Promise<string>>();

async function getOrBuildDigest(
  mobile: string,
  fetchRows: () => Promise<any[]>,
): Promise<string> {
  const cached = getCachedDigest(mobile);
  if (cached) return cached;
  const existing = digestInflight.get(mobile);
  if (existing) return existing;
  const p = (async () => {
    try {
      const rows = await fetchRows();
      const digest = buildWeeklyDigest(rows);
      if (digest) setCachedDigest(mobile, digest);
      return digest;
    } finally {
      digestInflight.delete(mobile);
    }
  })();
  digestInflight.set(mobile, p);
  return p;
}

function buildWeeklyDigest(rows: any[]): string {
  const weekStart = (d: Date) => {
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = dt.getUTCDay() || 7;
    if (dow !== 1) dt.setUTCDate(dt.getUTCDate() - (dow - 1));
    return dt.toISOString().slice(0, 10);
  };
  type WeekBucket = { total: number; unread: number; tags: Record<string, number>; titles: Record<string, number> };
  const weeks = new Map<string, WeekBucket>();
  for (const n of rows) {
    const created = n.created_at ? new Date(n.created_at) : null;
    if (!created || isNaN(created.getTime())) continue;
    const wk = weekStart(created);
    let b = weeks.get(wk);
    if (!b) { b = { total: 0, unread: 0, tags: {}, titles: {} }; weeks.set(wk, b); }
    b.total += 1;
    if (!n.read_at) b.unread += 1;
    const tag = (n.tag || "").toString().trim();
    if (tag) b.tags[tag] = (b.tags[tag] || 0) + 1;
    const title = (n.title || "").toString().trim();
    if (title) b.titles[title] = (b.titles[title] || 0) + 1;
  }
  const topEntries = (rec: Record<string, number>, k = 2) =>
    Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, k)
      .map(([k2, v]) => `${k2}×${v}`).join(", ");
  return [...weeks.entries()]
    .sort((a, b) => a[0] < b[0] ? 1 : -1)
    .slice(0, 8)
    .map(([wk, b]) => {
      const parts = [`${b.total} total`, `${b.unread} unread`];
      const tagTop = topEntries(b.tags);
      const titleTop = topEntries(b.titles);
      if (tagTop) parts.push(`tags: ${tagTop}`);
      else if (titleTop) parts.push(`top: ${titleTop}`);
      return `- Week of ${wk}: ${parts.join(" · ")}`;
    })
    .join("\n");
}

// ---------- Handler ----------


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const { mobile, token } = await getMobileAndToken(req);
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lightweight overview to seed context without dumping every record.
    const currentYear = String(new Date().getFullYear());
    const currentMonth = new Date().getMonth() + 1;
    const [customers, cards, txnsRaw, notifCounts] = await Promise.all([
      fetchResource("customers", mobile),
      fetchResource("cards", mobile),
      fetchResource("transactions", mobile, { monthYear: currentYear }),
      (async () => {
        try {
          const supa = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: `Bearer ${token}` } } },
          );
          const cachedDigest = getCachedDigest(mobile);
          const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString();
          const queries: Promise<any>[] = [
            supa.from("notification_inbox").select("*", { count: "exact", head: true }).eq("mobile", mobile),
            supa.from("notification_inbox").select("*", { count: "exact", head: true }).eq("mobile", mobile).is("read_at", null),
            supa.from("notification_inbox")
              .select("title,created_at,read_at")
              .eq("mobile", mobile)
              .order("created_at", { ascending: false })
              .limit(5),
            supa.from("notification_inbox")
              .select("title,body,created_at")
              .eq("mobile", mobile)
              .is("read_at", null)
              .order("created_at", { ascending: false })
              .limit(5),
          ];
          // Dedupe the heavy 8-week query: if another concurrent request for the
          // same mobile is already fetching + aggregating, await that promise
          // instead of hitting Supabase again. On a cache hit, skip entirely.
          const digestPromise: Promise<string> = cachedDigest
            ? Promise.resolve(cachedDigest)
            : getOrBuildDigest(mobile, async () => {
                const { data } = await supa.from("notification_inbox")
                  .select("title,tag,created_at,read_at")
                  .eq("mobile", mobile)
                  .gte("created_at", eightWeeksAgo)
                  .order("created_at", { ascending: false })
                  .limit(500);
                return data ?? [];
              });
          const [results, weeklyDigest] = await Promise.all([
            Promise.all(queries),
            digestPromise,
          ]);
          const [totalR, unreadR, recentR, unreadRecentR] = results;
          return {
            total: totalR.count ?? 0,
            unread: unreadR.count ?? 0,
            recent: recentR.data ?? [],
            unreadRecent: unreadRecentR.data ?? [],
            weeklyDigest,
          };
        } catch { return { total: 0, unread: 0, recent: [] as any[], unreadRecent: [] as any[], weeklyDigest: "" }; }

      })(),
    ]);

    const cardCount = toArray(cards).length;
    const cust = toArray(customers)[0] || customers || {};
    const custName = (cust as any)?.name || (cust as any)?.customer_name || "";

    // Delivery (transaction) counts derived from upstream transactions.
    const txnList = toArray(txnsRaw);
    let deliveriesYear = 0;
    let deliveriesMonth = 0;
    let lastDelivery: string | null = null;
    for (const t of txnList) {
      const d = pickDate(t);
      if (!d) continue;
      deliveriesYear += 1;
      if (d.getMonth() + 1 === currentMonth) deliveriesMonth += 1;
      const iso = d.toISOString().slice(0, 10);
      if (!lastDelivery || iso > lastDelivery) lastDelivery = iso;
    }

    const recentTitles = (notifCounts.recent as any[])
      .map((n) => `- ${n.title}${n.read_at ? "" : " (unread)"}`)
      .join("\n");

    const truncate = (s: string, n = 400) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");
    const unreadDetails = (notifCounts.unreadRecent as any[])
      .map((n) => {
        const date = n.created_at ? String(n.created_at).slice(0, 10) : "";
        return `- [${date}] ${n.title}\n  ${truncate(n.body)}`.trimEnd();
      })
      .join("\n");


    // Weekly digest — cached per mobile for DIGEST_TTL_MS to avoid re-running
    // the 8-week query and re-aggregating on every chat turn.
    let weeklyDigest = notifCounts.cachedDigest ?? "";
    if (!weeklyDigest) {
      weeklyDigest = buildWeeklyDigest(notifCounts.recentWindow as any[]);
      if (weeklyDigest) setCachedDigest(mobile, weeklyDigest);
    }



    const systemPrompt = [
      "You are the in-app AI assistant for Mera Rashan (a Pakistani grocery-ration management app).",
      "Answer the signed-in user's questions about their own rashan cards, transactions (deliveries), monthly statements, and notifications.",
      "You have tools to fetch data on demand — call them whenever you need specifics; do not guess.",
      "Prefer summary tools (get_monthly_summary, get_category_summary, get_shops_summary) over listing raw transactions when the user asks about spending patterns.",
      "When the user asks about notification patterns or trends, cite the weekly digest below instead of listing every notification. Only call get_notifications when they want specific items.",
      "Reply in the language of the user's question (English or Urdu). Use short, clear answers with markdown. Format amounts as `Rs. 1,234`.",
      "If a tool returns no data or an error, tell the user plainly rather than inventing values.",

      "",
      `Today's date: ${new Date().toISOString().slice(0, 10)}. Signed-in mobile: ${mobile}.`,
      `Profile: ${custName ? `customer name "${custName}", ` : ""}${cardCount} card(s).`,
      `Deliveries in ${currentYear}: ${deliveriesYear} total, ${deliveriesMonth} this month${lastDelivery ? `, last on ${lastDelivery}` : ""}.`,
      `Notifications: ${notifCounts.total} total, ${notifCounts.unread} unread.`,
      recentTitles ? `Recent notifications:\n${recentTitles}` : "",
      unreadDetails ? `Recent unread notification messages:\n${unreadDetails}` : "",
      weeklyDigest ? `Weekly notification digest (last ~8 weeks, newest first):\n${weeklyDigest}` : "",


    ].filter(Boolean).join("\n");

    const convo: GwMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    ];

    // Tool loop: iterate non-streaming until the model stops calling tools,
    // then stream the final answer.
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await callGateway(apiKey, {
        model: MODEL,
        messages: convo,
        tools,
        tool_choice: "auto",
        stream: false,
      });
      if (!res.ok) return gwError(res.status, await res.text());
      const json = await res.json() as {
        choices: { message: GwMessage; finish_reason?: string }[];
      };
      const msg = json.choices?.[0]?.message;
      if (!msg) return gwError(500, "Empty gateway response");

      const calls = msg.tool_calls;
      if (!calls || calls.length === 0) {
        // No tools requested — stream a follow-up completion so the client
        // receives the answer as text/event-stream chunks.
        break;
      }

      // Append assistant tool_calls message, then execute each call.
      convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
      for (const call of calls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* ignore */ }
        let result: unknown;
        try {
          result = await runTool(call.function.name, args, { mobile, token });
        } catch (e) {
          result = { error: e instanceof Error ? e.message : "Tool failed" };
        }
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result).slice(0, 20000),
        });
      }
    }

    // Final streaming call — no tools; produce the user-facing answer.
    const finalRes = await callGateway(apiKey, {
      model: MODEL,
      messages: convo,
      stream: true,
    });
    if (!finalRes.ok) return gwError(finalRes.status, await finalRes.text());

    return new Response(finalRes.body, {
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
