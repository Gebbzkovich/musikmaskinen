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
