# Fas 1b — Browse + Player App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A premium, mobile-first React app: Genre → Subgenre → Songs → glass player, with real iTunes preview playback, Spotify/Apple Music shortcuts, and shareable song deep links — reading the Fas 1a data from Supabase.

**Architecture:** Vite + React 19 + react-router v7 (already installed). Data comes from Supabase via the anon client (public RLS read; `.env.local` already holds URL + anon key). A dependency-free player store (module singleton + `useSyncExternalStore`) owns one `HTMLAudioElement`. Dark-glass design via CSS custom-property tokens + Tailwind v4 utilities. No accounts (Fas 2).

**Tech Stack:** React 19, react-router v7, @supabase/supabase-js (installed), Tailwind v4 (installed), bun.

## Global Constraints

- Standalone project — no Z-Profil / zprofil.se / `ltkumctoowadvqtdytvw` references. Supabase ref `kqujhispsknyxcmpfdkl` (already in `.env.local`, gitignored).
- `bun x tsc -b` must be green before every commit; `bun run build` must succeed.
- Design: dark premium glass; **text always on the top legible layer, never under graphics**; one focal point per screen; per-genre color accents from the DB `color`.
- Mobile-first; no horizontal overflow at 320/375/768. Animate only `transform`/`opacity`/`filter`.
- No `any` in app code (use `unknown` + narrowing or typed row shapes); no secrets in code; anon key only (never service_role in a `VITE_` var).
- Spotify = deep-link/search only (no API). Apple Music = real iTunes URL from the data.
- Reads must paginate (PostgREST caps responses at 1000 rows).
- Work on branch `fas-1b-browse-player-app`; feature branch → PR → Gustav merges. Never `git add -A`.

---

### Task 1: Design tokens + app shell + typed data layer

**Files:**
- Create: `src/styles/tokens.css`, `src/lib/types.ts`, `src/lib/db.ts`
- Modify: `src/index.css` (replace), `src/lib/supabase.ts` (unchanged — verify it exists)

**Interfaces:**
- Produces: CSS vars (`--bg,--ink,--mut,--mut2,--glass-bg,--glass-stroke,--glass-blur,--glass-sat,--violet,--radius`); types `Family`, `Subgenre`, `Track`; repo fns `getFamilies()`, `getFamilyBySlug(slug)`, `getSubgenres(familyId)`, `getSubgenreBySlug(slug)`, `getTracksForSubgenre(genreId)`, `getTrackByItunesId(itunesId)`.

- [ ] **Step 1: tokens.css**

`src/styles/tokens.css`:
```css
:root {
  --bg: #08080c;
  --ink: #f5f5f7;
  --mut: rgba(255, 255, 255, 0.55);
  --mut2: rgba(255, 255, 255, 0.4);
  --glass-bg: rgba(255, 255, 255, 0.07);
  --glass-stroke: rgba(255, 255, 255, 0.12);
  --glass-blur: 26px;
  --glass-sat: 180%;
  --violet: #7b5cff;
  --radius: 18px;
  --dur: 240ms;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 2: index.css (replace)**

`src/index.css`:
```css
@import "tailwindcss";
@import "./styles/tokens.css";

