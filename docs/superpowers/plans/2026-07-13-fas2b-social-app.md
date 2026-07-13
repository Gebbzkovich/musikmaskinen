# Fas 2b — Social App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The social UI on top of the Fas 1 app + Fas 2a data: magic-link + Google login, `@handle` setup, friends (`@handle` request/accept), an inbox of private per-friend chats where a shared song and a comment are both messages, realtime updates, inline playable song cards, and a share sheet reachable from any track.

**Architecture:** Adds an auth session context, a social data repo over the authed Supabase client (RLS enforces privacy), a realtime subscription, and screens (login, handle setup, inbox, chat, friends, profile). Reuses the Fas 1 player store for inline preview playback in chat. New tabs in the glass TabBar.

**Tech Stack:** React 19, react-router v7, @supabase/supabase-js (auth + realtime), Tailwind v4, bun. All installed.

## Global Constraints

- Standalone project — no Z-Profil / `ltkumctoowadvqtdytvw` refs. Ref `kqujhispsknyxcmpfdkl` (anon key in gitignored `.env.local`).
- `bun x tsc -b` green + `bun run build` succeeds before commits.
- No `any` in app code (typed row shapes / `unknown`+narrowing); no secrets (anon key only).
- **Privacy:** all reads go through the authed client; never bypass RLS. The DB already blocks non-members (proven in Fas 2a) — the UI must not try to over-fetch.
- Design: dark premium glass (reuse `src/styles/tokens.css` + `.glass`), text on top, mobile-first, compositor-only animation.
- Auth: **magic link (email) + Google** only. Google needs a one-time free Supabase→Google provider config (button ships regardless). No Apple now.
- Realtime via `supabase.channel(...)` postgres_changes on `messages`.
- Branch `fas-2b-social-app`; feature branch → PR → Gustav merges. Never `git add -A`.

---

### Task 1: Auth session context + login + sign-out

**Files:**
- Create: `src/auth/session.tsx`, `src/auth/LoginScreen.tsx`

**Interfaces:**
- Produces: `<SessionProvider>`, `useSession(): { session, loading }`; `LoginScreen`.

- [ ] **Step 1: session.tsx**
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface SessionValue { session: Session | null; loading: boolean }
const Ctx = createContext<SessionValue>({ session: null, loading: true })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return <Ctx.Provider value={{ session, loading }}>{children}</Ctx.Provider>
}

export function useSession(): SessionValue { return useContext(Ctx) }
```

- [ ] **Step 2: LoginScreen.tsx**
```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const magic = async () => {
    setErr(null)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) setErr(error.message); else setSent(true)
  }
  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setErr(error.message)
  }
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-[28px] font-bold tracking-tight">Musikmaskinen</h1>
      <p className="mt-1 text-white/55">Logga in för att dela låtar med vänner.</p>
      <button onClick={google} className="glass mt-8 flex h-12 items-center justify-center rounded-[14px] font-medium">Fortsätt med Google</button>
      <div className="my-4 text-center text-xs text-white/40">eller magisk länk</div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="du@exempel.se"
        className="glass h-12 rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      <button onClick={magic} disabled={!email} className="mt-3 flex h-12 items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Skicka länk</button>
      {sent && <p className="mt-4 text-center text-emerald-300/90">Kolla din mejl för inloggningslänken.</p>}
      {err && <p className="mt-4 text-center text-red-300">{err}</p>}
    </section>
  )
}
```

- [ ] **Step 3:** No standalone test (React/Supabase glue; a tautological test would be a defect). Coverage via build + Task 8 screenshots.

- [ ] **Step 4:** No commit yet (wired in Task 8).

---

### Task 2: Social types + data repo

**Files:**
- Create: `src/social/types.ts`, `src/social/db.ts`

**Interfaces:**
- Produces: types `Profile`, `Friend`, `Conversation`, `Message` (+ re-export `Track`); repo functions below.

- [ ] **Step 1: types.ts**
```ts
export interface Profile { id: string; handle: string | null; displayName: string | null }
export interface Conversation { id: string; other: Profile; lastAt: string | null; lastPreview: string | null }
export interface Message { id: string; conversationId: string; senderId: string; kind: 'text' | 'track'; body: string | null; trackId: string | null; createdAt: string }
export type { Track } from '../lib/types'
```

- [ ] **Step 2: db.ts**
```ts
import { supabase } from '../lib/supabase'
import type { Profile, Message } from './types'
import type { Track } from '../lib/types'

