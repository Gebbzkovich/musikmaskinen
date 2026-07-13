/**
 * apply-taxonomy.ts — seed genre_families and tag curated everynoise genres as
 * subgenres (family_id + slug). Run with bun; service role key from env.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/apply-taxonomy.ts [--execute]
 */
import { createClient } from '@supabase/supabase-js'
import { families } from './lib/taxonomy.ts'
import { slugify } from './lib/slug.ts'

function requireEnv(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env var: ${k}`)
  return v
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const familyRows = families.map((f) => ({ name: f.name, slug: f.slug, color: f.color, sort: f.sort }))
  console.log(`[apply-taxonomy] mode=${execute ? 'execute' : 'dry-run'} families=${familyRows.length}`)

  if (!execute) {
    let matched = 0
    const unmatched: string[] = []
    for (const f of families) {
      for (const s of f.subgenres) {
        const { data } = await supabase.from('genres').select('id').ilike('name', s.name).limit(1)
        if (data && data.length) matched++
        else unmatched.push(`${f.slug}:${s.name}`)
      }
    }
    console.log(`[apply-taxonomy] subgenres matched=${matched} unmatched=${unmatched.length}`)
    if (unmatched.length) console.log('  unmatched:', unmatched.join(', '))
    console.log('[apply-taxonomy] DRY RUN — nothing written.')
    return
  }

  const { error: fe } = await supabase.from('genre_families').upsert(familyRows, { onConflict: 'slug' })
  if (fe) throw new Error(`family upsert failed: ${fe.message}`)
  const { data: famAll, error: fq } = await supabase.from('genre_families').select('id, slug')
  if (fq || !famAll) throw new Error(`family read failed: ${fq?.message}`)
  const famBySlug = new Map((famAll as { id: string; slug: string }[]).map((f) => [f.slug, f.id]))

  let tagged = 0
  const unmatched: string[] = []
  for (const f of families) {
    const familyId = famBySlug.get(f.slug)
    for (const s of f.subgenres) {
      const { data: g } = await supabase.from('genres').select('id, name').ilike('name', s.name).limit(1)
      if (!g || !g.length) { unmatched.push(`${f.slug}:${s.name}`); continue }
      const { error: ue } = await supabase.from('genres')
        .update({ family_id: familyId, slug: slugify(g[0].name as string) })
        .eq('id', g[0].id)
      if (ue) throw new Error(`tag failed for ${s.name}: ${ue.message}`)
      tagged++
    }
  }
  console.log(`[apply-taxonomy] EXECUTE done. families=${familyRows.length} subgenres_tagged=${tagged} unmatched=${unmatched.length}`)
  if (unmatched.length) console.log('  unmatched:', unmatched.join(', '))
}

main().catch((e: unknown) => { console.error('[apply-taxonomy] FAILED:', e instanceof Error ? e.message : String(e)); process.exit(1) })
