export interface Family { id: string; name: string; slug: string; color: string; sort: number }
export interface Subgenre { id: string; name: string; slug: string; color: string; familyId: string }
export interface Track {
  id: string; itunesTrackId: number; artistName: string; trackName: string;
  artworkUrl: string; previewUrl: string; appleMusicUrl: string; durationMs: number
}
