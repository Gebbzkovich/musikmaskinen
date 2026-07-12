/**
 * import-genres.ts — Fas 0 genre import for Musikmaskinen.
 *
 * Source: everynoise.com genre positions via the EveryNoise-Watch CSV
 * (frozen, non-commercial one-off import). Coordinates/colors are stored raw;
 * normalization happens in the render layer (Fas 1).
 *
 * Run with bun. Service role key comes from the environment, never hardcoded:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/import-genres.ts            # dry-run (default)
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/import-genres.ts --execute   # writes
 *
 * Same parsing and same data in both modes. --dry-run writes nothing.
 */
import { createClient } from '@supabase/supabase-js'

const SOURCE_URL =
  'https://raw.githubusercontent.com/AyrtonB/EveryNoise-Watch/main/data/genre_attrs.csv'
const SOURCE_LABEL = 'everynoise-watch-csv'
const BATCH_SIZE = 500

interface GenreRow {
  name: string
  x: number
  y: number
  color: string
  source: string
}

interface ParseResult {
  rows: GenreRow[]
  emptyNames: string[]
  missingCoords: string[]
  emptyColors: string[]
  duplicates: string[]
}

function parseCsv(csv: string): ParseResult {
  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0)
  // Drop the header row (genre,x,y,hex_colour).
  const dataLines = lines.slice(1)

  const rows: GenreRow[] = []
  const seen = new Set<string>()
  const emptyNames: string[] = []
  const missingCoords: string[] = []
  const emptyColors: string[] = []
  const duplicates: string[] = []

  for (const line of dataLines) {
    // The last three comma-separated fields are x, y, hex_colour; anything
    // before them is the genre name (robust against commas inside names).
    const parts = line.split(',')
    if (parts.length < 4) {
      missingCoords.push(line)
      continue
    }
    const color = (parts.pop() ?? '').trim()
    const yRaw = (parts.pop() ?? '').trim()
    const xRaw = (parts.pop() ?? '').trim()
    const name = parts.join(',').trim()

    if (name.length === 0) {
      emptyNames.push(line)
      continue
    }
    const x = Number(xRaw)
    const y = Number(yRaw)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      missingCoords.push(line)
      continue
    }
    if (color.length === 0) {
      emptyColors.push(line)
      continue
    }
    if (seen.has(name)) {
      duplicates.push(name)
      continue
    }
    seen.add(name)
    rows.push({ name, x, y, color, source: SOURCE_LABEL })
  }

  return { rows, emptyNames, missingCoords, emptyColors, duplicates }
}

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const mode = execute ? 'execute' : 'dry-run'

  const supabaseUrl = requireEnv('SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  console.log(`[import-genres] mode=${mode} source=${SOURCE_URL}`)

  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch source: ${response.status} ${response.statusText}`)
  }
  const csv = await response.text()
  const { rows, emptyNames, missingCoords, emptyColors, duplicates } = parseCsv(csv)

  const countGenres = async (): Promise<number> => {
    const { count, error } = await supabase
      .from('genres')
      .select('*', { count: 'exact', head: true })
    if (error) {
      throw new Error(`Count query failed: ${error.message}`)
    }
    return count ?? 0
  }

  console.log('[import-genres] parse summary:')
  console.log(`  rows to write:      ${rows.length}`)
  console.log(`  duplicates skipped: ${duplicates.length}`)
  console.log(`  empty names:        ${emptyNames.length}`)
  console.log(`  missing coords:     ${missingCoords.length}`)
  console.log(`  empty colors:       ${emptyColors.length}`)
  console.log('[import-genres] first 10 rows to write:')
  for (const row of rows.slice(0, 10)) {
    console.log(`  ${JSON.stringify(row)}`)
  }
  const listSkipped = (label: string, items: string[]): void => {
    if (items.length > 0) {
      console.log(`[import-genres] skipped (${label}):`)
      for (const item of items) console.log(`  ${item}`)
    }
  }
  listSkipped('duplicate name', duplicates)
  listSkipped('empty name', emptyNames)
  listSkipped('missing coords', missingCoords)
  listSkipped('empty color', emptyColors)

  if (!execute) {
    const before = await countGenres()
    // Dry-run must not write anything.
    const after = await countGenres()
    console.log(`[import-genres] dry-run genres count before=${before} after=${after}`)
    if (before !== after) {
      throw new Error(`Dry-run mutated the table (before=${before}, after=${after})`)
    }
    console.log('[import-genres] DRY RUN — no rows written. Re-run with --execute to write.')
    return
  }

  let written = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('genres')
      .upsert(batch, { onConflict: 'name' })
    if (error) {
      throw new Error(`Upsert failed at batch offset ${i}: ${error.message}`)
    }
    written += batch.length
    console.log(`[import-genres] upserted ${written}/${rows.length}`)
  }

  const total = await countGenres()
  console.log(`[import-genres] EXECUTE done. upserted=${written} genres_count=${total}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[import-genres] FAILED: ${message}`)
  process.exit(1)
})