interface ProfileRow { id: string; handle: string | null; display_name: string | null }
const toProfile = (r: ProfileRow): Profile => ({ id: r.id, handle: r.handle, displayName: r.display_name })

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id,handle,display_name').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toProfile(data as ProfileRow) : null
}

export async function setMyProfile(userId: string, handle: string, displayName: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ handle: handle.toLowerCase(), display_name: displayName }).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function searchProfiles(handle: string): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('id,handle,display_name').ilike('handle', `${handle.toLowerCase()}%`).not('handle', 'is', null).limit(10)
  if (error) throw new Error(error.message)
  return (data as ProfileRow[]).map(toProfile)
}

export async function sendFriendRequest(me: string, addresseeId: string): Promise<void> {
  const { error } = await supabase.from('friendships').insert({ requester_id: me, addressee_id: addresseeId, status: 'pending' })
  if (error) throw new Error(error.message)
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
  if (error) throw new Error(error.message)
}

interface FriendshipRow { id: string; requester_id: string; addressee_id: string; status: string }
export async function listFriendships(me: string): Promise<{ accepted: { id: string; otherId: string }[]; incoming: { id: string; otherId: string }[]; outgoing: { id: string; otherId: string }[] }> {
  const { data, error } = await supabase.from('friendships').select('id,requester_id,addressee_id,status')
  if (error) throw new Error(error.message)
  const rows = data as FriendshipRow[]
  const accepted: { id: string; otherId: string }[] = []
  const incoming: { id: string; otherId: string }[] = []
  const outgoing: { id: string; otherId: string }[] = []
  for (const r of rows) {
    const otherId = r.requester_id === me ? r.addressee_id : r.requester_id
    if (r.status === 'accepted') accepted.push({ id: r.id, otherId })
    else if (r.addressee_id === me) incoming.push({ id: r.id, otherId })
    else outgoing.push({ id: r.id, otherId })
  }
  return { accepted, incoming, outgoing }
}

export async function getProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('profiles').select('id,handle,display_name').in('id', ids)
  if (error) throw new Error(error.message)
  return new Map((data as ProfileRow[]).map((r) => [r.id, toProfile(r)]))
}

interface MessageRow { id: string; conversation_id: string; sender_id: string; kind: 'text' | 'track'; body: string | null; track_id: string | null; created_at: string }
const toMessage = (r: MessageRow): Message => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, kind: r.kind, body: r.body, trackId: r.track_id, createdAt: r.created_at })

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('messages').select('id,conversation_id,sender_id,kind,body,track_id,created_at').eq('conversation_id', conversationId).order('created_at')
  if (error) throw new Error(error.message)
  return (data as MessageRow[]).map(toMessage)
}

export async function listMyConversationIds(): Promise<string[]> {
  const { data, error } = await supabase.from('conversation_members').select('conversation_id')
  if (error) throw new Error(error.message)
  return (data as { conversation_id: string }[]).map((r) => r.conversation_id)
}

export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { other_user: otherUserId })
  if (error) throw new Error(error.message)
  return data as string
}

export async function sendText(conversationId: string, senderId: string, body: string): Promise<void> {
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, kind: 'text', body })
  if (error) throw new Error(error.message)
}

export async function shareTrackToFriend(senderId: string, friendId: string, trackId: string, comment?: string): Promise<string> {
  const conv = await getOrCreateConversation(friendId)
  const { error } = await supabase.from('messages').insert({ conversation_id: conv, sender_id: senderId, kind: 'track', track_id: trackId })
  if (error) throw new Error(error.message)
  if (comment && comment.trim()) await sendText(conv, senderId, comment.trim())
  return conv
}

