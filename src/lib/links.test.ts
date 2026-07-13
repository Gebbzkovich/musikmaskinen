import { test, expect } from 'bun:test'
import { spotifySearchUrl, formatDuration } from './links'

test('spotifySearchUrl encodes artist + track', () => {
  expect(spotifySearchUrl('J Balvin', 'LA CANCIÓN')).toBe('https://open.spotify.com/search/J%20Balvin%20LA%20CANCI%C3%93N')
})
test('formatDuration formats mm:ss', () => {
  expect(formatDuration(210933)).toBe('3:31')
  expect(formatDuration(5000)).toBe('0:05')
})
