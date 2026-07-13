import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../auth/session'
import { searchProfiles, sendFriendRequest, acceptFriendRequest, listFriendships, getProfilesByIds, getOrCreateConversation } from '../social/db'
import type { Profile } from '../social/types'
import { Avatar } from '../components/Avatar'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Något gick fel'
}

export function FriendsScreen() {
  const { session } = useSession()
  const navigate = useNavigate()
  const me = session?.user.id ?? ''
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [friends, setFriends] = useState<Profile[]>([])
  const [incoming, setIncoming] = useState<{ id: string; profile: Profile }[]>([])
  const [err, setErr] = useState<string | null>(null)
  const gen = useRef(0)
  const reload = async () => {
    const { accepted, incoming } = await listFriendships(me)
    const ids = [...accepted.map((a) => a.otherId), ...incoming.map((i) => i.otherId)]
    const profs = await getProfilesByIds(ids)
    setFriends(accepted.map((a) => profs.get(a.otherId)).filter((p): p is Profile => !!p))
    setIncoming(incoming.map((i) => ({ id: i.id, profile: profs.get(i.otherId) })).filter((x): x is { id: string; profile: Profile } => !!x.profile))
  }
  useEffect(() => { if (me) reload().catch(() => {}) }, [me])
  const doSearch = async (v: string) => {
    setQ(v)
    const g = ++gen.current
    if (v.length < 2) { setResults([]); return }
    const found = (await searchProfiles(v)).filter((p) => p.id !== me)
    if (g === gen.current) setResults(found)
  }
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Vänner</h1>
      <input value={q} onChange={(e) => doSearch(e.target.value)} placeholder="Sök @handle" className="glass mt-4 h-11 w-full rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      {err && <p className="mt-3 text-red-300">{err}</p>}
      {results.map((p) => (
        <div key={p.id} className="mt-2 flex items-center gap-3 rounded-[13px] p-2">
          <div className="flex-1"><div className="font-medium">@{p.handle}</div><div className="text-xs text-white/50">{p.displayName}</div></div>
          <button onClick={async () => { try { await sendFriendRequest(me, p.id); setQ(''); setResults([]) } catch (e) { setErr(getErrorMessage(e)) } }} className="glass rounded-[10px] px-3 py-1.5 text-sm">Lägg till</button>
        </div>
      ))}
      {incoming.length > 0 && <h2 className="mt-6 text-sm uppercase tracking-wide text-white/40">Förfrågningar</h2>}
      {incoming.map((r) => (
        <div key={r.id} className="mt-2 flex items-center gap-3 rounded-[13px] p-2">
          <div className="flex-1 font-medium">@{r.profile.handle}</div>
          <button onClick={async () => { try { await acceptFriendRequest(r.id); await reload() } catch (e) { setErr(getErrorMessage(e)) } }} className="rounded-[10px] bg-white px-3 py-1.5 text-sm font-medium text-black">Acceptera</button>
        </div>
      ))}
      <h2 className="mt-6 text-sm uppercase tracking-wide text-white/40">Dina vänner</h2>
      {friends.map((p) => (
        <button key={p.id} onClick={async () => { try { navigate(`/c/${await getOrCreateConversation(p.id)}`) } catch (e) { setErr(getErrorMessage(e)) } }} className="mt-2 flex w-full items-center gap-3 rounded-[13px] p-2 text-left active:bg-white/[0.06]">
          <Avatar url={p.avatarUrl} name={p.handle} size={40} />
          <div className="flex-1"><div className="font-medium">@{p.handle}</div><div className="text-xs text-white/50">{p.displayName}</div></div>
        </button>
      ))}
      {friends.length === 0 && <p className="mt-3 text-white/40">Inga vänner ännu — sök ett @handle ovan.</p>}
    </section>
  )
}
