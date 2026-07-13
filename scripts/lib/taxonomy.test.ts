import { test, expect } from 'bun:test'
import { families, type FamilySeed } from './taxonomy.ts'
import { slugify } from './slug.ts'

test('family slugs are unique and non-empty', () => {
  const slugs = families.map((f: FamilySeed) => f.slug)
  expect(new Set(slugs).size).toBe(slugs.length)
  for (const s of slugs) expect(s.length).toBeGreaterThan(0)
})

test('every family has at least 3 subgenres and a hex color', () => {
  for (const f of families) {
    expect(f.subgenres.length).toBeGreaterThanOrEqual(3)
    expect(f.color).toMatch(/^#[0-9a-fA-F]{6}$/)
  }
})

test('slugify normalizes names', () => {
  expect(slugify('Deep House')).toBe('deep-house')
  expect(slugify('R&B / Soul')).toBe('r-b-soul')
})

test('subgenre names are unique across all families', () => {
  // genres.family_id is single-owner, so a name in two families would be
  // silently reassigned to whichever family is applied last.
  const names = families.flatMap((f: FamilySeed) => f.subgenres.map((s) => s.name))
  expect(new Set(names).size).toBe(names.length)
})