html, body, #root { min-height: 100svh; }
body {
  margin: 0;
  color: var(--ink);
  background: radial-gradient(1200px 700px at 50% -12%, #171029, var(--bg) 62%) fixed;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 0 0 1px var(--glass-stroke), 0 14px 34px -12px rgba(0, 0, 0, 0.7);
}
```

- [ ] **Step 3: types.ts**

`src/lib/types.ts`:
```ts
export interface Family { id: string; name: string; slug: string; color: string; sort: number }
export interface Subgenre { id: string; name: string; slug: string; color: string; familyId: string }
export interface Track {
  id: string; itunesTrackId: number; artistName: string; trackName: string;
  artworkUrl: string; previewUrl: string; appleMusicUrl: string; durationMs: number
}
```

- [ ] **Step 4: db.ts**

`src/lib/db.ts`:
```ts
import { supabase } from './supabase'
import type { Family, Subgenre, Track } from './types'

interface FamilyRow { id: string; name: string; slug: string; color: string; sort: number }
interface GenreRow { id: string; name: string; slug: string | null; color: string; family_id: string | null }
interface TrackRow {
  id: string; itunes_track_id: number | null; artist_name: string; track_name: string;
  artwork_url: string | null; preview_url: string | null; apple_music_url: string | null; duration_ms: number | null
}

const toFamily = (r: FamilyRow): Family => ({ id: r.id, name: r.name, slug: r.slug, color: r.color, sort: r.sort })
const toSubgenre = (r: GenreRow): Subgenre => ({ id: r.id, name: r.name, slug: r.slug ?? r.id, color: r.color, familyId: r.family_id ?? '' })
const toTrack = (r: TrackRow): Track => ({
  id: r.id, itunesTrackId: r.itunes_track_id ?? 0, artistName: r.artist_name, trackName: r.track_name,
  artworkUrl: r.artwork_url ?? '', previewUrl: r.preview_url ?? '', appleMusicUrl: r.apple_music_url ?? '', durationMs: r.duration_ms ?? 0,
})

export async function getFamilies(): Promise<Family[]> {
  const { data, error } = await supabase.from('genre_families').select('id,name,slug,color,sort').order('sort')
  if (error) throw new Error(`getFamilies: ${error.message}`)
  return (data as FamilyRow[]).map(toFamily)
}

export async function getFamilyBySlug(slug: string): Promise<Family | null> {
  const { data, error } = await supabase.from('genre_families').select('id,name,slug,color,sort').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`getFamilyBySlug: ${error.message}`)
  return data ? toFamily(data as FamilyRow) : null
}

export async function getSubgenres(familyId: string): Promise<Subgenre[]> {
  const { data, error } = await supabase.from('genres').select('id,name,slug,color,family_id').eq('family_id', familyId).order('name')
  if (error) throw new Error(`getSubgenres: ${error.message}`)
  return (data as GenreRow[]).map(toSubgenre)
}

export async function getSubgenreBySlug(slug: string): Promise<Subgenre | null> {
  const { data, error } = await supabase.from('genres').select('id,name,slug,color,family_id').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`getSubgenreBySlug: ${error.message}`)
  return data ? toSubgenre(data as GenreRow) : null
}

export async function getTracksForSubgenre(genreId: string): Promise<Track[]> {
  const { data, error } = await supabase
    .from('subgenre_tracks')
    .select('rank, tracks(id,itunes_track_id,artist_name,track_name,artwork_url,preview_url,apple_music_url,duration_ms)')
    .eq('genre_id', genreId).order('rank')
  if (error) throw new Error(`getTracksForSubgenre: ${error.message}`)
  const rows = (data ?? []) as unknown as { tracks: TrackRow | null }[]
  return rows.map((r) => r.tracks).filter((t): t is TrackRow => t !== null).map(toTrack)
}

export async function getTrackByItunesId(itunesId: number): Promise<Track | null> {
  const { data, error } = await supabase.from('tracks')
    .select('id,itunes_track_id,artist_name,track_name,artwork_url,preview_url,apple_music_url,duration_ms')
    .eq('itunes_track_id', itunesId).maybeSingle()
  if (error) throw new Error(`getTrackByItunesId: ${error.message}`)
  return data ? toTrack(data as TrackRow) : null
}
```

- [ ] **Step 5: Verify build**

Run: `cd ~/dev/noisemap && bun x tsc -b && bun run build`
Expected: tsc EXIT 0; build succeeds.

- [ ] **Step 6: Commit**
```bash
git add src/styles/tokens.css src/index.css src/lib/types.ts src/lib/db.ts
git -c commit.gpgsign=false commit -m "feat(app): design tokens, typed data layer, glass base"
```

---

### Task 2: Player store + hook (preview playback)

**Files:**
- Create: `src/player/playerStore.ts`, `src/player/usePlayer.ts`
- Test: `src/player/playerStore.test.ts`

**Interfaces:**
- Produces: `player` singleton (`subscribe`, `getState`, `playQueue(queue,index)`, `toggle()`, `next()`, `prev()`, `current()`); `usePlayer()` hook returning `{ state, current }`.
- Consumes: `Track` (Task 1).

- [ ] **Step 1: playerStore.ts**

`src/player/playerStore.ts`:
```ts
import type { Track } from '../lib/types'

