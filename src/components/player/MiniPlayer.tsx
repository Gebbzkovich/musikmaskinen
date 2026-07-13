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
