import { getFamilies } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { GenreTile } from '../components/GenreTile'

export function GenresPage() {
  const { data, error, loading } = useAsync(() => getFamilies(), [])
  return (
    <section className="px-4 pt-6">
      <p className="text-[11px] uppercase tracking-[1.3px] text-white/40">Utforska</p>
      <h1 className="mt-0.5 text-[26px] font-bold tracking-tight">Genrer</h1>
      {loading && <p className="mt-8 text-white/40">Laddar…</p>}
      {error && <p className="mt-8 text-red-300">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(data ?? []).map((f) => <GenreTile key={f.id} family={f} />)}
      </div>
    </section>
  )
}
