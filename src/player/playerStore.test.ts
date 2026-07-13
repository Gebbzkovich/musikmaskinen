import { test, expect } from 'bun:test'
import { player } from './playerStore'
import type { Track } from '../lib/types'

const mk = (n: number): Track => ({
  id: `${n}`, itunesTrackId: n, artistName: `a${n}`, trackName: `t${n}`,
  artworkUrl: '', previewUrl: '', appleMusicUrl: '', durationMs: 0,
})

test('playQueue sets current, next/prev move within bounds', () => {
  const q = [mk(1), mk(2), mk(3)]
  player.playQueue(q, 0)
  expect(player.current()?.id).toBe('1')
  player.next(); expect(player.current()?.id).toBe('2')
  player.prev(); expect(player.current()?.id).toBe('1')
  player.prev(); expect(player.current()?.id).toBe('1') // clamped at start
})