interface TrackRow { id: string; track_name: string; artist_name: string; artwork_url: string | null; preview_url: string | null; apple_music_url: string | null; duration_ms: number | null; itunes_track_id: number | null }
export async function getTracksByIds(ids: string[]): Promise<Map<string, Track>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('tracks').select('id,track_name,artist_name,artwork_url,preview_url,apple_music_url,duration_ms,itunes_track_id').in('id', ids)
  if (error) throw new Error(error.message)
  return new Map((data as TrackRow[]).map((r) => [r.id, { id: r.id, itunesTrackId: r.itunes_track_id ?? 0, trackName: r.track_name, artistName: r.artist_name, artworkUrl: r.artwork_url ?? '', previewUrl: r.preview_url ?? '', appleMusicUrl: r.apple_music_url ?? '', durationMs: r.duration_ms ?? 0 }]))
}
```

- [ ] **Step 3:** mark done (build in Task 8).

---

### Task 3: Realtime subscription

**Files:**
- Create: `src/social/realtime.ts`

**Interfaces:**
- Produces: `subscribeToConversation(conversationId, onInsert): () => void`.

- [ ] **Step 1: realtime.ts**
```ts
import { supabase } from '../lib/supabase'
import type { Message } from './types'

interface MessageRow { id: string; conversation_id: string; sender_id: string; kind: 'text' | 'track'; body: string | null; track_id: string | null; created_at: string }

export function subscribeToConversation(conversationId: string, onInsert: (m: Message) => void): () => void {
  const channel = supabase
    .channel(`conv:${conversationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const r = payload.new as MessageRow
        onInsert({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, kind: r.kind, body: r.body, trackId: r.track_id, createdAt: r.created_at })
      })
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
```

- [ ] **Step 2:** mark done.

---

### Task 4: Auth gate + handle setup + profile screen

**Files:**
- Create: `src/auth/AuthGate.tsx`, `src/auth/HandleSetup.tsx`, `src/routes/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 1), `getMyProfile`/`setMyProfile` (Task 2).
- Produces: `<AuthGate>` (redirects to `/login` if no session, `/setup` if no handle).

- [ ] **Step 1: AuthGate.tsx**
```tsx
import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { useSession } from './session'
import { getMyProfile } from '../social/db'

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  const [hasHandle, setHasHandle] = useState<boolean | null>(null)
  useEffect(() => {
    if (!session) { setHasHandle(null); return }
    getMyProfile(session.user.id).then((p) => setHasHandle(!!p?.handle)).catch(() => setHasHandle(false))
  }, [session])
  if (loading) return <p className="p-8 text-white/40">Laddar…</p>
  if (!session) return <Navigate to="/login" replace />
  if (hasHandle === null) return <p className="p-8 text-white/40">Laddar…</p>
  if (!hasHandle) return <Navigate to="/setup" replace />
  return <>{children}</>
}
```

- [ ] **Step 2: HandleSetup.tsx**
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from './session'
import { setMyProfile } from '../social/db'

export function HandleSetup() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const valid = /^[a-z0-9_]{3,20}$/.test(handle.toLowerCase())
  const save = async () => {
    if (!session) return
    setErr(null)
    try { await setMyProfile(session.user.id, handle, name || handle); navigate('/inbox', { replace: true }) }
    catch (e) { setErr(e instanceof Error ? (/duplicate|unique/i.test(e.message) ? 'Handle upptaget' : e.message) : 'Fel') }
  }
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-[24px] font-bold tracking-tight">Välj ditt handle</h1>
      <div className="glass mt-6 flex h-12 items-center rounded-[14px] px-4">
        <span className="text-white/40">@</span>
        <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="handle" className="ml-1 flex-1 bg-transparent outline-none placeholder:text-white/35" />
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Visningsnamn (valfritt)" className="glass mt-3 h-12 rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      <button onClick={save} disabled={!valid} className="mt-4 flex h-12 items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Fortsätt</button>
      <p className="mt-3 text-xs text-white/40">3–20 tecken, a–z, 0–9, _</p>
      {err && <p className="mt-3 text-red-300">{err}</p>}
    </section>
  )
}
```

- [ ] **Step 3: ProfileScreen.tsx**
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/session'
import { getMyProfile } from '../social/db'
import type { Profile } from '../social/types'

export function ProfileScreen() {
  const { session } = useSession()
  const [p, setP] = useState<Profile | null>(null)
  useEffect(() => { if (session) getMyProfile(session.user.id).then(setP).catch(() => {}) }, [session])
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Profil</h1>
      <div className="glass mt-6 rounded-[16px] p-4">
        <div className="text-lg font-semibold">@{p?.handle ?? '…'}</div>
        <div className="text-white/55">{p?.displayName}</div>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="glass mt-4 flex h-12 w-full items-center justify-center rounded-[14px] text-red-300">Logga ut</button>
    </section>
  )
}
```

- [ ] **Step 4:** mark done.

---

### Task 5: Friends screen (list + add-by-handle + requests)

**Files:**
- Create: `src/routes/FriendsScreen.tsx`

**Interfaces:**
- Consumes: `useSession`, `searchProfiles`, `sendFriendRequest`, `acceptFriendRequest`, `listFriendships`, `getProfilesByIds`, `getOrCreateConversation` (Task 2).

- [ ] **Step 1: FriendsScreen.tsx**
```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../auth/session'
import { searchProfiles, sendFriendRequest, acceptFriendRequest, listFriendships, getProfilesByIds, getOrCreateConversation } from '../social/db'
import type { Profile } from '../social/types'

