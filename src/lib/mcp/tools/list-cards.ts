import { defineTool } from "@lovable.dev/mcp-js";
import { fetchResource, requireMobile } from "../upstream";

export default defineTool({
  name: "list_cards",
  title: "List rashan cards",
  description: "List all rashan cards belonging to the signed-in Mera Rashan user.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (_input, ctx) => {
    const mobile = requireMobile(ctx);
    if (typeof mobile !== "string") {
      return { content: [{ type: "text", text: mobile.error }], isError: true };
    }
    try {
      const data = await fetchResource("cards", mobile);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: { cards: data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }
  },
});
