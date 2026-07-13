import { Outlet } from 'react-router'
import { TabBar } from './TabBar'
import { MiniPlayer } from './player/MiniPlayer'

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-svh max-w-[520px] flex-col">
      <main className="flex-1 pb-40">
        <Outlet />
      </main>
      <MiniPlayer />
      <TabBar />
    </div>
  )
}
