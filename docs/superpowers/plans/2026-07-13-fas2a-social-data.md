# Fas 2a — Social Data + RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The private social schema (profiles, friends, conversation-per-friend chats) with RLS proven so a non-member cannot read another pair's messages, plus the get-or-create-conversation RPC and Realtime on messages.

**Architecture:** One migration (`0005_social.sql`) adds the tables, a profile-auto-create trigger, a `SECURITY DEFINER` membership helper (avoids RLS recursion), the `get_or_create_direct_conversation` RPC, RLS policies, and adds `messages` to the realtime publication. Verified against the remote DB, including an adversarial RLS test with three real auth users.

**Tech Stack:** Supabase Postgres via CLI migrations; verification via the Management API (SQL) + the Auth admin/token REST endpoints and PostgREST with per-user JWTs.

## Global Constraints

- Standalone project — no Z-Profil / `ltkumctoowadvqtdytvw` refs. Ref `kqujhispsknyxcmpfdkl`.
- All DB change via `supabase/migrations/`. Use the Supabase CLI with the **personal** `SUPABASE_ACCESS_TOKEN` (sbp_…) + `SUPABASE_DB_PASSWORD`; do NOT use the Supabase MCP.
- Secrets/tokens from env only; never hardcoded/committed.
- `bun x tsc -b` green before commits.
- Deliverables done only after empirical verification against the real DB; report results.
- **Privacy is the point:** the RLS non-member-read test (Task 2) is a hard gate — it must return zero rows for a third user.
- Branch `fas-2-social`; feature branch → PR → Gustav merges. Never `git add -A`.

---

### Task 1: Migration `0005_social.sql`

**Files:**
- Create: `supabase/migrations/0005_social.sql`

**Interfaces:**
- Produces: tables `profiles`, `friendships`, `conversations`, `conversation_members`, `messages`; functions `handle_new_user()` (trigger), `is_conversation_member(uuid,uuid)`, `get_or_create_direct_conversation(uuid)`; RLS policies; `messages` in `supabase_realtime` publication.

- [ ] **Step 1: Write the migration**

```sql
-- 0005_social: accounts, friends, private conversation-per-friend chats.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  created_at timestamptz not null default now(),
  check (handle is null or handle ~ '^[a-z0-9_]{3,20}$')
);

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index friendships_addressee_idx on friendships (addressee_id, status);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on conversation_members (user_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('text','track')),
  body text,
  track_id uuid references tracks(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'text' and body is not null) or (kind = 'track' and track_id is not null))
);
create index messages_conversation_idx on messages (conversation_id, created_at);

-- Auto-create an empty profile row when a new auth user signs up.
create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Membership check as SECURITY DEFINER so RLS policies can call it without
-- recursing into conversation_members' own policy.
create function is_conversation_member(conv uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from conversation_members
                 where conversation_id = conv and user_id = uid);
$$;

-- Return the existing 1:1 conversation between caller and other_user (accepted
-- friends only) or create it with both members. Prevents duplicates/races.
create function get_or_create_direct_conversation(other_user uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = other_user then raise exception 'cannot converse with self'; end if;
  if not exists (
    select 1 from friendships f where f.status = 'accepted'
      and ((f.requester_id = me and f.addressee_id = other_user)
        or (f.requester_id = other_user and f.addressee_id = me))
  ) then raise exception 'not friends'; end if;

  select cm.conversation_id into conv
  from conversation_members cm
  join conversation_members cm2 on cm2.conversation_id = cm.conversation_id
  where cm.user_id = me and cm2.user_id = other_user
    and (select count(*) from conversation_members x
         where x.conversation_id = cm.conversation_id) = 2
  limit 1;
  if conv is not null then return conv; end if;

  insert into conversations default values returning id into conv;
  insert into conversation_members (conversation_id, user_id)
    values (conv, me), (conv, other_user);
  return conv;
end $$;

-- RLS
alter table profiles enable row level security;
alter table friendships enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;

create policy "profiles public read" on profiles
  for select to anon, authenticated using (true);
create policy "profiles update own" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "friendships select own" on friendships
  for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "friendships insert own" on friendships
  for insert to authenticated with check (requester_id = auth.uid());
create policy "friendships update party" on friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "conversations select member" on conversations
  for select to authenticated using (is_conversation_member(id, auth.uid()));

create policy "conv_members select own" on conversation_members
  for select to authenticated
  using (user_id = auth.uid() or is_conversation_member(conversation_id, auth.uid()));

create policy "messages select member" on messages
  for select to authenticated using (is_conversation_member(conversation_id, auth.uid()));
create policy "messages insert member" on messages
  for insert to authenticated
  with check (sender_id = auth.uid() and is_conversation_member(conversation_id, auth.uid()));

grant execute on function get_or_create_direct_conversation(uuid) to authenticated;

-- Realtime for live chat.
alter publication supabase_realtime add table messages;
```

