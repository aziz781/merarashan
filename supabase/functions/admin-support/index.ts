import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorizedResponse } from "../_shared/admin.ts";
import { z } from "npm:zod";

const SendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

const UpdateStatusSchema = z.object({
  conversation_id: z.string().uuid(),
  status: z.enum(["open", "resolved", "closed"]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let adminMobile = "";
  try {
    const admin = await requireAdmin(req);
    adminMobile = admin.mobile;
  } catch (e) {
    return unauthorizedResponse(e);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (action === "list") {
      const { data: conversations, error } = await supabase
        .from("support_conversations")
        .select("id, user_id, status, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((conversations || []).map((c) => c.user_id))];
      const { data: users, error: usersError } = await supabase.auth.admin.getUsers({
        ids: userIds,
      });
      if (usersError) throw usersError;

      const userMap = new Map((users?.users || []).map((u) => [u.id, u]));

      const { data: messages, error: msgError } = await supabase
        .from("support_messages")
        .select("id, conversation_id, sender_type, content, read_at, created_at")
        .in(
          "conversation_id",
          (conversations || []).map((c) => c.id),
        )
        .order("created_at", { ascending: false });

      if (msgError) throw msgError;

      const messagesByConversation = new Map<string, typeof messages>();
      for (const m of messages || []) {
        const arr = messagesByConversation.get(m.conversation_id) || [];
        arr.push(m);
        messagesByConversation.set(m.conversation_id, arr);
      }

      const result = (conversations || []).map((c) => {
        const msgs = messagesByConversation.get(c.id) || [];
        const latest = msgs[0];
        const unread = msgs.filter((m) => m.sender_type === "user" && !m.read_at).length;
        const user = userMap.get(c.user_id);
        const mobile = (user?.user_metadata as { mobile?: string } | undefined)?.mobile || "";
        return {
          ...c,
          mobile,
          latest_message: latest
            ? {
                sender_type: latest.sender_type,
                content: latest.content,
                created_at: latest.created_at,
                read_at: latest.read_at,
              }
            : null,
          unread_user_messages: unread,
        };
      });

      return new Response(JSON.stringify({ conversations: result, adminMobile }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "messages") {
      const conversationId = url.searchParams.get("conversation_id");
      if (!conversationId || !z.string().uuid().safeParse(conversationId).success) {
        return new Response(JSON.stringify({ error: "conversation_id is required" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const { data, error } = await supabase
        .from("support_messages")
        .select("id, conversation_id, sender_type, content, read_at, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Mark user messages as read when an agent opens the conversation.
      await supabase
        .from("support_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "user")
        .is("read_at", null);

      return new Response(JSON.stringify({ messages: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: corsHeaders,
        });
      }
      const parsed = SendMessageSchema.safeParse(await req.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { conversation_id, content } = parsed.data;

      const { data: message, error } = await supabase
        .from("support_messages")
        .insert({ conversation_id, sender_type: "agent", content })
        .select("id, conversation_id, sender_type, content, read_at, created_at")
        .single();

      if (error) throw error;

      await supabase
        .from("support_conversations")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", conversation_id);

      return new Response(JSON.stringify({ message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: corsHeaders,
        });
      }
      const parsed = UpdateStatusSchema.safeParse(await req.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { conversation_id, status } = parsed.data;

      const { error } = await supabase
        .from("support_conversations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", conversation_id);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
