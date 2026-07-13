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
