# Fas 2c — Onboarding & Profile Implementation Plan

> Execute with subagent-driven-development or executing-plans. Checkbox (`- [ ]`) steps.

**Goal:** Visible login, plain-language onboarding (Namn + Användarnamn, prefilled from Google), a profile page with an avatar (Google picture default + own upload to Supabase Storage), and avatars shown across the social UI.

**Tech:** React 19 + react-router v7 + Tailwind v4 + @supabase/supabase-js (auth + storage). Migration `0008` (avatar_url + `avatars` bucket + policies) is already applied.

## Global Constraints
- No Z-Profil refs; anon key only; `bun x tsc -b` green + `bun run build` succeeds; no `any`.
- Reuse dark-glass tokens + `.glass`. Mobile-first. Branch `fas-2c-onboarding-profile`.
- "handle" is internal only — user-facing copy says **Namn** (display name) and **Användarnamn** (unique @).

---

### Task 1: Profile type + avatar in the data layer

**Files:** Modify `src/social/types.ts`, `src/social/db.ts`; Create `src/social/avatar.ts`.

- [ ] **types.ts** — add `avatarUrl` to `Profile`:
```ts
export interface Profile { id: string; handle: string | null; displayName: string | null; avatarUrl: string | null }
```

- [ ] **db.ts** — include `avatar_url` everywhere profiles are read/written:
  - `ProfileRow` gains `avatar_url: string | null`.
  - `toProfile` returns `avatarUrl: r.avatar_url`.
  - Every profiles select string `'id,handle,display_name'` → `'id,handle,display_name,avatar_url'` (in `getMyProfile`, `searchProfiles`, `getProfilesByIds`).
  - Change `setMyProfile` signature to accept an optional avatar:
```ts
export async function setMyProfile(userId: string, handle: string, displayName: string, avatarUrl?: string | null): Promise<void> {
  const patch: Record<string, string | null> = { handle: handle.toLowerCase(), display_name: displayName }
  if (avatarUrl !== undefined) patch.avatar_url = avatarUrl
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw new Error(error.message)
}
```

- [ ] **Create `src/social/avatar.ts`:**
```ts
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Prefer the Google/OAuth profile picture the provider hands us at login.
export function providerAvatar(session: Session | null): string | null {
  const m = session?.user.user_metadata as Record<string, unknown> | undefined
  return (m?.avatar_url as string) ?? (m?.picture as string) ?? null
}
export function providerName(session: Session | null): string {
  const m = session?.user.user_metadata as Record<string, unknown> | undefined
  return (m?.full_name as string) ?? (m?.name as string) ?? ''
}
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}` // cache-bust so a replaced image shows immediately
}
```

- [ ] Verify build later (Task 6).

---

### Task 2: Reusable Avatar component

**Files:** Create `src/components/Avatar.tsx`.
```tsx
export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const letter = ((name ?? '?').trim()[0] ?? '?').toUpperCase()
  if (url) return <img src={url} alt="" width={size} height={size} className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />
  return <span className="flex flex-none items-center justify-center rounded-full bg-white/10 font-semibold" style={{ width: size, height: size }}>{letter}</span>
}
```

---

### Task 3: Onboarding (plain language + Google prefill + avatar) — replaces HandleSetup

**Files:** Rewrite `src/auth/HandleSetup.tsx` (keep the export name `HandleSetup` so `main.tsx` needs no change).
```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from './session'
import { setMyProfile } from '../social/db'
import { providerAvatar, providerName, uploadAvatar } from '../social/avatar'
import { Avatar } from '../components/Avatar'

export function HandleSetup() {
  const { session } = useSession()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (session) { setName(providerName(session)); setAvatar(providerAvatar(session)) } }, [session])
  const valid = /^[a-z0-9_]{3,20}$/.test(handle.toLowerCase())
  const onFile = async (f: File | undefined) => {
    if (!f || !session) return
    setBusy(true); setErr(null)
    try { setAvatar(await uploadAvatar(session.user.id, f)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Kunde inte ladda upp bild') }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (!session || !valid) return
    setBusy(true); setErr(null)
    try { await setMyProfile(session.user.id, handle, name || handle, avatar); navigate('/inbox', { replace: true }) }
    catch (e) { setErr(e instanceof Error ? (/duplicate|unique/i.test(e.message) ? 'Användarnamnet är upptaget' : e.message) : 'Fel') }
    finally { setBusy(false) }
  }
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-[24px] font-bold tracking-tight">Skapa din profil</h1>
      <div className="mt-6 flex items-center gap-4">
        <Avatar url={avatar} name={name} size={64} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="glass rounded-[12px] px-4 py-2 text-sm disabled:opacity-50">Ladda upp bild</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <label className="mt-6 text-xs text-white/50">Namn</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" className="glass mt-1 h-12 rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      <label className="mt-4 text-xs text-white/50">Användarnamn</label>
      <div className="glass mt-1 flex h-12 items-center rounded-[14px] px-4">
        <span className="text-white/40">@</span>
        <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="användarnamn" className="ml-1 flex-1 bg-transparent outline-none placeholder:text-white/35" />
      </div>
      <p className="mt-2 text-xs text-white/40">3–20 tecken: a–z, 0–9, _ · används för att hitta dig.</p>
      <button onClick={save} disabled={!valid || busy} className="mt-5 flex h-12 items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Fortsätt</button>
      {err && <p className="mt-3 text-red-300">{err}</p>}
    </section>
  )
}
```

---

### Task 4: Editable Profile page (avatar + name + username + sign out)

**Files:** Rewrite `src/routes/ProfileScreen.tsx`.
```tsx
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/session'
import { getMyProfile, setMyProfile } from '../social/db'
import { uploadAvatar } from '../social/avatar'
import { Avatar } from '../components/Avatar'

