import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useSession } from '../auth/session'
import { getMessages, sendText, getTracksByIds } from '../social/db'
import { subscribeToConversation } from '../social/realtime'
import type { Message } from '../social/types'
import type { Track } from '../lib/types'
import { SongCard } from '../components/social/SongCard'

export function ChatView() {
  const { conversationId = '' } = useParams()
  const { session } = useSession()
  const me = session?.user.id ?? ''
  const [msgs, setMsgs] = useState<Message[]>([])
  const [tracks, setTracks] = useState<Map<string, Track>>(new Map())
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const hydrate = async (list: Message[]) => {
    const ids = list.filter((m) => m.kind === 'track' && m.trackId).map((m) => m.trackId as string)
    if (ids.length) setTracks(await getTracksByIds(ids))
  }
  useEffect(() => {
    if (!conversationId) return
    let active = true
    // Reset on conversation switch so the previous chat never flashes here.
    setMsgs([]); setTracks(new Map())
    // Merge by id (never overwrite): a realtime insert can land before the initial
    // fetch resolves; unioning both keeps every message, sorted by time.
    const merge = (list: Message[]) => setMsgs((cur) => {
      const map = new Map(cur.map((m) => [m.id, m]))
      for (const m of list) map.set(m.id, m)
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    })
    getMessages(conversationId).then((l) => { if (active) { merge(l); void hydrate(l) } }).catch(() => {})
    const unsub = subscribeToConversation(conversationId, (m) => { if (active) merge([m]) })
    return () => { active = false; unsub() }
  }, [conversationId])
  useEffect(() => { void hydrate(msgs); endRef.current?.scrollIntoView() }, [msgs])

  const send = async () => {
    const b = text.trim()
    if (!b || !me) return
    setText('')
    try { await sendText(conversationId, me, b) } catch { setText(b) } // restore draft on failure
  }
  return (
    <section className="flex min-h-svh flex-col px-3 pt-4">
      <div className="flex flex-1 flex-col justify-end space-y-2 pb-4">
        {msgs.map((m) => {
          const mine = m.senderId === me
          const t = m.trackId ? tracks.get(m.trackId) : undefined
          return (
            <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
              {m.kind === 'track' && t
                ? <SongCard track={t} />
                : <div className={`max-w-[75%] rounded-[16px] px-3.5 py-2 text-[14px] ${mine ? 'bg-white text-black' : 'glass'}`}>{m.body}</div>}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div className="glass sticky bottom-24 mb-2 flex items-center gap-2 rounded-[16px] p-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send() }} placeholder="Skriv…" className="flex-1 bg-transparent px-3 outline-none placeholder:text-white/35" />
        <button onClick={send} aria-label="Skicka" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black">↑</button>
      </div>
    </section>
  )
}
