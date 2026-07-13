import { Link } from 'react-router'
import type { Family } from '../lib/types'

export function GenreTile({ family }: { family: Family }) {
  return (
    <Link to={`/g/${family.slug}`}
      className="relative flex h-28 flex-col overflow-hidden rounded-[18px] p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-transform duration-200 active:scale-[0.98]"
      style={{ background: `linear-gradient(150deg, ${family.color}40, ${family.color}10)` }}>
      <div className="relative z-10">
        <div className="text-[15px] font-semibold tracking-tight">{family.name}</div>
      </div>
      <span className="pointer-events-none absolute -bottom-11 -right-8 z-0 h-28 w-28 rounded-full opacity-85 blur-[4px]"
        style={{ background: family.color }} />
    </Link>
  )
}