- [ ] **Step 2: Push**

```bash
cd ~/dev/noisemap && printf 'Y\n' | env \
  SUPABASE_ACCESS_TOKEN="$SBP_TOKEN" SUPABASE_DB_PASSWORD="$DB_PASSWORD" supabase db push
```
Expected: `Applying migration 0005_social.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Verify schema + policies**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/kqujhispsknyxcmpfdkl/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select (select count(*) from information_schema.tables where table_name in ('"'"'profiles'"'"','"'"'friendships'"'"','"'"'conversations'"'"','"'"'conversation_members'"'"','"'"'messages'"'"')) tables, (select count(*) from pg_policies where tablename in ('"'"'messages'"'"','"'"'friendships'"'"','"'"'conversations'"'"','"'"'conversation_members'"'"','"'"'profiles'"'"')) policies, (select count(*) from pg_proc where proname='"'"'get_or_create_direct_conversation'"'"') rpc;"}'
```
Expected: `tables=5`, `policies` ≥ 9, `rpc=1`.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/noisemap && git add supabase/migrations/0005_social.sql
git -c commit.gpgsign=false commit -m "feat(db): 0005 social schema — profiles, friends, private chats, RLS, realtime"
```

---

### Task 2: Empirical RLS privacy proof (three real users)

**Files:** none (verification only). Uses a scratchpad script.

**Interfaces:**
- Consumes: Task 1 schema; env `SBP_TOKEN` (Management API), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Create three test users + profiles + friendship + a message, then prove isolation**

Write `scratchpad/rls-proof.mjs` (run with bun). It: (a) creates users A, B, C via the Auth admin API (service role, `email_confirm:true`, a password); (b) signs each in via password grant to get their JWTs; (c) sets handles via authed PostgREST update; (d) A→B friendship inserted by A then accepted by B; (e) A calls `get_or_create_direct_conversation(B)` (authed RPC) → conv; (f) A inserts a `text` message into conv; (g) **asserts:** B's authed select on messages in conv returns 1 row; **C's authed select on the same returns 0 rows**; C calling the RPC for A raises "not friends".

```js
const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SR = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = (path, body) => fetch(`${URL}/auth/v1/admin/${path}`, { method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
const signIn = (email, password) => fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json())
const rest = (jwt, path, method = 'GET', body) => fetch(`${URL}/rest/v1/${path}`, { method, headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined })
const rpc = (jwt, fn, args) => fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })

