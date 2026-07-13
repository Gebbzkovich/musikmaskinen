import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { useSession } from './session'
import { getMyProfile } from '../social/db'

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  const [hasHandle, setHasHandle] = useState<boolean | null>(null)
  useEffect(() => {
    if (!session) { setHasHandle(null); return }
    getMyProfile(session.user.id).then((p) => setHasHandle(!!p?.handle)).catch(() => setHasHandle(false))
  }, [session])
  if (loading) return <p className="p-8 text-white/40">Laddar…</p>
  if (!session) return <Navigate to="/login" replace />
  if (hasHandle === null) return <p className="p-8 text-white/40">Laddar…</p>
  if (!hasHandle) return <Navigate to="/setup" replace />
  return <>{children}</>
}
