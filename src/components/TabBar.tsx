import { NavLink } from 'react-router'

const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'text-white' : 'text-white/50')
export function TabBar() {
  return (
    <nav className="glass fixed bottom-3 left-1/2 z-30 flex h-14 w-[min(480px,calc(100%-28px))] -translate-x-1/2 items-center justify-around rounded-[20px] px-3">
      <NavLink to="/" aria-label="Genrer" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H8v6H4a1 1 0 0 1-1-1z" /></svg></NavLink>
      <NavLink to="/inbox" aria-label="Inkorg" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v11H7l-3 3z" /></svg></NavLink>
      <NavLink to="/friends" aria-label="Vänner" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 6.5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.2-4-4.8" /></svg></NavLink>
      <NavLink to="/me" aria-label="Profil" className={tab}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg></NavLink>
    </nav>
  )
}