const pw = 'Test-123456'
const mk = async (tag) => { const e = `rlsproof_${tag}_${Date.now()}@example.com`; await admin('users', { email: e, password: pw, email_confirm: true }); const s = await signIn(e, pw); return { e, jwt: s.access_token, id: s.user.id } }
const A = await mk('a'), B = await mk('b'), C = await mk('c')
await rest(A.jwt, `profiles?id=eq.${A.id}`, 'PATCH', { handle: `a${Date.now() % 100000}` })
await rest(B.jwt, `profiles?id=eq.${B.id}`, 'PATCH', { handle: `b${Date.now() % 100000}` })
await rest(A.jwt, 'friendships', 'POST', { requester_id: A.id, addressee_id: B.id, status: 'pending' })
await rest(B.jwt, `friendships?requester_id=eq.${A.id}&addressee_id=eq.${B.id}`, 'PATCH', { status: 'accepted' })
const conv = (await (await rpc(A.jwt, 'get_or_create_direct_conversation', { other_user: B.id })).json())
await rest(A.jwt, 'messages', 'POST', { conversation_id: conv, sender_id: A.id, kind: 'text', body: 'hemligt' })
const bRows = await (await rest(B.jwt, `messages?conversation_id=eq.${conv}&select=body`)).json()
const cRows = await (await rest(C.jwt, `messages?conversation_id=eq.${conv}&select=body`)).json()
const cRpc = await (await rpc(C.jwt, 'get_or_create_direct_conversation', { other_user: A.id })).json()
console.log('conv:', conv)
console.log('B sees messages:', JSON.stringify(bRows), '(expect 1)')
console.log('C sees messages:', JSON.stringify(cRows), '(expect 0 / [])')
console.log('C rpc for A:', JSON.stringify(cRpc), '(expect not-friends error)')
if (!(Array.isArray(bRows) && bRows.length === 1)) throw new Error('FAIL: B should see 1 message')
if (!(Array.isArray(cRows) && cRows.length === 0)) throw new Error('FAIL: C must see 0 messages')
console.log('RLS PRIVACY PROOF PASSED')
```

Run:
```bash
cd ~/dev/noisemap && env SUPABASE_URL="https://kqujhispsknyxcmpfdkl.supabase.co" \
  SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  bun scratchpad/rls-proof.mjs
```
Expected: `B sees messages: [{"body":"hemligt"}] (expect 1)`, `C sees messages: [] (expect 0)`, C's RPC returns a `not friends` error, and finally `RLS PRIVACY PROOF PASSED`.

- [ ] **Step 2: Verify realtime publication includes messages**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/kqujhispsknyxcmpfdkl/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select count(*) as in_realtime from pg_publication_tables where pubname='"'"'supabase_realtime'"'"' and tablename='"'"'messages'"'"';"}'
```
Expected: `in_realtime=1`.

- [ ] **Step 3: Record the proof output** in the PR body (Task 3). No commit (the script stays in scratchpad, outside the repo).

---

### Task 3: Docs + PR

**Files:**
- Modify: `docs/PHASES.md`

- [ ] **Step 1:** Update `docs/PHASES.md` Fas 2 block to note Fas 2a done (social schema + RLS proof) and Fas 2b next (the app). Add the "Överraska mig" backlog line under Fas 3.

- [ ] **Step 2:** `git add docs/PHASES.md && git commit`.

- [ ] **Step 3:** push `fas-2-social` (Gebbzkovich credential, in-memory) and open a PR to `main` whose body includes the Task 1 schema counts and the **verbatim RLS proof output** (B sees 1, C sees 0). Report the PR URL.

---

## Self-Review

**Spec coverage:** profiles/friendships/conversations/members/messages ✓ Task 1; profile-create trigger ✓; `get_or_create_direct_conversation` RPC (friends-only, no dup) ✓; RLS policies incl. the messages member-only read/insert ✓; realtime on messages ✓; the non-member-read privacy gate ✓ Task 2. The app (auth UI, friends UI, chat, share sheet) is **Fas 2b** — the next plan.

**Placeholder scan:** complete SQL + a complete runnable proof script; no TBD.

**Type/name consistency:** `is_conversation_member(conv,uid)` used in the conversations/conv_members/messages policies matches its definition; `get_or_create_direct_conversation(other_user)` granted to `authenticated` and called in Task 2; `messages(kind,body,track_id)` CHECK matches the insert in the proof (`kind:'text', body`).
