import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from './session'
import { setMyProfile } from '../social/db'

export function HandleSetup() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const valid = /^[a-z0-9_]{3,20}$/.test(handle.toLowerCase())
  const save = async () => {
    if (!session) return
    setErr(null)
    try { await setMyProfile(session.user.id, handle, name || handle); navigate('/inbox', { replace: true }) }
    catch (e) { setErr(e instanceof Error ? (/duplicate|unique/i.test(e.message) ? 'Handle upptaget' : e.message) : 'Fel') }
  }
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-[24px] font-bold tracking-tight">Välj ditt handle</h1>
      <div className="glass mt-6 flex h-12 items-center rounded-[14px] px-4">
        <span className="text-white/40">@</span>
        <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="handle" className="ml-1 flex-1 bg-transparent outline-none placeholder:text-white/35" />
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Visningsnamn (valfritt)" className="glass mt-3 h-12 rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      <button onClick={save} disabled={!valid} className="mt-4 flex h-12 items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Fortsätt</button>
      <p className="mt-3 text-xs text-white/40">3–20 tecken, a–z, 0–9, _</p>
      {err && <p className="mt-3 text-red-300">{err}</p>}
    </section>
  )
}
