import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchResource, requireMobile } from "../upstream";

export default defineTool({
  name: "list_transactions",
  title: "List transactions",
  description:
    "List rashan transactions for the signed-in user. Optionally filter by month (1-12), year (YYYY), rashan card number, or customer number.",
  inputSchema: {
    month: z.string().regex(/^\d{1,2}$/).optional().describe("Month as 1-12."),
    year: z.string().regex(/^\d{4}$/).optional().describe("Year as YYYY."),
    rcNum: z.string().optional().describe("Rashan card number to scope the results."),
    customerNumber: z.string().optional().describe("Customer number to scope the results."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    const mobile = requireMobile(ctx);
    if (typeof mobile !== "string") {
      return { content: [{ type: "text", text: mobile.error }], isError: true };
    }
    try {
      const data = await fetchResource("transactions", mobile, input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: { transactions: data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }
  },
});
