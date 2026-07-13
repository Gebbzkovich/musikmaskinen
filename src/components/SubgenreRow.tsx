import { Link } from 'react-router'
import type { Subgenre } from '../lib/types'
import { capitalize } from '../lib/links'

export function SubgenreRow({ sub }: { sub: Subgenre }) {
  return (
    <Link to={`/s/${sub.slug}`}
      className="mb-2 flex items-center gap-3 rounded-[15px] bg-white/[0.04] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] active:bg-white/[0.08]">
      <span className="h-9 w-9 flex-none rounded-[10px]" style={{ background: sub.color, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.2), 0 0 16px ${sub.color}` }} />
      <span className="text-[14.5px] font-medium">{capitalize(sub.name)}</span>
      <span className="ml-auto text-white/40">›</span>
    </Link>
  )
}
