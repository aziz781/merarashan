# In-App Customer Support Chat

## Goal
Add a one-to-one, human-only support chat inside the Mera Rashan app. Each user has one continuous conversation stored in Lovable Cloud. Support agents reply through a protected in-app admin view.

## Database schema

### `public.support_conversations`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid references auth.users(id) on delete cascade not null` (one conversation per user)
- `status text default 'open'` (`open`, `resolved`, `closed`)
- `created_at`, `updated_at` timestamps
- `GRANT SELECT, INSERT, UPDATE` to `authenticated`; `ALL` to `service_role`
- RLS enabled; users can only see/update their own row; admins can see all.

### `public.support_messages`
- `id uuid primary key default gen_random_uuid()`
- `conversation_id uuid references support_conversations(id) on delete cascade not null`
- `sender_type text not null` (`user`, `agent`)
- `content text not null`
- `read_at timestamptz` (null = unread)
- `created_at`, `updated_at` timestamps
- `GRANT SELECT, INSERT` to `authenticated`; `ALL` to `service_role`
- RLS enabled; users can only see messages in their own conversation; agents can see all.

## Backend

- Supabase Realtime channel on `support_messages:conversation_id=eq.<id>` so new agent replies appear instantly.
- Edge Function `mark-message-read` (or direct authenticated update) to set `read_at` when the user opens the chat.
- Reuse existing `is-admin` Edge Function / admin role check for the agent reply page.

## UI

1. **Floating support button** on home (`/`) — opens `/support`.
2. **Support chat page** at `/support`:
   - One continuous conversation per user.
   - Message list (user bubbles right, agent bubbles left).
   - Composer with text input and send button.
   - Unread badge derived from `read_at IS NULL AND sender_type = 'agent'`.
3. **Admin support dashboard** at `/admin/support`:
   - List all open conversations (user mobile/name, last message preview, unread count).
   - Tap to open a conversation and reply.
   - Mark as resolved/closed.
   - Protected by admin check; non-admins see "Access denied".

## Navigation & routing
- Add `/support` route in `App.tsx`.
- Add `/admin/support` route (admin-only).
- Add "Support" item in `SideMenu.tsx`.

## Realtime & offline
- Subscribe to new messages on the support page.
- Use existing offline banner / network status; queue sends are not required for v1 (show error on failure).

## Out of scope
- Push notifications for new agent replies (can be added later).
- File/attachment uploads.
- AI-generated suggested replies.
