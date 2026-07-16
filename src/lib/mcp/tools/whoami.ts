import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the mobile number of the currently signed-in Mera Rashan user.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const email = ctx.getUserEmail() ?? "";
    const mobile = email.split("@")[0] ?? "";
    return {
      content: [{ type: "text", text: `Signed in as mobile ${mobile}` }],
      structuredContent: { mobile },
    };
  },
});
