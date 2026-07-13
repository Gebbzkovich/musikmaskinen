import { useParams } from 'react-router'
import { getSubgenreBySlug, getTracksForSubgenre } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { TrackRow } from '../components/TrackRow'

export function SongsPage() {
  const { subgenreSlug = '' } = useParams()
  const { data, error, loading } = useAsync(async () => {
    const sub = await getSubgenreBySlug(subgenreSlug)
    if (!sub) return { sub: null, tracks: [] }
    return { sub, tracks: await getTracksForSubgenre(sub.id) }
  }, [subgenreSlug])
  const tracks = data?.tracks ?? []
  return (
    <section>
      <div className="relative px-4 pb-4 pt-7" style={{ background: `linear-gradient(160deg, ${data?.sub?.color ?? '#7b5cff'}88, transparent 70%)` }}>
        <p className="text-[11px] uppercase tracking-[1.3px] text-white/50">Subgenre</p>
        <h1 className="mt-0.5 text-[26px] font-bold tracking-tight">{data?.sub?.name ?? ''}</h1>
      </div>
      {loading && <p className="mt-8 px-4 text-white/40">Laddar…</p>}
      {error && <p className="mt-8 px-4 text-red-300">{error}</p>}
      {!loading && !error && tracks.length === 0 && (
        <p className="mt-8 px-4 text-white/40">Inga låtar ännu — kör om iTunes-importen för den här subgenren.</p>
      )}
      <div className="mt-3 px-2">
        {tracks.map((t, i) => <TrackRow key={t.id} track={t} queue={tracks} index={i} />)}
      </div>
    </section>
  )
}
