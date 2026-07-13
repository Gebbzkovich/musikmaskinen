import type { Track } from '../lib/types'

export interface PlayerState { queue: Track[]; index: number; isPlaying: boolean }

let state: PlayerState = { queue: [], index: -1, isPlaying: false }
const listeners = new Set<() => void>()
const audio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null

function emit(): void { for (const l of listeners) l() }
function set(patch: Partial<PlayerState>): void { state = { ...state, ...patch }; emit() }

function load(autoplay: boolean): void {
  if (!audio) return
  const t = state.queue[state.index]
  if (!t) return
  audio.src = t.previewUrl
  if (autoplay) void audio.play().catch(() => set({ isPlaying: false }))
}

export const player = {
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l) } },
  getState(): PlayerState { return state },
  current(): Track | null { return state.index >= 0 ? state.queue[state.index] ?? null : null },
  playQueue(queue: Track[], index: number): void { set({ queue, index, isPlaying: true }); load(true) },
  pause(): void { audio?.pause(); set({ isPlaying: false }) },
  toggle(): void {
    if (!audio || state.index < 0) return
    if (state.isPlaying) { audio.pause(); set({ isPlaying: false }) }
    else { void audio.play().catch(() => {}); set({ isPlaying: true }) }
  },
  next(): void { if (state.index < state.queue.length - 1) { set({ index: state.index + 1, isPlaying: true }); load(true) } else { audio?.pause(); set({ isPlaying: false }) } },
  prev(): void { if (state.index > 0) { set({ index: state.index - 1, isPlaying: true }); load(true) } },
}

if (audio) audio.addEventListener('ended', () => player.next())
