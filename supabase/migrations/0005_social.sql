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