export function FriendsScreen() {
  const { session } = useSession()
  const navigate = useNavigate()
  const me = session?.user.id ?? ''
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [friends, setFriends] = useState<Profile[]>([])
  const [incoming, setIncoming] = useState<{ id: string; profile: Profile }[]>([])
  const reload = async () => {
    const { accepted, incoming } = await listFriendships(me)
    const ids = [...accepted.map((a) => a.otherId), ...incoming.map((i) => i.otherId)]
    const profs = await getProfilesByIds(ids)
    setFriends(accepted.map((a) => profs.get(a.otherId)).filter((p): p is Profile => !!p))
    setIncoming(incoming.map((i) => ({ id: i.id, profile: profs.get(i.otherId) })).filter((x): x is { id: string; profile: Profile } => !!x.profile))
  }
  useEffect(() => { if (me) reload().catch(() => {}) }, [me])
  const doSearch = async (v: string) => { setQ(v); if (v.length >= 2) setResults((await searchProfiles(v)).filter((p) => p.id !== me)); else setResults([]) }
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Vänner</h1>
      <input value={q} onChange={(e) => doSearch(e.target.value)} placeholder="Sök @handle" className="glass mt-4 h-11 w-full rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      {results.map((p) => (
        <div key={p.id} className="mt-2 flex items-center gap-3 rounded-[13px] p-2">
          <div className="flex-1"><div className="font-medium">@{p.handle}</div><div className="text-xs text-white/50">{p.displayName}</div></div>
          <button onClick={async () => { await sendFriendRequest(me, p.id); setQ(''); setResults([]) }} className="glass rounded-[10px] px-3 py-1.5 text-sm">Lägg till</button>
        </div>
      ))}
      {incoming.length > 0 && <h2 className="mt-6 text-sm uppercase tracking-wide text-white/40">Förfrågningar</h2>}
      {incoming.map((r) => (
        <div key={r.id} className="mt-2 flex items-center gap-3 rounded-[13px] p-2">
          <div className="flex-1 font-medium">@{r.profile.handle}</div>
          <button onClick={async () => { await acceptFriendRequest(r.id); await reload() }} className="rounded-[10px] bg-white px-3 py-1.5 text-sm font-medium text-black">Acceptera</button>
        </div>
      ))}
      <h2 className="mt-6 text-sm uppercase tracking-wide text-white/40">Dina vänner</h2>
      {friends.map((p) => (
        <button key={p.id} onClick={async () => navigate(`/c/${await getOrCreateConversation(p.id)}`)} className="mt-2 flex w-full items-center gap-3 rounded-[13px] p-2 text-left active:bg-white/[0.06]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-semibold">{(p.handle ?? '?')[0]?.toUpperCase()}</div>
          <div className="flex-1"><div className="font-medium">@{p.handle}</div><div className="text-xs text-white/50">{p.displayName}</div></div>
        </button>
      ))}
      {friends.length === 0 && <p className="mt-3 text-white/40">Inga vänner ännu — sök ett @handle ovan.</p>}
    </section>
  )
}
```

- [ ] **Step 2:** mark done.

---

### Task 6: Inbox + TabBar update + routing

**Files:**
- Create: `src/routes/InboxScreen.tsx`
- Modify: `src/components/TabBar.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `useSession`, `listMyConversationIds`, `getMessages`, `getProfilesByIds` (Task 2). Adds routes + `<SessionProvider>` wrap + `<AuthGate>` on social routes.