export interface PlayerState { queue: Track[]; index: number; isPlaying: boolean }

let state: PlayerState = { queue: [], index: -1, isPlaying: false }
const listeners = new Set<() => void>()
const audio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null

function emit(): void { for (const l of listeners) l() }
function set(patch: Partial<PlayerState>): void { state = { ...state, ...patch }; emit() }

function load(autoplay: boolean): void {
  if (!audio) return
  const t = state.queue[state.index]
  if (!t) return
  audio.src = t.previewUrl
  if (autoplay) void audio.play().catch(() => set({ isPlaying: false }))
}

export const player = {
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l) } },
  getState(): PlayerState { return state },
  current(): Track | null { return state.index >= 0 ? state.queue[state.index] ?? null : null },
  playQueue(queue: Track[], index: number): void { set({ queue, index, isPlaying: true }); load(true) },
  toggle(): void {
    if (!audio || state.index < 0) return
    if (state.isPlaying) { audio.pause(); set({ isPlaying: false }) }
    else { void audio.play().catch(() => {}); set({ isPlaying: true }) }
  },
  next(): void { if (state.index < state.queue.length - 1) { set({ index: state.index + 1, isPlaying: true }); load(true) } else { set({ isPlaying: false }) } },
  prev(): void { if (state.index > 0) { set({ index: state.index - 1, isPlaying: true }); load(true) } },
}

if (audio) audio.addEventListener('ended', () => player.next())
```

- [ ] **Step 2: usePlayer.ts**

`src/player/usePlayer.ts`:
```ts
import { useSyncExternalStore } from 'react'
import { player, type PlayerState } from './playerStore'
import type { Track } from '../lib/types'

export function usePlayer(): { state: PlayerState; current: Track | null } {
  const state = useSyncExternalStore(player.subscribe, player.getState, player.getState)
  return { state, current: state.index >= 0 ? state.queue[state.index] ?? null : null }
}
```

- [ ] **Step 3: Failing test**

`src/player/playerStore.test.ts` (bun runtime; `Audio` is undefined under bun, store guards for it):
```ts
import { test, expect } from 'bun:test'
import { player } from './playerStore'
import type { Track } from '../lib/types'

const mk = (n: number): Track => ({
  id: `${n}`, itunesTrackId: n, artistName: `a${n}`, trackName: `t${n}`,
  artworkUrl: '', previewUrl: '', appleMusicUrl: '', durationMs: 0,
})

test('playQueue sets current, next/prev move within bounds', () => {
  const q = [mk(1), mk(2), mk(3)]
  player.playQueue(q, 0)
  expect(player.current()?.id).toBe('1')
  player.next(); expect(player.current()?.id).toBe('2')
  player.prev(); expect(player.current()?.id).toBe('1')
  player.prev(); expect(player.current()?.id).toBe('1') // clamped at start
})
```

- [ ] **Step 4: Run test + typecheck**

Run: `cd ~/dev/noisemap && bun test src/player/playerStore.test.ts && bun x tsc -b`
Expected: 1 pass; tsc EXIT 0. If tsc flags the test's `bun:test` import under `tsconfig.app.json`, add `"bun-types"` to that file's `types` array (next to `"vite/client"`) and include it in the commit.

- [ ] **Step 5: Commit**
```bash
git add src/player/playerStore.ts src/player/usePlayer.ts src/player/playerStore.test.ts
git -c commit.gpgsign=false commit -m "feat(app): dependency-free player store + preview playback + test"
```

---

### Task 3: Link/format utilities + test

**Files:**
- Create: `src/lib/links.ts`
- Test: `src/lib/links.test.ts`

**Interfaces:**
- Produces: `spotifySearchUrl(artist, track)`, `appleMusicUrl(track)`, `shareUrl(itunesId)`, `formatDuration(ms)`.

- [ ] **Step 1: links.ts**
```ts
import type { Track } from './types'

