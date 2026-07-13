import { useEffect, useRef } from 'react'
import type { Track } from '../../lib/types'
import { player } from '../../player/playerStore'
import { usePlayer } from '../../player/usePlayer'
import { ServiceLinks } from '../ServiceLinks'
import { ShareButton } from '../ShareButton'

export function NowPlaying({ track, onClose }: { track: Track; onClose: () => void }) {
  const { state } = usePlayer()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={`Spelas nu: ${track.trackName}`}
      className="fixed inset-0 z-40 flex flex-col items-center bg-[#08080c]/95 px-6 pb-24 pt-6 backdrop-blur-2xl">
      <button ref={closeRef} onClick={onClose} aria-label="Stäng" className="self-start text-2xl leading-none text-white/60">▾</button>
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
