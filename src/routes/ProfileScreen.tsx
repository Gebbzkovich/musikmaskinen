import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/session'
import { getMyProfile } from '../social/db'
import type { Profile } from '../social/types'

export function ProfileScreen() {
  const { session } = useSession()
  const [p, setP] = useState<Profile | null>(null)
  useEffect(() => { if (session) getMyProfile(session.user.id).then(setP).catch(() => {}) }, [session])
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Profil</h1>
      <div className="glass mt-6 rounded-[16px] p-4">
        <div className="text-lg font-semibold">@{p?.handle ?? '…'}</div>
        <div className="text-white/55">{p?.displayName}</div>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="glass mt-4 flex h-12 w-full items-center justify-center rounded-[14px] text-red-300">Logga ut</button>
    </section>
  )
}
