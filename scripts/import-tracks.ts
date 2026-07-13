/**
 * import-tracks.ts — fetch iTunes tracks per curated subgenre; upsert tracks +
 * subgenre_tracks links. bun; service role key from env.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/import-tracks.ts [--execute]
 */
import { createClient } from '@supabase/supabase-js'
import { families } from './lib/taxonomy.ts'
import { slugify } from './lib/slug.ts'
import { buildSearchUrl, parseTracks, type RawTrack } from './lib/itunes.ts'

const PER_SUBGENRE = 30

function requireEnv(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env var: ${k}`)
  return v
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const countTracks = async (): Promise<number> => {
    const { count, error } = await supabase.from('tracks').select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count failed: ${error.message}`)
    return count ?? 0
  }

  // Resolve each subgenre to its genre_id via slug (set by apply-taxonomy).
  const targets: { genreId: string; term: string; name: string }[] = []
  for (const f of families) {
    for (const s of f.subgenres) {
      const { data, error } = await supabase.from('genres').select('id').eq('slug', slugify(s.name)).limit(1)
      if (error) throw new Error(`subgenre lookup failed for "${s.name}": ${error.message}`)
      if (data && data.length) {
        targets.push({ genreId: (data[0] as { id: string }).id, term: s.searchTerm ?? s.name, name: s.name })
      }
    }
  }
  console.log(`[import-tracks] mode=${execute ? 'execute' : 'dry-run'} subgenres=${targets.length}`)

  const before = await countTracks()
  const trackByItunes = new Map<number, RawTrack>()
  const links: { name: string; ids: number[] }[] = []
  for (const t of targets) {
    const res = await fetch(buildSearchUrl(t.term, PER_SUBGENRE))
    const rows = res.ok ? parseTracks(await res.json()) : []
    for (const r of rows) trackByItunes.set(r.itunesTrackId, r)
    links.push({ name: t.name, ids: rows.map((r) => r.itunesTrackId) })
    await sleep(200) // be polite to the iTunes endpoint
  }
  console.log(`[import-tracks] fetched unique tracks=${trackByItunes.size} across ${targets.length} subgenres`)
  console.log('[import-tracks] sample:', [...trackByItunes.values()].slice(0, 5).map((r) => `${r.trackName} — ${r.artistName}`).join(' | '))

  if (!execute) {
    const after = await countTracks()
    console.log(`[import-tracks] dry-run tracks count before=${before} after=${after}`)
    if (before !== after) throw new Error('dry-run mutated tracks')
    console.log('[import-tracks] DRY RUN — nothing written.')
    return
  }

  // Upsert tracks in batches of 500 (on itunes_track_id).
  const allTracks = [...trackByItunes.values()].map((r) => ({
    artist_name: r.artistName, track_name: r.trackName, itunes_track_id: r.itunesTrackId,
    artwork_url: r.artworkUrl, preview_url: r.previewUrl, apple_music_url: r.appleMusicUrl, duration_ms: r.durationMs,
  }))
  for (let i = 0; i < allTracks.length; i += 500) {
    const { error } = await supabase.from('tracks').upsert(allTracks.slice(i, i + 500), { onConflict: 'itunes_track_id' })
    if (error) throw new Error(`track upsert failed at ${i}: ${error.message}`)
  }

  // Map itunes_track_id -> tracks.id for link rows. Paginate: PostgREST caps
  // each response at 1000 rows, so a single select silently truncates.
  const idByItunes = new Map<number, string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pe } = await supabase
      .from('tracks').select('id, itunes_track_id').not('itunes_track_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (pe) throw new Error(`track id read failed: ${pe.message}`)
    if (!page || page.length === 0) break
    for (const r of page as { id: string; itunes_track_id: number }[]) idByItunes.set(r.itunes_track_id, r.id)
    if (page.length < PAGE) break
  }

  const linkRows: { genre_id: string; track_id: string; rank: number }[] = []
  for (const t of targets) {
    const l = links.find((x) => x.name === t.name)
    if (!l) continue
    l.ids.forEach((itid, rank) => {
      const tid = idByItunes.get(itid)
      if (tid) linkRows.push({ genre_id: t.genreId, track_id: tid, rank })
    })
  }
  for (let i = 0; i < linkRows.length; i += 500) {
    const { error } = await supabase.from('subgenre_tracks').upsert(linkRows.slice(i, i + 500), { onConflict: 'genre_id,track_id' })
    if (error) throw new Error(`link upsert failed at ${i}: ${error.message}`)
  }

  const total = await countTracks()
  console.log(`[import-tracks] EXECUTE done. tracks=${total} links=${linkRows.length}`)
}

main().catch((e: unknown) => { console.error('[import-tracks] FAILED:', e instanceof Error ? e.message : String(e)); process.exit(1) })
