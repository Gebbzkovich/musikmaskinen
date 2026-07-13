import { useEffect, useState } from 'react'
import { useSession } from '../../auth/session'
import { listFriendships, getProfilesByIds, shareTrackToFriend } from '../../social/db'
import type { Profile, Track } from '../../social/types'

export function ShareSheet({ track, onClose }: { track: Track; onClose: () => void }) {
  const { session } = useSession()
  const me = session?.user.id ?? ''
  const [friends, setFriends] = useState<Profile[]>([])
  const [comment, setComment] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  useEffect(() => { if (me) (async () => { const { accepted } = await listFriendships(me); const p = await getProfilesByIds(accepted.map((a) => a.otherId)); setFriends(accepted.map((a) => p.get(a.otherId)).filter((x): x is Profile => !!x)) })().catch(() => {}) }, [me])
  return (
    <div role="dialog" aria-modal="true" aria-label="Dela låt" className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div className="glass w-full rounded-t-[24px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center font-semibold">Dela “{track.trackName}”</div>
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Lägg till en kommentar…" className="glass mb-3 h-11 w-full rounded-[14px] px-4 outline-none placeholder:text-white/35" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {friends.map((f) => (
            <button key={f.id} onClick={async () => { await shareTrackToFriend(me, f.id, track.id, comment); setSentTo(f.handle) }} className="flex flex-col items-center gap-1">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">{(f.handle ?? '?')[0]?.toUpperCase()}</span>
              <span className="max-w-16 truncate text-xs text-white/60">@{f.handle}</span>
            </button>
          ))}
          {friends.length === 0 && <p className="text-white/40">Inga vänner ännu.</p>}
        </div>
        {sentTo && <p className="mt-2 text-center text-emerald-300/90">Skickat till @{sentTo} ✓</p>}
      </div>
    </div>
  )
}