- [ ] **Step 1: InboxScreen.tsx**
```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../auth/session'
import { listMyConversationIds, getMessages, getProfilesByIds } from '../social/db'
import { supabase } from '../lib/supabase'
import type { Profile } from '../social/types'

interface Row { id: string; other: Profile | null; preview: string }
export function InboxScreen() {
  const { session } = useSession()
  const me = session?.user.id ?? ''
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    if (!me) return
    ;(async () => {
      const convIds = await listMyConversationIds()
      const out: Row[] = []
      const otherIdByConv = new Map<string, string>()
      const { data } = await supabase.from('conversation_members').select('conversation_id,user_id').neq('user_id', me)
      for (const r of (data ?? []) as { conversation_id: string; user_id: string }[]) otherIdByConv.set(r.conversation_id, r.user_id)
      const profs = await getProfilesByIds([...otherIdByConv.values()])
      for (const id of convIds) {
        const msgs = await getMessages(id)
        const last = msgs[msgs.length - 1]
        out.push({ id, other: profs.get(otherIdByConv.get(id) ?? '') ?? null, preview: last ? (last.kind === 'track' ? '🎵 Delade en låt' : last.body ?? '') : 'Ny chatt' })
      }
      setRows(out)
    })().catch(() => {})
  }, [me])
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Inkorg</h1>
      {rows.length === 0 && <p className="mt-3 text-white/40">Inga chattar ännu. Dela en låt med en vän!</p>}
      {rows.map((r) => (
        <Link key={r.id} to={`/c/${r.id}`} className="mt-2 flex items-center gap-3 rounded-[13px] p-2 active:bg-white/[0.06]">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-semibold">{(r.other?.handle ?? '?')[0]?.toUpperCase()}</div>
          <div className="min-w-0 flex-1"><div className="font-medium">@{r.other?.handle ?? '…'}</div><div className="truncate text-[12.5px] text-white/50">{r.preview}</div></div>
        </Link>
      ))}
    </section>
  )
}
```

- [ ] **Step 2: TabBar.tsx (replace)**
```tsx
import { NavLink } from 'react-router'

const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'text-white' : 'text-white/50')
export function TabBar() {
  return (
    <nav className="glass fixed bottom-3 left-1/2 z-30 flex h-14 w-[min(480px,calc(100%-28px))] -translate-x-1/2 items-center justify-around rounded-[20px] px-3">
      <NavLink to="/" aria-label="Genrer" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H8v6H4a1 1 0 0 1-1-1z" /></svg></NavLink>
      <NavLink to="/inbox" aria-label="Inkorg" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H7l-3 3z" /></svg></NavLink>
      <NavLink to="/friends" aria-label="Vänner" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 6.5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.2-4-4.8" /></svg></NavLink>
      <NavLink to="/me" aria-label="Profil" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg></NavLink>
    </nav>
  )
}
```

- [ ] **Step 3: main.tsx (replace)**
```tsx
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { SessionProvider } from './auth/session'
import { AuthGate } from './auth/AuthGate'
import { AppShell } from './components/AppShell'
import { GenresPage } from './routes/GenresPage'
import { SubgenresPage } from './routes/SubgenresPage'
import { SongsPage } from './routes/SongsPage'
import { TrackDeepLink } from './routes/TrackDeepLink'
import { LoginScreen } from './auth/LoginScreen'
import { HandleSetup } from './auth/HandleSetup'
import { InboxScreen } from './routes/InboxScreen'
import { FriendsScreen } from './routes/FriendsScreen'
import { ProfileScreen } from './routes/ProfileScreen'
import { ChatView } from './routes/ChatView'

const gated = (el: ReactNode) => <AuthGate>{el}</AuthGate>
const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  { path: '/setup', element: <HandleSetup /> },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <GenresPage /> },
      { path: '/g/:familySlug', element: <SubgenresPage /> },
      { path: '/s/:subgenreSlug', element: <SongsPage /> },
      { path: '/track/:itunesId', element: <TrackDeepLink /> },
      { path: '/inbox', element: gated(<InboxScreen />) },
      { path: '/friends', element: gated(<FriendsScreen />) },
      { path: '/me', element: gated(<ProfileScreen />) },
      { path: '/c/:conversationId', element: gated(<ChatView />) },
    ],
  },
])
const el = document.getElementById('root')
if (!el) throw new Error('Root element #root not found')
createRoot(el).render(<StrictMode><SessionProvider><RouterProvider router={router} /></SessionProvider></StrictMode>)
```