export function spotifySearchUrl(artist: string, track: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${track}`)}`
}
export function appleMusicUrl(track: Track): string { return track.appleMusicUrl }
export function shareUrl(itunesId: number): string {
  const origin = typeof location !== 'undefined' ? location.origin : ''
  return `${origin}/track/${itunesId}`
}
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
```

- [ ] **Step 2: Failing test**
`src/lib/links.test.ts`:
```ts
import { test, expect } from 'bun:test'
import { spotifySearchUrl, formatDuration } from './links'

test('spotifySearchUrl encodes artist + track', () => {
  expect(spotifySearchUrl('J Balvin', 'LA CANCIÓN')).toBe('https://open.spotify.com/search/J%20Balvin%20LA%20CANCI%C3%93N')
})
test('formatDuration formats mm:ss', () => {
  expect(formatDuration(210933)).toBe('3:31')
  expect(formatDuration(5000)).toBe('0:05')
})
```

- [ ] **Step 3: Run + commit**
```bash
cd ~/dev/noisemap && bun test src/lib/links.test.ts && bun x tsc -b
git add src/lib/links.ts src/lib/links.test.ts
git -c commit.gpgsign=false commit -m "feat(app): link + duration utilities + tests"
```

---

### Task 4: Router + app shell + tab bar (no commit until Task 8)

**Files:**
- Modify: `src/main.tsx` (replace), remove `src/App.tsx`/`src/App.css`
- Create: `src/components/AppShell.tsx`, `src/components/TabBar.tsx`

**Interfaces:**
- Routes: `/` GenresPage, `/g/:familySlug` SubgenresPage, `/s/:subgenreSlug` SongsPage, `/track/:itunesId` TrackDeepLink (created in Tasks 5–8).

- [ ] **Step 1: AppShell.tsx**
```tsx
import { Outlet } from 'react-router'
import { TabBar } from './TabBar'
import { MiniPlayer } from './player/MiniPlayer'

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-svh max-w-[520px] flex-col">
      <main className="flex-1 pb-40">
        <Outlet />
      </main>
      <MiniPlayer />
      <TabBar />
    </div>
  )
}
```

- [ ] **Step 2: TabBar.tsx**
```tsx
import { NavLink } from 'react-router'

export function TabBar() {
  return (
    <nav className="glass fixed bottom-3 left-1/2 z-30 flex h-14 w-[min(480px,calc(100%-28px))] -translate-x-1/2 items-center justify-around rounded-[20px] px-3">
      <NavLink to="/" aria-label="Genrer" className={({ isActive }) => isActive ? 'text-white' : 'text-white/50'}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H8v6H4a1 1 0 0 1-1-1z" /></svg>
      </NavLink>
      <span className="text-white/30" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
      </span>
    </nav>
  )
}
```

- [ ] **Step 3: main.tsx (replace)**
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { AppShell } from './components/AppShell'
import { GenresPage } from './routes/GenresPage'
import { SubgenresPage } from './routes/SubgenresPage'
import { SongsPage } from './routes/SongsPage'
import { TrackDeepLink } from './routes/TrackDeepLink'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <GenresPage /> },
      { path: '/g/:familySlug', element: <SubgenresPage /> },
      { path: '/s/:subgenreSlug', element: <SongsPage /> },
      { path: '/track/:itunesId', element: <TrackDeepLink /> },
    ],
  },
])

const el = document.getElementById('root')
if (!el) throw new Error('Root element #root not found')
createRoot(el).render(<StrictMode><RouterProvider router={router} /></StrictMode>)
```

- [ ] **Step 4:** `git rm src/App.tsx src/App.css 2>/dev/null || true`. Do NOT build/commit yet (routes come in Tasks 5–8); build is verified in Task 8.

