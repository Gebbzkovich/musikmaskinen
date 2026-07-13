import { supabase } from '../lib/supabase'
import type { Profile, Message } from './types'
import type { Track } from '../lib/types'

interface ProfileRow { id: string; handle: string | null; display_name: string | null; avatar_url: string | null }
const toProfile = (r: ProfileRow): Profile => ({ id: r.id, handle: r.handle, displayName: r.display_name, avatarUrl: r.avatar_url })

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id,handle,display_name,avatar_url').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toProfile(data as ProfileRow) : null
}

export async function setMyProfile(userId: string, handle: string, displayName: string, avatarUrl?: string | null): Promise<void> {
  const patch: Record<string, string | null> = { handle: handle.toLowerCase(), display_name: displayName }
  if (avatarUrl !== undefined) patch.avatar_url = avatarUrl
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function searchProfiles(handle: string): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('id,handle,display_name,avatar_url').ilike('handle', `${handle.toLowerCase()}%`).not('handle', 'is', null).limit(10)
  if (error) throw new Error(error.message)
  return (data as ProfileRow[]).map(toProfile)
}

export async function sendFriendRequest(me: string, addresseeId: string): Promise<void> {
  const { error } = await supabase.from('friendships').insert({ requester_id: me, addressee_id: addresseeId, status: 'pending' })
  if (error) throw new Error(error.message)
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
  if (error) throw new Error(error.message)
}

interface FriendshipRow { id: string; requester_id: string; addressee_id: string; status: string }
export async function listFriendships(me: string): Promise<{ accepted: { id: string; otherId: string }[]; incoming: { id: string; otherId: string }[]; outgoing: { id: string; otherId: string }[] }> {
  const { data, error } = await supabase.from('friendships').select('id,requester_id,addressee_id,status')
  if (error) throw new Error(error.message)
  const rows = data as FriendshipRow[]
  const accepted: { id: string; otherId: string }[] = []
  const incoming: { id: string; otherId: string }[] = []
  const outgoing: { id: string; otherId: string }[] = []
  for (const r of rows) {
    const otherId = r.requester_id === me ? r.addressee_id : r.requester_id
    if (r.status === 'accepted') accepted.push({ id: r.id, otherId })
    else if (r.addressee_id === me) incoming.push({ id: r.id, otherId })
    else outgoing.push({ id: r.id, otherId })
  }
  return { accepted, incoming, outgoing }
}

export async function getProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('profiles').select('id,handle,display_name,avatar_url').in('id', ids)
  if (error) throw new Error(error.message)
  return new Map((data as ProfileRow[]).map((r) => [r.id, toProfile(r)]))
}

interface MessageRow { id: string; conversation_id: string; sender_id: string; kind: 'text' | 'track'; body: string | null; track_id: string | null; created_at: string }
const toMessage = (r: MessageRow): Message => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, kind: r.kind, body: r.body, trackId: r.track_id, createdAt: r.created_at })

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('messages').select('id,conversation_id,sender_id,kind,body,track_id,created_at').eq('conversation_id', conversationId).order('created_at')
  if (error) throw new Error(error.message)
  return (data as MessageRow[]).map(toMessage)
}

export async function listMyConversationIds(me: string): Promise<string[]> {
  // Filter to MY membership rows: RLS also lets me see the other member's row of
  // my own conversations, so an unfiltered select returns each conversation twice.
  const { data, error } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', me)
  if (error) throw new Error(error.message)
  return (data as { conversation_id: string }[]).map((r) => r.conversation_id)
}

export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { other_user: otherUserId })
  if (error) throw new Error(error.message)
  return data as string
}

export async function sendText(conversationId: string, senderId: string, body: string): Promise<void> {
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, kind: 'text', body })
  if (error) throw new Error(error.message)
}

export async function shareTrackToFriend(senderId: string, friendId: string, trackId: string, comment?: string): Promise<string> {
  const conv = await getOrCreateConversation(friendId)
  const { error } = await supabase.from('messages').insert({ conversation_id: conv, sender_id: senderId, kind: 'track', track_id: trackId })
  if (error) throw new Error(error.message)
  if (comment && comment.trim()) await sendText(conv, senderId, comment.trim())
  return conv
}

interface TrackRow { id: string; track_name: string; artist_name: string; artwork_url: string | null; preview_url: string | null; apple_music_url: string | null; duration_ms: number | null; itunes_track_id: number | null }
export async function getTracksByIds(ids: string[]): Promise<Map<string, Track>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('tracks').select('id,track_name,artist_name,artwork_url,preview_url,apple_music_url,duration_ms,itunes_track_id').in('id', ids)
  if (error) throw new Error(error.message)
  return new Map((data as TrackRow[]).map((r) => [r.id, { id: r.id, itunesTrackId: r.itunes_track_id ?? 0, trackName: r.track_name, artistName: r.artist_name, artworkUrl: r.artwork_url ?? '', previewUrl: r.preview_url ?? '', appleMusicUrl: r.apple_music_url ?? '', durationMs: r.duration_ms ?? 0 }]))
}
