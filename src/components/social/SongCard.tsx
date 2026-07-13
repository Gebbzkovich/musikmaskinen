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
