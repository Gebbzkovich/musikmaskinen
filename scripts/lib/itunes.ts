export interface RawTrack {
  itunesTrackId: number
  artistName: string
  trackName: string
  artworkUrl: string
  previewUrl: string
  appleMusicUrl: string
  durationMs: number
}

export function buildSearchUrl(term: string, limit: number): string {
  const q = new URLSearchParams({ term, media: 'music', entity: 'song', limit: String(limit) })
  return `https://itunes.apple.com/search?${q.toString()}`
}

interface ItunesResult {
  trackId?: number
  artistName?: string
  trackName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
  trackTimeMillis?: number
  kind?: string
}

export function parseTracks(json: unknown): RawTrack[] {
  const results = (json as { results?: ItunesResult[] })?.results
  if (!Array.isArray(results)) return []
  const out: RawTrack[] = []
  for (const r of results) {
    if (r.kind !== 'song') continue
    if (!r.trackId || !r.previewUrl || !r.artworkUrl100 || !r.trackViewUrl) continue
    out.push({
      itunesTrackId: r.trackId,
      artistName: r.artistName ?? '',
      trackName: r.trackName ?? '',
      artworkUrl: r.artworkUrl100.replace('100x100bb', '300x300bb'),
      previewUrl: r.previewUrl,
      appleMusicUrl: r.trackViewUrl,
      durationMs: r.trackTimeMillis ?? 0,
    })
  }
  return out
}
