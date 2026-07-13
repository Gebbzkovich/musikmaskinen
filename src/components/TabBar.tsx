import { NavLink } from 'react-router'

export function TabBar() {
  return (
    <nav className="glass fixed bottom-3 left-1/2 z-30 flex h-14 w-[min(480px,calc(100%-28px))] -translate-x-1/2 items-center justify-around rounded-[20px] px-3">
      <NavLink to="/" aria-label="Genrer" className={({ isActive }) => isActive ? 'text-white' : 'text-white/50'}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H8v6H4a1 1 0 0 1-1-1z" /></svg>
      </NavLink>
      <span className="text-white/30" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
      </span>
    </nav>
  )
}
