import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getSurpriseTrack, type SurpriseResult } from '../lib/db'
import { player } from '../player/playerStore'

export function SurpriseScreen() {
  const [s, setS] = useState<SurpriseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const surprise = async () => {
    setLoading(true)
    try { const r = await getSurpriseTrack(); if (r) { setS(r); player.playQueue([r.track], 0) } }
    catch { /* ignore, keep previous */ }
    finally { setLoading(false) }
  }
  useEffect(() => { void surprise() }, [])
  return (
    <section className="flex min-h-svh flex-col items-center px-6 pt-8"
      style={{ background: s ? `radial-gradient(340px 340px at 50% 22%, ${s.subgenre.color}66, transparent 60%)` : undefined }}>
      <p className="text-[11px] uppercase tracking-[1.3px] text-white/40">Överraska mig</p>
      {s && (
        <>
          <div className="mt-8 h-60 w-60 overflow-hidden rounded-[28px] shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.14)]">
            <img src={s.track.artworkUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="mt-6 text-center">
            <div className="text-[22px] font-bold tracking-tight">{s.track.trackName}</div>
            <div className="mt-1 text-white/55">{s.track.artistName}</div>
            <div className="mt-1 text-[12px] text-white/40">ur {s.subgenre.name}</div>
          </div>
          <button onClick={surprise} disabled={loading} className="mt-8 flex h-12 w-full max-w-xs items-center justify-center rounded-[16px] bg-white font-medium text-black disabled:opacity-50">Nästa överraskning</button>
          <Link to={`/s/${s.subgenre.slug}`} className="glass mt-3 flex h-12 w-full max-w-xs items-center justify-center rounded-[16px] font-medium">Gå till {s.subgenre.name}</Link>
        </>
      )}
      {!s && loading && <p className="mt-10 text-white/40">Slumpar…</p>}
      {!s && !loading && <p className="mt-10 text-white/40">Kunde inte hämta en låt.</p>}
    </section>
  )
}