---

### Task 5: GenresPage + GenreTile + useAsync (no commit until Task 8)

**Files:**
- Create: `src/routes/GenresPage.tsx`, `src/components/GenreTile.tsx`, `src/hooks/useAsync.ts`

- [ ] **Step 1: useAsync.ts**
```ts
import { useEffect, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    setLoading(true); setError(null)
    fn().then((d) => { if (live) { setData(d); setLoading(false) } })
      .catch((e: unknown) => { if (live) { setError(e instanceof Error ? e.message : String(e)); setLoading(false) } })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, error, loading }
}
```

- [ ] **Step 2: GenreTile.tsx** (label on TOP, color orb behind/below)
```tsx
import { Link } from 'react-router'
import type { Family } from '../lib/types'

export function GenreTile({ family }: { family: Family }) {
  return (
    <Link to={`/g/${family.slug}`}
      className="relative flex h-28 flex-col overflow-hidden rounded-[18px] p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-transform duration-200 active:scale-[0.98]"
      style={{ background: `linear-gradient(150deg, ${family.color}40, ${family.color}10)` }}>
      <div className="relative z-10">
        <div className="text-[15px] font-semibold tracking-tight">{family.name}</div>
      </div>
      <span className="pointer-events-none absolute -bottom-11 -right-8 z-0 h-28 w-28 rounded-full opacity-85 blur-[4px]"
        style={{ background: family.color }} />
    </Link>
  )
}
```

- [ ] **Step 3: GenresPage.tsx**
```tsx
import { getFamilies } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { GenreTile } from '../components/GenreTile'

export function GenresPage() {
  const { data, error, loading } = useAsync(() => getFamilies(), [])
  return (
    <section className="px-4 pt-6">
      <p className="text-[11px] uppercase tracking-[1.3px] text-white/40">Utforska</p>
      <h1 className="mt-0.5 text-[26px] font-bold tracking-tight">Genrer</h1>
      {loading && <p className="mt-8 text-white/40">Laddar…</p>}
      {error && <p className="mt-8 text-red-300">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(data ?? []).map((f) => <GenreTile key={f.id} family={f} />)}
      </div>
    </section>
  )
}
```

- [ ] **Step 4:** mark done; build/commit in Task 8.

---

### Task 6: SubgenresPage + SubgenreRow (no commit until Task 8)

**Files:**
- Create: `src/routes/SubgenresPage.tsx`, `src/components/SubgenreRow.tsx`

- [ ] **Step 1: SubgenreRow.tsx**
```tsx
import { Link } from 'react-router'
import type { Subgenre } from '../lib/types'

export function SubgenreRow({ sub }: { sub: Subgenre }) {
  return (
    <Link to={`/s/${sub.slug}`}
      className="mb-2 flex items-center gap-3 rounded-[15px] bg-white/[0.04] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] active:bg-white/[0.08]">
      <span className="h-9 w-9 flex-none rounded-[10px]" style={{ background: sub.color, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.2), 0 0 16px ${sub.color}` }} />
      <span className="text-[14.5px] font-medium">{sub.name}</span>
      <span className="ml-auto text-white/40">›</span>
    </Link>
  )
}
```

- [ ] **Step 2: SubgenresPage.tsx**
```tsx
import { useParams } from 'react-router'
import { getFamilyBySlug, getSubgenres } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { SubgenreRow } from '../components/SubgenreRow'

