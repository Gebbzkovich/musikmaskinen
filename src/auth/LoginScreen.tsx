import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const magic = async () => {
    setErr(null)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) setErr(error.message); else setSent(true)
  }
  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setErr(error.message)
  }
  return (
    <section className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-[28px] font-bold tracking-tight">Musikmaskinen</h1>
      <p className="mt-1 text-white/55">Logga in för att dela låtar med vänner.</p>
      <button onClick={google} className="glass mt-8 flex h-12 items-center justify-center rounded-[14px] font-medium">Fortsätt med Google</button>
      <div className="my-4 text-center text-xs text-white/40">eller magisk länk</div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="du@exempel.se"
        className="glass h-12 rounded-[14px] px-4 outline-none placeholder:text-white/35" />
      <button onClick={magic} disabled={!email} className="mt-3 flex h-12 items-center justify-center rounded-[14px] bg-white font-medium text-black disabled:opacity-40">Skicka länk</button>
      {sent && <p className="mt-4 text-center text-emerald-300/90">Kolla din mejl för inloggningslänken.</p>}
      {err && <p className="mt-4 text-center text-red-300">{err}</p>}
    </section>
  )
}