- [ ] **Step 4:** mark done (build in Task 8).

---

### Task 7: ChatView + SongCard + ShareSheet + ShareButton in-app path

**Files:**
- Create: `src/routes/ChatView.tsx`, `src/components/social/SongCard.tsx`, `src/components/social/ShareSheet.tsx`
- Modify: `src/components/ShareButton.tsx`

**Interfaces:**
- Consumes: `getMessages`, `sendText`, `getTracksByIds`, `subscribeToConversation`, `listFriendships`, `getProfilesByIds`, `shareTrackToFriend` (Tasks 2–3); `player` (Fas 1); `useSession`.

- [ ] **Step 1: SongCard.tsx**
```tsx
import { player } from '../../player/playerStore'
import type { Track } from '../../lib/types'

export function SongCard({ track }: { track: Track }) {
  return (
    <button onClick={() => player.playQueue([track], 0)} aria-label={`Spela ${track.trackName}`}
      className="glass flex items-center gap-3 rounded-[14px] p-2 text-left">
      <img src={track.artworkUrl} alt="" className="h-12 w-12 rounded-[10px] object-cover" />
      <span className="min-w-0"><span className="block truncate text-[13.5px] font-medium">{track.trackName}</span><span className="block truncate text-[11.5px] text-white/55">{track.artistName}</span></span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" className="ml-2"><path d="M8 5v14l11-7z" /></svg>
    </button>
  )
}
```

- [ ] **Step 2: ChatView.tsx**
```tsx
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useSession } from '../auth/session'
import { getMessages, sendText, getTracksByIds } from '../social/db'
import { subscribeToConversation } from '../social/realtime'
import type { Message } from '../social/types'
import type { Track } from '../lib/types'
import { SongCard } from '../components/social/SongCard'

export function ChatView() {
  const { conversationId = '' } = useParams()
  const { session } = useSession()
  const me = session?.user.id ?? ''
  const [msgs, setMsgs] = useState<Message[]>([])
  const [tracks, setTracks] = useState<Map<string, Track>>(new Map())
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const hydrate = async (list: Message[]) => {
    const ids = list.filter((m) => m.kind === 'track' && m.trackId).map((m) => m.trackId as string)
    if (ids.length) setTracks(await getTracksByIds(ids))
  }
  useEffect(() => {
    if (!conversationId) return
    getMessages(conversationId).then((l) => { setMsgs(l); void hydrate(l) }).catch(() => {})
    const unsub = subscribeToConversation(conversationId, (m) => setMsgs((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
    return unsub
  }, [conversationId])
  useEffect(() => { void hydrate(msgs); endRef.current?.scrollIntoView() }, [msgs])

  const send = async () => { const b = text.trim(); if (!b || !me) return; setText(''); await sendText(conversationId, me, b) }
  return (
    <section className="flex min-h-svh flex-col px-3 pt-4">
      <div className="flex-1 space-y-2 pb-4">
        {msgs.map((m) => {
          const mine = m.senderId === me
          const t = m.trackId ? tracks.get(m.trackId) : undefined
          return (
            <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
              {m.kind === 'track' && t
                ? <SongCard track={t} />
                : <div className={`max-w-[75%] rounded-[16px] px-3.5 py-2 text-[14px] ${mine ? 'bg-white text-black' : 'glass'}`}>{m.body}</div>}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div className="glass sticky bottom-24 mb-2 flex items-center gap-2 rounded-[16px] p-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send() }} placeholder="Skriv…" className="flex-1 bg-transparent px-3 outline-none placeholder:text-white/35" />
        <button onClick={send} aria-label="Skicka" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black">↑</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: ShareSheet.tsx**
```tsx
import { useEffect, useState } from 'react'
import { useSession } from '../../auth/session'
import { listFriendships, getProfilesByIds, shareTrackToFriend } from '../../social/db'
import type { Profile, Track } from '../../social/types'