export function SubgenresPage() {
  const { familySlug = '' } = useParams()
  const { data, error, loading } = useAsync(async () => {
    const fam = await getFamilyBySlug(familySlug)
    if (!fam) return { fam: null, subs: [] }
    return { fam, subs: await getSubgenres(fam.id) }
  }, [familySlug])
  return (
    <section className="px-4 pt-6">
      <p className="text-[11px] uppercase tracking-[1.3px] text-white/40">{data?.fam?.name ?? ''} · välj subgenre</p>
      <h1 className="mt-0.5 text-[26px] font-bold tracking-tight">Subgenrer</h1>
      {loading && <p className="mt-8 text-white/40">Laddar…</p>}
      {error && <p className="mt-8 text-red-300">{error}</p>}
      <div className="mt-4">
        {(data?.subs ?? []).map((s) => <SubgenreRow key={s.id} sub={s} />)}
      </div>
    </section>
  )
}
```

- [ ] **Step 3:** mark done; build/commit in Task 8.

---

### Task 7: SongsPage + TrackRow + ServiceLinks + ShareButton (no commit until Task 8)

**Files:**
- Create: `src/routes/SongsPage.tsx`, `src/components/TrackRow.tsx`, `src/components/ServiceLinks.tsx`, `src/components/ShareButton.tsx`

- [ ] **Step 1: ServiceLinks.tsx**
```tsx
import type { Track } from '../lib/types'
import { spotifySearchUrl, appleMusicUrl } from '../lib/links'

