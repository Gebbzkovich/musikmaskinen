import { supabase } from '../lib/supabase'
import type { Message } from './types'

interface MessageRow { id: string; conversation_id: string; sender_id: string; kind: 'text' | 'track'; body: string | null; track_id: string | null; created_at: string }

export function subscribeToConversation(conversationId: string, onInsert: (m: Message) => void): () => void {
  const channel = supabase
    .channel(`conv:${conversationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const r = payload.new as MessageRow
        onInsert({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, kind: r.kind, body: r.body, trackId: r.track_id, createdAt: r.created_at })
      })
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
