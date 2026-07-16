import { defineTool } from "@lovable.dev/mcp-js";
import { fetchResource, requireMobile } from "../upstream";

export default defineTool({
  name: "list_customers",
  title: "List customer profiles",
  description:
    "List the customer profiles (rashan account holders) linked to the signed-in Mera Rashan user's mobile number.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (_input, ctx) => {
    const mobile = requireMobile(ctx);
    if (typeof mobile !== "string") {
      return { content: [{ type: "text", text: mobile.error }], isError: true };
    }
    try {
      const data = await fetchResource("customers", mobile);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: { customers: data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }
  },
});
