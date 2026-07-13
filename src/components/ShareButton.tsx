import { useState, type MouseEvent } from 'react'
import { shareUrl } from '../lib/links'
import type { Track } from '../lib/types'
import { useSession } from '../auth/session'
import { ShareSheet } from './social/ShareSheet'

export function ShareButton({ track }: { track: Track }) {
  const { session } = useSession()
  const [open, setOpen] = useState(false)
  const onShare = async (e: MouseEvent) => {
    e.stopPropagation()
    if (session) { setOpen(true); return }
    const url = shareUrl(track.itunesTrackId)
    const title = `${track.trackName} — ${track.artistName}`
    if (navigator.share) { try { await navigator.share({ title, url }) } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(url) } catch { /* ignore */ } }
  }
  return (
    <>
      <button onClick={onShare} aria-label="Dela" className="flex h-6 w-6 items-center justify-center rounded-[7px] text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4" /></svg>
      </button>
      {open && <ShareSheet track={track} onClose={() => setOpen(false)} />}
    </>
  )
}
