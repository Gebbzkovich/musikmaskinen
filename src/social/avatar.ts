import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Prefer the Google/OAuth profile picture the provider hands us at login.
export function providerAvatar(session: Session | null): string | null {
  const m = session?.user.user_metadata as Record<string, unknown> | undefined
  return (m?.avatar_url as string) ?? (m?.picture as string) ?? null
}
export function providerName(session: Session | null): string {
  const m = session?.user.user_metadata as Record<string, unknown> | undefined
  return (m?.full_name as string) ?? (m?.name as string) ?? ''
}
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}` // cache-bust so a replaced image shows immediately
}
