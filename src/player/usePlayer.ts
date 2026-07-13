import { useSyncExternalStore } from 'react'
import { player, type PlayerState } from './playerStore'
import type { Track } from '../lib/types'

export function usePlayer(): { state: PlayerState; current: Track | null } {
  const state = useSyncExternalStore(player.subscribe, player.getState, player.getState)
  return { state, current: state.index >= 0 ? state.queue[state.index] ?? null : null }
}
