# Musikmaskinen — Fas 2: Social (design spec)

**Date:** 2026-07-13
**Status:** Approved direction, pending written-spec review
**Supabase ref:** `kqujhispsknyxcmpfdkl` · **Repo:** Gebbzkovich/musikmaskinen
**Branch:** `fas-2-social`

## Vision

The hook of Musikmaskinen: **send a song with a comment to a friend, exactly like
sharing a TikTok** — one tap, pick a friend, add a line, it lands in a **private
chat** you two keep talking in. Nothing is ever public. Built on top of the Fas 1
browse+player app; a shared song references a real `tracks.id` (Fas 1a) and plays
its iTunes preview inline.

## Goals

1. **Accounts** — temporary email auth now, provider-agnostic so **Sign in with
   Apple** (or Google/magic-link) slots in later with no rebuild.
2. **Profiles** — a unique **`@handle`** + display name per user.
3. **Friends** — find someone by `@handle`, send a request, accept.
4. **Conversation per friend** (TikTok/DM model) — a chat is a stream of
   **messages**; a message is either a **shared song** (`kind:'track'`, references a
   track) or a **comment** (`kind:'text'`). Sharing a song and commenting are the
   same primitive: a message in the conversation.
5. **Share flow** — the track Share button (Fas 1b) becomes: tap → row of friends'
   avatars → pick friend(s) + optional comment → sends the song into your chat with
   them (creating it if new). Copy-link stays.
6. **Realtime** — Supabase Realtime on messages → chats update live.
7. **Privacy (never public)** — RLS so only conversation members can read/write a
   conversation's messages; friendships scoped to self. Proven with a non-member
   read test.

## Non-goals (deferred)

- **Sign in with Apple wiring** — needs the user's Apple Developer Program ($99/yr):
  Services ID + `.p8` key + Team ID + provider config in Supabase. The app ships the
  provider-agnostic auth UI + flow so Apple (or Google) is a config swap. The
  temporary email auth is clearly marked and replaceable.
- **Group chats** — start 1:1; the `conversation_members` model already generalizes
  to groups, so groups are additive later.
- **Push notifications** — later.

## Identity & auth

- Supabase Auth. **Temp provider: email + password** (labelled temporary in the UI).
  The app never hardcodes provider specifics; swapping to Apple/Google is a Supabase
  dashboard config + one button.
- `profiles` table: `id uuid pk references auth.users(id) on delete cascade`,
  `handle text unique not null` (lowercased, `^[a-z0-9_]{3,20}$`), `display_name text`,
  `created_at`. Handle is chosen on first login (a gate before entering the app).
- A DB trigger creates an empty `profiles` row on new `auth.users` insert;
  the handle-setup screen fills `handle`/`display_name`.

## Data model (migration `0005_social.sql`)

- `profiles(id, handle unique, display_name, created_at)`.
- `friendships(id, requester_id, addressee_id, status, created_at, unique(requester_id,addressee_id))`
  where `status in ('pending','accepted')`. A CHECK forbids `requester_id = addressee_id`.
  "My friends" = accepted rows where I am requester or addressee.
- `conversations(id, created_at)`.
- `conversation_members(conversation_id, user_id, created_at, primary key(conversation_id,user_id))`.
- `messages(id, conversation_id, sender_id, kind, body, track_id, created_at)` where
  `kind in ('text','track')`; `body` set for text, `track_id references tracks(id)` set
  for track. Index on `(conversation_id, created_at)`.
- Helper RPC `get_or_create_direct_conversation(other_user uuid) returns uuid` —
  SECURITY DEFINER: returns the existing 1:1 conversation between the caller and
  `other_user` (both accepted friends) or creates it + both members. Prevents
  duplicate conversations and races.

## RLS (the privacy core)

- `profiles`: public `select` (needed to look up handles for friend requests);
  users `update` only their own row.
- `friendships`: `select`/`insert`/`update` only where `auth.uid()` is requester or
  addressee. Accepting = the addressee updates `status` to `accepted`.
- `conversation_members`: `select` rows where `auth.uid() = user_id` (see your own
  memberships). Inserts happen via the SECURITY DEFINER RPC only.
