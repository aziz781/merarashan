import type { ToolContext } from "@lovable.dev/mcp-js";

const BASE_URL = "https://data.merarashan.pk";
const FORWARD_PARAMS = ["month", "year", "monthYear", "rcNum", "status", "customerNumber"] as const;

export function requireMobile(ctx: ToolContext): string | { error: string } {
  if (!ctx.isAuthenticated()) return { error: "Not authenticated." };
  const email = ctx.getUserEmail() ?? "";
  const mobile = email.split("@")[0] ?? "";
  if (!/^\d{6,15}$/.test(mobile)) return { error: "Signed-in user has no valid mobile identity." };
  return mobile;
}

export async function fetchResource(
  resource: "cards" | "transactions" | "customers" | "statements",
  mobile: string,
  params?: Record<string, string | undefined>,
): Promise<unknown> {
  const token = process.env.MERARASHAN_API_TOKEN;
  if (!token) throw new Error("MERARASHAN_API_TOKEN is not configured.");

  const url = new URL(`${BASE_URL}/${resource}`);
  url.searchParams.set("mobile", mobile);
  if (params) {
    for (const key of FORWARD_PARAMS) {
      const v = params[key];
      if (v) url.searchParams.set(key, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": token, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upstream ${resource} failed [${res.status}]: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