export function ProfileScreen() {
  const { session } = useSession()
  const uid = session?.user.id ?? ''
  const fileRef = useRef<HTMLInputElement>(null)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (uid) getMyProfile(uid).then((p) => { if (p) { setHandle(p.handle ?? ''); setName(p.displayName ?? ''); setAvatar(p.avatarUrl) } }).catch(() => {}) }, [uid])
  const valid = /^[a-z0-9_]{3,20}$/.test(handle.toLowerCase())
  const onFile = async (f: File | undefined) => {
    if (!f || !uid) return
    setBusy(true); setMsg(null)
    try { const url = await uploadAvatar(uid, f); setAvatar(url); await setMyProfile(uid, handle, name || handle, url); setMsg('Bild uppdaterad ✓') }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Fel') }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (!uid || !valid) return
    setBusy(true); setMsg(null)
    try { await setMyProfile(uid, handle, name || handle, avatar); setMsg('Sparat ✓') }
    catch (e) { setMsg(e instanceof Error ? (/duplicate|unique/i.test(e.message) ? 'Användarnamnet är upptaget' : e.message) : 'Fel') }
    finally { setBusy(false) }
  }
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Profil</h1>
      <div className="mt-6 flex items-center gap-4">
        <Avatar url={avatar} name={name || handle} size={72} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="glass rounded-[12px] px-4 py-2 text-sm disabled:opacity-50">Byt bild</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <label className="mt-6 block text-xs text-white/50">Namn</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="glass mt-1 h-12 w-full rounded-[14px] px-4 outline-none" />
      <label className="mt-4 block text-xs text-white/50">Användarnamn</label>
      <div className="glass mt-1 flex h-12 items-center rounded-[14px] px-4">
        <span className="text-white/40">@</span>
        <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} className="ml-1 flex-1 bg-transparent outline-none" />
      </div>
      <button onClick={save} disabled={!valid || busy} className="mt-5 flex h-12 w-full items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Spara</button>
      {msg && <p className="mt-3 text-center text-emerald-300/90">{msg}</p>}
      <button onClick={() => supabase.auth.signOut()} className="glass mt-6 flex h-12 w-full items-center justify-center rounded-[14px] text-red-300">Logga ut</button>
    </section>
  )
}
```

---

### Task 5: Visible "Logga in" + avatars across social UI

- [ ] **`src/routes/GenresPage.tsx`** — show a "Logga in" button for logged-out users. Import `useSession` (`../auth/session`) and `Link` (`react-router`); make the header `<section>` `relative`; when `!session`, render:
```tsx
{!session && <Link to="/login" className="glass absolute right-4 top-6 rounded-[12px] px-3 py-1.5 text-sm font-medium">Logga in</Link>}
```

- [ ] **`src/routes/FriendsScreen.tsx`, `src/routes/InboxScreen.tsx`, `src/components/social/ShareSheet.tsx`** — replace the letter-in-a-circle placeholders with `<Avatar url={p.avatarUrl} name={p.handle} size={...} />` (import from the right relative path). Keep the existing sizes. The `Profile` objects already carry `avatarUrl` after Task 1.

---

### Task 6: Build, verify, commit
- [ ] `cd ~/dev/noisemap && bun x tsc -b && bun run build` → green. `bun test` → 10 pass.
- [ ] Commit:
```bash
git add src/social src/components src/auth src/routes
git -c commit.gpgsign=false commit -m "feat(app): onboarding + profile — visible login, avatar upload (Google default), plain-language username, avatars in social UI"
```
- [ ] Controller: visual verification with an injected session + a set profile.

## Self-review
Covers: visible login (Task 5), plain-language onboarding with Google prefill (Task 3), avatar upload to Storage + Google default (Tasks 1–4), editable profile (Task 4), avatars across social UI (Task 5). Types consistent (`Profile.avatarUrl` threaded through db → components). No `any` (metadata read via `Record<string, unknown>` + narrowing).
