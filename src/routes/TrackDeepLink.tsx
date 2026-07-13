import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { getTrackByItunesId } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { player } from '../player/playerStore'

export function TrackDeepLink() {
  const { itunesId = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useAsync(() => getTrackByItunesId(Number(itunesId)), [itunesId])
  useEffect(() => { if (data) player.playQueue([data], 0) }, [data])
  return (
    <section className="px-4 pt-10 text-center">
      {loading && <p className="text-white/40">Laddar låt…</p>}
      {error && <p className="text-red-300">{error}</p>}
      {!loading && !data && !error && <p className="text-white/40">Låten hittades inte.</p>}
      {data && (
        <div className="mx-auto max-w-xs">
          <img src={data.artworkUrl} alt="" className="mx-auto h-52 w-52 rounded-[24px] object-cover shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8)]" />
          <div className="mt-5 text-[20px] font-bold">{data.trackName}</div>
          <div className="mt-1 text-white/55">{data.artistName}</div>
          <button onClick={() => navigate('/')} className="mt-6 rounded-[12px] px-4 py-2 text-[13px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">Utforska genrer</button>
        </div>
      )}
    </section>
  )
}
