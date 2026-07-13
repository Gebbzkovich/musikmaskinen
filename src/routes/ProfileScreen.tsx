import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/session'
import { getMyProfile, setMyProfile } from '../social/db'
import { uploadAvatar } from '../social/avatar'
import { Avatar } from '../components/Avatar'

export function ProfileScreen() {
  const { session } = useSession()
  const uid = session?.user.id ?? ''
  const fileRef = useRef<HTMLInputElement>(null)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (uid) getMyProfile(uid).then((p) => { if (p) { setHandle(p.handle ?? ''); setName(p.displayName ?? ''); setAvatar(p.avatarUrl) } }).catch(() => {}) }, [uid])
  const valid = /^[a-z0-9_]{3,20}$/.test(handle.toLowerCase())
  const onFile = async (f: File | undefined) => {
    if (!f || !uid) return
    setBusy(true); setMsg(null)
    try { const url = await uploadAvatar(uid, f); setAvatar(url); await setMyProfile(uid, handle, name || handle, url); setMsg('Bild uppdaterad ✓') }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Fel') }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (!uid || !valid) return
    setBusy(true); setMsg(null)
    try { await setMyProfile(uid, handle, name || handle, avatar); setMsg('Sparat ✓') }
    catch (e) { setMsg(e instanceof Error ? (/duplicate|unique/i.test(e.message) ? 'Användarnamnet är upptaget' : e.message) : 'Fel') }
    finally { setBusy(false) }
  }
  return (
    <section className="px-4 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Profil</h1>
      <div className="mt-6 flex items-center gap-4">
        <Avatar url={avatar} name={name || handle} size={72} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="glass rounded-[12px] px-4 py-2 text-sm disabled:opacity-50">Byt bild</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <label className="mt-6 block text-xs text-white/50">Namn</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="glass mt-1 h-12 w-full rounded-[14px] px-4 outline-none" />
      <label className="mt-4 block text-xs text-white/50">Användarnamn</label>
      <div className="glass mt-1 flex h-12 items-center rounded-[14px] px-4">
        <span className="text-white/40">@</span>
        <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} className="ml-1 flex-1 bg-transparent outline-none" />
      </div>
      <button onClick={save} disabled={!valid || busy} className="mt-5 flex h-12 w-full items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Spara</button>
      {msg && <p className="mt-3 text-center text-emerald-300/90">{msg}</p>}
      <button onClick={() => supabase.auth.signOut()} className="glass mt-6 flex h-12 w-full items-center justify-center rounded-[14px] text-red-300">Logga ut</button>
    </section>
  )
}
