import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from './session'
import { setMyProfile } from '../social/db'
import { providerAvatar, providerName, uploadAvatar } from '../social/avatar'
import { Avatar } from '../components/Avatar'

export function HandleSetup() {
  const { session } = useSession()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (session) { setName(providerName(session)); setAvatar(providerAvatar(session)) } }, [session])
  const valid = /^[a-z0-9_]{3,20}$/.test(handle.toLowerCase())
  const onFile = async (f: File | undefined) => {
    if (!f || !session) return
    setBusy(true); setErr(null)
    try { setAvatar(await uploadAvatar(session.user.id, f)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Kunde inte ladda upp bild') }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (!session || !valid) return
    setBusy(true); setErr(null)
    try { await setMyProfile(session.user.id, handle, name || handle, avatar); navigate('/inbox', { replace: true }) }
    catch (e) { setErr(e instanceof Error ? (/duplicate|unique/i.test(e.message) ? 'Användarnamnet är upptaget' : e.message) : 'Fel') }
    finally { setBusy(false) }
  }
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-[24px] font-bold tracking-tight">Skapa din profil</h1>
      <div className="mt-6 flex items-center gap-4">
        <Avatar url={avatar} name={name} size={64} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="glass rounded-[12px] px-4 py-2 text-sm disabled:opacity-50">Ladda upp bild</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <label className="mt-6 text-xs text-white/50">Namn</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" className="glass mt-1 h-12 rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      <label className="mt-4 text-xs text-white/50">Användarnamn</label>
      <div className="glass mt-1 flex h-12 items-center rounded-[14px] px-4">
        <span className="text-white/40">@</span>
        <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="användarnamn" className="ml-1 flex-1 bg-transparent outline-none placeholder:text-white/35" />
      </div>
      <p className="mt-2 text-xs text-white/40">3–20 tecken: a–z, 0–9, _ · används för att hitta dig.</p>
      <button onClick={save} disabled={!valid || busy} className="mt-5 flex h-12 items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Fortsätt</button>
      {err && <p className="mt-3 text-red-300">{err}</p>}
    </section>
  )
}
