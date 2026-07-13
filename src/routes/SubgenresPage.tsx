import { useParams } from 'react-router'
import { getFamilyBySlug, getSubgenres } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { SubgenreRow } from '../components/SubgenreRow'

export function SubgenresPage() {
  const { familySlug = '' } = useParams()
  const { data, error, loading } = useAsync(async () => {
    const fam = await getFamilyBySlug(familySlug)
    if (!fam) return { fam: null, subs: [] }
    return { fam, subs: await getSubgenres(fam.id) }
  }, [familySlug])
  return (
    <section className="px-4 pt-6">
      <p className="text-[11px] uppercase tracking-[1.3px] text-white/40">{data?.fam?.name ?? ''} · välj subgenre</p>
      <h1 className="mt-0.5 text-[26px] font-bold tracking-tight">Subgenrer</h1>
      {loading && <p className="mt-8 text-white/40">Laddar…</p>}
      {error && <p className="mt-8 text-red-300">{error}</p>}
      <div className="mt-4">
        {(data?.subs ?? []).map((s) => <SubgenreRow key={s.id} sub={s} />)}
      </div>
    </section>
  )
}
