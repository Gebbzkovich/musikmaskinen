import type { Track } from '../lib/types'
import { formatDuration } from '../lib/links'
import { ServiceLinks } from './ServiceLinks'
import { ShareButton } from './ShareButton'
import { player } from '../player/playerStore'

export function TrackRow({ track, queue, index }: { track: Track; queue: Track[]; index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-[13px] p-2">
      <button type="button" onClick={() => player.playQueue(queue, index)}
        aria-label={`Spela ${track.trackName} av ${track.artistName}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] text-left active:opacity-80">
        <img src={track.artworkUrl} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 rounded-[10px] object-cover shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{track.trackName}</span>
          <span className="block truncate text-[11.5px] text-white/55">{track.artistName}</span>
        </span>
      </button>
      <ServiceLinks track={track} />
      <ShareButton track={track} />
      <span className="w-9 text-right text-[11.5px] text-white/40">{formatDuration(track.durationMs)}</span>
    </div>
  )
}
