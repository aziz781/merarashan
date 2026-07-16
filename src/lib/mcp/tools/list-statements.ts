import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchResource, requireMobile } from "../upstream";

export default defineTool({
  name: "list_statements",
  title: "List statements",
  description:
    "List rashan statements for the signed-in user. Optionally filter by month (1-12) and year (YYYY), or by a specific rashan card number.",
  inputSchema: {
    month: z.string().regex(/^\d{1,2}$/).optional().describe("Month as 1-12."),
    year: z.string().regex(/^\d{4}$/).optional().describe("Year as YYYY."),
    rcNum: z.string().optional().describe("Rashan card number to scope the results."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    const mobile = requireMobile(ctx);
    if (typeof mobile !== "string") {
      return { content: [{ type: "text", text: mobile.error }], isError: true };
    }
    try {
      const data = await fetchResource("statements", mobile, input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: { statements: data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }
  },
});
