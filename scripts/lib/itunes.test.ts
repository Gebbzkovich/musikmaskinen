import { test, expect } from 'bun:test'
import { buildSearchUrl, parseTracks } from './itunes.ts'

test('buildSearchUrl encodes term and params', () => {
  const url = buildSearchUrl('deep house', 25)
  expect(url).toContain('term=deep+house')
  expect(url).toContain('entity=song')
  expect(url).toContain('limit=25')
})

test('parseTracks keeps valid songs and upscales art', () => {
  const json = { results: [
    { kind: 'song', trackId: 1, artistName: 'A', trackName: 'T', artworkUrl100: 'x/100x100bb.jpg',
      previewUrl: 'p', trackViewUrl: 'v', trackTimeMillis: 180000 },
    { kind: 'song', trackId: 2, artistName: 'B', trackName: 'U', artworkUrl100: 'y/100x100bb.jpg' },
  ] }
  const rows = parseTracks(json)
  expect(rows.length).toBe(1)
  expect(rows[0].artworkUrl).toBe('x/300x300bb.jpg')
  expect(rows[0].appleMusicUrl).toBe('v')
})

test('parseTracks tolerates junk', () => {
  expect(parseTracks(null)).toEqual([])
  expect(parseTracks({})).toEqual([])
})