- `conversations`: `select` where `auth.uid()` is a member (subquery on
  `conversation_members`).
- `messages`: `select` where `auth.uid()` is a member of the message's conversation;
  `insert` only where the sender is `auth.uid()` AND a member of that conversation.
  No update/delete in Fas 2. **This is what makes comments private to the chosen
  people** — a non-member's select returns zero rows (verified in the plan).

## App architecture (additions to the Fas 1b React app)

- `src/auth/` — Supabase auth session context (`useSession`), sign-in/up screen,
  handle-setup gate, sign-out. Anonymous browsing stays allowed; social features
  require a session.
- `src/social/db.ts` — repo: `searchProfiles(handle)`, `sendFriendRequest`,
  `acceptFriendRequest`, `listFriends`, `listRequests`, `listConversations`,
  `getMessages(conversationId)`, `shareTrackToFriend(friendId, trackId, comment?)`
  (calls the RPC then inserts messages), `sendText(conversationId, body)`.
- `src/social/realtime.ts` — subscribe to `messages` inserts for a conversation.
- Routes: `/inbox` (conversation list), `/c/:conversationId` (chat), `/friends`
  (friends + requests + add-by-handle), `/me` (profile + sign out), `/login`,
  `/setup` (handle). A new **Inbox** tab in the glass TabBar (replaces the inert
  search glyph or adds a 5th).
- Components: `ConversationList`, `ChatView` (message stream: text bubbles + inline
  playable **SongCard**), `MessageComposer`, `ShareSheet` (friend avatars + comment),
  `FriendList`, `AddFriend`, `RequestList`, `SongCard` (reuses the Fas 1 player).
- The Fas 1 `ShareButton` gains an in-app path: if signed in → open `ShareSheet`;
  else → the existing copy-link / native share.

## Realtime & playback

- `ChatView` subscribes to `messages` inserts filtered by `conversation_id`;
  appends live. Optimistic local echo on send, reconciled by the realtime row.
- A `track` message renders a `SongCard` that plays the preview via the existing
  player store (`playQueue([track], 0)`), so you hear what a friend sent inline.

## Verification (empirical, before ✅)

- Migration `0005` pushed; schema + policies verified by query.
- **RLS proof:** as user A create a conversation + message with user B; confirm a
  third user C's `select` on those messages returns **zero rows** (run via two anon
  JWTs / the REST API with different users). This is the non-negotiable privacy gate.
- **Two-user flow:** A adds B by handle → B accepts → A shares a song with a comment
  → it appears in B's inbox/chat → B replies → both see the thread; realtime delivers
  without refresh; a shared SongCard plays the preview.
- `bun x tsc -b` green; `bun run build` succeeds; screenshots of login, handle setup,
  inbox, chat with a song card, share sheet.

## Backlog (do later — Fas 3 discovery)

- **"Överraska mig" (Surprise me)** — a button that plays a **random song from a
  random (sub)genre**. From there two paths: (a) **keep shuffling** — next surprise is
  a new random song from a random genre (mixed-genre radio), or (b) **"go to this
  genre"** — jump to the song's subgenre to hear more of the same type. A
  shuffle/radio discovery mode over the whole catalog with a dive-into-genre exit.
  Independent of the social layer; fits Fas 3.

## Roadmap (updates docs/PHASES.md)

- **Fas 1** ✅ — browse + player (data + app), merged.
- **Fas 2** (this spec) — social: accounts, friends, TikTok-style share-song-with-
  comment, private conversation-per-friend chats, realtime. Temp email auth →
  Apple/Google later.
- **Fas 3** — discovery ("Överraska mig" radio), richer previews, more service links.
- **Fas 4** — polish / PWA / notifications.

## Decisions locked

- Conversation-per-friend (TikTok/DM); song-share and comment are both messages.
- Friends via `@handle` + request/accept. Nothing public — RLS-enforced.
- Temp email auth now; provider-agnostic; Apple ($99/yr) or Google/magic-link later.
- Realtime via Supabase Realtime. Start 1:1 (groups later).