export function ServiceLinks({ track }: { track: Track }) {
  const btn = 'flex h-6 w-6 items-center justify-center rounded-[7px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
  return (
    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
      <a className={btn} href={spotifySearchUrl(track.artistName, track.trackName)} target="_blank" rel="noreferrer" aria-label="Öppna i Spotify" style={{ background: '#1db95422' }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#1db954"><circle cx="12" cy="12" r="11" /></svg>
      </a>
      {track.appleMusicUrl && (
        <a className={btn} href={appleMusicUrl(track)} target="_blank" rel="noreferrer" aria-label="Öppna i Apple Music" style={{ background: '#fa2d4822' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#fa2d48"><rect x="1" y="1" width="22" height="22" rx="6" /></svg>
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ShareButton.tsx**
```tsx
import type { MouseEvent } from 'react'
import { shareUrl } from '../lib/links'
import type { Track } from '../lib/types'

export function ShareButton({ track }: { track: Track }) {
  const onShare = async (e: MouseEvent) => {
    e.stopPropagation()
    const url = shareUrl(track.itunesTrackId)
    const title = `${track.trackName} — ${track.artistName}`
    if (navigator.share) { try { await navigator.share({ title, url }) } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(url) } catch { /* ignore */ } }
  }
  return (
    <button onClick={onShare} aria-label="Dela" className="flex h-6 w-6 items-center justify-center rounded-[7px] text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4" /></svg>
    </button>
  )
}
```

- [ ] **Step 3: TrackRow.tsx**
```tsx
import type { Track } from '../lib/types'
import { formatDuration } from '../lib/links'
import { ServiceLinks } from './ServiceLinks'
import { ShareButton } from './ShareButton'
import { player } from '../player/playerStore'

export function TrackRow({ track, queue, index }: { track: Track; queue: Track[]; index: number }) {
  return (
    <div onClick={() => player.playQueue(queue, index)}
      className="flex cursor-pointer items-center gap-3 rounded-[13px] p-2 active:bg-white/[0.06]">
      <img src={track.artworkUrl} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 rounded-[10px] object-cover shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">{track.trackName}</div>
        <div className="truncate text-[11.5px] text-white/55">{track.artistName}</div>
      </div>
      <ServiceLinks track={track} />
      <ShareButton track={track} />
      <span className="w-9 text-right text-[11.5px] text-white/40">{formatDuration(track.durationMs)}</span>
    </div>
  )
}
```

- [ ] **Step 4: SongsPage.tsx**
```tsx
import { useParams } from 'react-router'
import { getSubgenreBySlug, getTracksForSubgenre } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { TrackRow } from '../components/TrackRow'

export function SongsPage() {
  const { subgenreSlug = '' } = useParams()
  const { data, error, loading } = useAsync(async () => {
    const sub = await getSubgenreBySlug(subgenreSlug)
    if (!sub) return { sub: null, tracks: [] }
    return { sub, tracks: await getTracksForSubgenre(sub.id) }
  }, [subgenreSlug])
  const tracks = data?.tracks ?? []
  return (
    <section>
      <div className="relative px-4 pb-4 pt-7" style={{ background: `linear-gradient(160deg, ${data?.sub?.color ?? '#7b5cff'}88, transparent 70%)` }}>
        <p className="text-[11px] uppercase tracking-[1.3px] text-white/50">Subgenre</p>
        <h1 className="mt-0.5 text-[26px] font-bold tracking-tight">{data?.sub?.name ?? ''}</h1>
      </div>
      {loading && <p className="mt-8 px-4 text-white/40">Laddar…</p>}
      {error && <p className="mt-8 px-4 text-red-300">{error}</p>}
      {!loading && !error && tracks.length === 0 && (
        <p className="mt-8 px-4 text-white/40">Inga låtar ännu — kör om iTunes-importen för den här subgenren.</p>
      )}
      <div className="mt-3 px-2">
        {tracks.map((t, i) => <TrackRow key={t.id} track={t} queue={tracks} index={i} />)}
      </div>
    </section>
  )
}
```

- [ ] **Step 5:** mark done; build/commit in Task 8.

---

### Task 8: MiniPlayer + NowPlaying + TrackDeepLink; wire, build, screenshot, commit

**Files:**
- Create: `src/components/player/MiniPlayer.tsx`, `src/components/player/NowPlaying.tsx`, `src/routes/TrackDeepLink.tsx`

- [ ] **Step 1: NowPlaying.tsx**
```tsx
import type { Track } from '../../lib/types'
import { player } from '../../player/playerStore'
import { usePlayer } from '../../player/usePlayer'
import { ServiceLinks } from '../ServiceLinks'
import { ShareButton } from '../ShareButton'

export function NowPlaying({ track, onClose }: { track: Track; onClose: () => void }) {
  const { state } = usePlayer()
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center bg-[#08080c]/95 px-6 pb-24 pt-6 backdrop-blur-2xl">
      <button onClick={onClose} aria-label="Stäng" className="self-start text-2xl leading-none text-white/60">▾</button>
      <div className="mt-6 h-56 w-56 overflow-hidden rounded-[26px] shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.14)]">
        <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="mt-6 text-center">
        <div className="text-[21px] font-bold tracking-tight">{track.trackName}</div>
        <div className="mt-1 text-white/55">{track.artistName}</div>
      </div>
      <div className="mt-7 flex items-center gap-7">
        <button onClick={() => player.prev()} aria-label="Föregående"><svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M18 6v12L9 12zM7 6h2v12H7z" /></svg></button>
        <button onClick={() => player.toggle()} aria-label="Spela/pausa" className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
          {state.isPlaying
            ? <svg viewBox="0 0 24 24" width="26" height="26" fill="#0b0b0f"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            : <svg viewBox="0 0 24 24" width="26" height="26" fill="#0b0b0f"><path d="M8 5v14l11-7z" /></svg>}
        </button>
        <button onClick={() => player.next()} aria-label="Nästa"><svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M6 6v12l9-6zM15 6h2v12h-2z" /></svg></button>
      </div>
      <div className="mt-7 flex items-center gap-3"><ServiceLinks track={track} /><ShareButton track={track} /></div>
    </div>
  )
}
```

- [ ] **Step 2: MiniPlayer.tsx**
```tsx
import { useState } from 'react'
import { usePlayer } from '../../player/usePlayer'
import { player } from '../../player/playerStore'
import { NowPlaying } from './NowPlaying'

export function MiniPlayer() {
  const { current, state } = usePlayer()
  const [open, setOpen] = useState(false)
  if (!current) return null
  return (
    <>
      <div onClick={() => setOpen(true)}
        className="glass fixed bottom-20 left-1/2 z-30 flex h-14 w-[min(480px,calc(100%-28px))] -translate-x-1/2 items-center gap-3 rounded-[16px] px-3">
        <img src={current.artworkUrl} alt="" className="h-10 w-10 rounded-[9px] object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium">{current.trackName}</div>
          <div className="truncate text-[11px] text-white/55">{current.artistName}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); player.toggle() }} aria-label="Spela/pausa">
          {state.isPlaying
            ? <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            : <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff"><path d="M8 5v14l11-7z" /></svg>}
        </button>
      </div>
      {open && <NowPlaying track={current} onClose={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 3: TrackDeepLink.tsx**
```tsx
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { getTrackByItunesId } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { player } from '../player/playerStore'

export function TrackDeepLink() {
  const { itunesId = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useAsync(() => getTrackByItunesId(Number(itunesId)), [itunesId])
  useEffect(() => { if (data) player.playQueue([data], 0) }, [data])
  return (
    <section className="px-4 pt-10 text-center">
      {loading && <p className="text-white/40">Laddar låt…</p>}
      {error && <p className="text-red-300">{error}</p>}
      {!loading && !data && !error && <p className="text-white/40">Låten hittades inte.</p>}
      {data && (
        <div className="mx-auto max-w-xs">
          <img src={data.artworkUrl} alt="" className="mx-auto h-52 w-52 rounded-[24px] object-cover shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8)]" />
          <div className="mt-5 text-[20px] font-bold">{data.trackName}</div>
          <div className="mt-1 text-white/55">{data.artistName}</div>
          <button onClick={() => navigate('/')} className="mt-6 rounded-[12px] px-4 py-2 text-[13px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">Utforska genrer</button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Full build**

Run: `cd ~/dev/noisemap && bun x tsc -b && bun run build`
Expected: tsc EXIT 0; build succeeds. If a `src/**/*.test.ts` bun import errors under tsc, add `"bun-types"` to `tsconfig.app.json` `types`.

- [ ] **Step 5: Commit all app UI**
```bash
git add src/components src/routes src/hooks src/player src/main.tsx tsconfig.app.json
git -c commit.gpgsign=false commit -m "feat(app): router, screens, glass player, share deep link"
```

- [ ] **Step 6: Empirical visual verification**

```bash
cd ~/dev/noisemap && bun run dev
```
With Playwright/browser MCP against `http://localhost:5173/`: at 375×812 screenshot the Genres grid; click a marquee family (e.g. Hip-Hop) → subgenre (e.g. rap) → songs; screenshot the track list; click a track → confirm MiniPlayer appears and a request to `audio-ssl.itunes.apple.com` fires (preview plays); expand to NowPlaying and screenshot; open `/track/<a real itunes_track_id>` and confirm it loads + plays. Record screenshots + the "preview played" confirmation. Stop the dev server.

---

### Task 9: PR

- [ ] **Step 1:** `bun x tsc -b && bun run build && bun test` all green.
- [ ] **Step 2:** push branch (Gebbzkovich credential, in-memory), open PR to `main` with screenshots + "preview plays" confirmation. Report PR URL.

---

## Self-Review

**Spec coverage:** Genre→Subgenre→Songs→Player nav (Tasks 4–8) ✓; preview playback (Task 2/8) ✓; Apple Music + Spotify shortcuts (Task 3/7) ✓; share links + `/track/:id` deep link (Task 3/7/8) ✓; dark-glass tokens + text-on-top (Task 1/5/6) ✓; mobile-first shell + breakpoint screenshots (Task 8) ✓.

**Pagination note:** Fas 1b reads are all small — families (22), subgenres per family (<20), tracks per subgenre (~30 via the `subgenre_tracks` join). None approach the 1000-row PostgREST cap, so per-query reads are safe here; no unbounded list read exists in this plan.

**Placeholder scan:** all component code complete; no TODO/TBD. Search icon in TabBar is inert (search is not in Fas 1b scope — genre/subgenre/song browse only; live search was never in the approved Fas 1 flow). Service/share icons are minimal glyphs by design.

**Type consistency:** `Family`/`Subgenre`/`Track` (Task 1) used throughout; `player.playQueue(queue, index)` consistent across TrackRow/TrackDeepLink/store; `usePlayer()` return shape consistent in MiniPlayer/NowPlaying; `getTracksForSubgenre` join-row narrowing typed (`{ tracks: TrackRow | null }`).