export function ShareSheet({ track, onClose }: { track: Track; onClose: () => void }) {
  const { session } = useSession()
  const me = session?.user.id ?? ''
  const [friends, setFriends] = useState<Profile[]>([])
  const [comment, setComment] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  useEffect(() => { if (me) (async () => { const { accepted } = await listFriendships(me); const p = await getProfilesByIds(accepted.map((a) => a.otherId)); setFriends(accepted.map((a) => p.get(a.otherId)).filter((x): x is Profile => !!x)) })().catch(() => {}) }, [me])
  return (
    <div role="dialog" aria-modal="true" aria-label="Dela låt" className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div className="glass w-full rounded-t-[24px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center font-semibold">Dela “{track.trackName}”</div>
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Lägg till en kommentar…" className="glass mb-3 h-11 w-full rounded-[14px] px-4 outline-none placeholder:text-white/35" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {friends.map((f) => (
            <button key={f.id} onClick={async () => { await shareTrackToFriend(me, f.id, track.id, comment); setSentTo(f.handle) }} className="flex flex-col items-center gap-1">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">{(f.handle ?? '?')[0]?.toUpperCase()}</span>
              <span className="max-w-16 truncate text-xs text-white/60">@{f.handle}</span>
            </button>
          ))}
          {friends.length === 0 && <p className="text-white/40">Inga vänner ännu.</p>}
        </div>
        {sentTo && <p className="mt-2 text-center text-emerald-300/90">Skickat till @{sentTo} ✓</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: ShareButton.tsx (modify)**
```tsx
import { useState, type MouseEvent } from 'react'
import { shareUrl } from '../lib/links'
import type { Track } from '../lib/types'
import { useSession } from '../auth/session'
import { ShareSheet } from './social/ShareSheet'

export function ShareButton({ track }: { track: Track }) {
  const { session } = useSession()
  const [open, setOpen] = useState(false)
  const onShare = async (e: MouseEvent) => {
    e.stopPropagation()
    if (session) { setOpen(true); return }
    const url = shareUrl(track.itunesTrackId)
    const title = `${track.trackName} — ${track.artistName}`
    if (navigator.share) { try { await navigator.share({ title, url }) } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(url) } catch { /* ignore */ } }
  }
  return (
    <>
      <button onClick={onShare} aria-label="Dela" className="flex h-6 w-6 items-center justify-center rounded-[7px] text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4" /></svg>
      </button>
      {open && <ShareSheet track={track} onClose={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 5:** mark done (build in Task 8).

---

### Task 8: Build, verify, commit

- [ ] **Step 1:** `cd ~/dev/noisemap && bun x tsc -b && bun run build` → EXIT 0 + build succeeds. Fix type errors (annotate supabase rows; no `any`).

- [ ] **Step 2:** commit:
```bash
git add src/auth src/social src/components src/routes src/main.tsx
git -c commit.gpgsign=false commit -m "feat(app): social — auth (magic link + Google), friends, chats, share sheet, realtime"
```

- [ ] **Step 3 (controller-run):** empirical verification with a test session — create a user via the Auth admin API, sign in (password grant), inject the session into the browser (`localStorage['sb-kqujhispsknyxcmpfdkl-auth-token']` = the session JSON) before load; with Playwright + system Chrome at 390×844: screenshot `/login`; with the injected session + a handle set, screenshot `/friends`, `/inbox`, and a `/c/:id` chat containing a shared SongCard + a text bubble; confirm the ShareSheet opens from a track's Share button. Realtime + two-user privacy is already proven at the DB layer (Fas 2a). Record screenshots + green build/tsc.

---

### Task 9: PR

- [ ] `bun x tsc -b && bun run build && bun test` green; push `fas-2b-social-app`; open PR to `main` with screenshots. Report URL.

---

## Self-Review

**Spec coverage:** magic-link + Google login (Task 1) ✓; `@handle` setup + gate (Task 4) ✓; friends add/accept/list (Task 5) ✓; inbox (Task 6) ✓; conversation-per-friend chat with text + inline playable SongCard + realtime (Task 7/3) ✓; share sheet from any track → RPC → message (Task 7/2) ✓; ShareButton in-app path (Task 7) ✓; TabBar Inbox/Friends/Profile (Task 6) ✓; privacy relies on Fas 2a RLS (verified) ✓.

**Placeholder scan:** complete component code; no TODO. Empty-states handled (no friends, no chats, no tracks).

**Type consistency:** `Profile`/`Message`/`Track` used consistently; `getOrCreateConversation` → `shareTrackToFriend`/FriendsScreen; `subscribeToConversation` returns the unsubscribe fn used in ChatView cleanup; `getTracksByIds` returns the `Track` shape SongCard/ChatView consume; `src/social/types.ts` re-exports `Track` for ShareSheet.
