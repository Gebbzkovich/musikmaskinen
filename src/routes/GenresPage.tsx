import { Link } from 'react-router'
import { getFamilies } from '../lib/db'
import { useAsync } from '../hooks/useAsync'
import { GenreTile } from '../components/GenreTile'
import { useSession } from '../auth/session'

export function GenresPage() {
  const { data, error, loading } = useAsync(() => getFamilies(), [])
  const { session } = useSession()
  return (
    <section className="relative px-4 pt-6">
      {!session && <Link to="/login" className="glass absolute right-4 top-6 rounded-[12px] px-3 py-1.5 text-sm font-medium">Logga in</Link>}
      <p className="text-[11px] uppercase tracking-[1.3px] text-white/40">Utforska</p>
      <h1 className="mt-0.5 text-[26px] font-bold tracking-tight">Genrer</h1>
      <Link to="/surprise" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-[16px] font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]" style={{ background: 'linear-gradient(90deg, #7b5cff55, #e0407a44)' }}>✨ Överraska mig</Link>
      {loading && <p className="mt-8 text-white/40">Laddar…</p>}
      {error && <p className="mt-8 text-red-300">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(data ?? []).map((f) => <GenreTile key={f.id} family={f} />)}
      </div>
    </section>
  )
}
