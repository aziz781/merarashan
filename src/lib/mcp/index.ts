import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listCardsTool from "./tools/list-cards";
import listTransactionsTool from "./tools/list-transactions";
import listStatementsTool from "./tools/list-statements";
import listCustomersTool from "./tools/list-customers";

// The OAuth issuer must be the direct supabase.co host, built from the project
// ref (Vite inlines VITE_SUPABASE_PROJECT_ID at build time, so this stays
// import-safe — no runtime env read at module top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mera-rashan-mcp",
  title: "Mera Rashan",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in Mera Rashan user. Use `whoami` to confirm identity, `list_customers` to see linked customer profiles, `list_cards` for rashan cards, `list_transactions` for transactions (optionally by month/year), and `list_statements` for monthly statements. All tools act only on the signed-in user's own data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listCustomersTool, listCardsTool, listTransactionsTool, listStatementsTool],
});
