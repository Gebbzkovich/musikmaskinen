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
