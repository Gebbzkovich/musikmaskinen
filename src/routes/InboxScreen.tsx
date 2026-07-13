import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../auth/session'
import { listMyConversationIds, getMessages, getProfilesByIds } from '../social/db'
import { supabase } from '../lib/supabase'
import type { Profile } from '../social/types'
import { Avatar } from '../components/Avatar'

interface Row { id: string; other: Profile | null; preview: string }
export function InboxScreen() {
  const { session } = useSession()
  const me = session?.user.id ?? ''
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    if (!me) return
    ;(async () => {
      const convIds = await listMyConversationIds(me)
      const out: Row[] = []
      const otherIdByConv = new Map<string, string>()
      const { data, error: cmErr } = await supabase.from('conversation_members').select('conversation_id,user_id').neq('user_id', me)
      if (cmErr) return
      for (const r of (data ?? []) as { conversation_id: string; user_id: string }[]) otherIdByConv.set(r.conversation_id, r.user_id)
      const profs = await getProfilesByIds([...otherIdByConv.values()])
      for (const id of convIds) {
        const msgs = await getMessages(id)
        const last = msgs[msgs.length - 1]
        out.push({ id, other: profs.get(otherIdByConv.get(id) ?? '') ?? null, preview: last ? (last.kind === 'track' ? '🎵 Delade en låt' : last.body ?? '') : 'Ny chatt' })
      }
      setRows(out)
    })().catch(() => {})
  }, [me])
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Inkorg</h1>
      {rows.length === 0 && <p className="mt-3 text-white/40">Inga chattar ännu. Dela en låt med en vän!</p>}
      {rows.map((r) => (
        <Link key={r.id} to={`/c/${r.id}`} className="mt-2 flex items-center gap-3 rounded-[13px] p-2 active:bg-white/[0.06]">
          <Avatar url={r.other?.avatarUrl} name={r.other?.handle} size={44} />
          <div className="min-w-0 flex-1"><div className="font-medium">@{r.other?.handle ?? '…'}</div><div className="truncate text-[12.5px] text-white/50">{r.preview}</div></div>
        </Link>
      ))}
    </section>
  )
}
