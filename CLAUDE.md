# Musikmaskinen

A modern, mobile-first reinterpretation of everynoise.com — an interactive map
of music genres. No Spotify integration. Lists and data are owned by our own
database.

## Independence (hard rules)

- This project is **standalone**. No code, config, or data may reference
  Z-Profil, zprofil.se, or Supabase project `ltkumctoowadvqtdytvw`.
- If you find Z-Profil references in global config, other directories, or MCP
  tools: do not touch them and do not use them.
- GitHub: this repo lives under the personal account **Gebbzkovich**
  (`github.com/Gebbzkovich/musikmaskinen`). It has nothing to do with the
  Z-Profil GitHub account.

## Supabase

- Project ref for **this** project: `kqujhispsknyxcmpfdkl`
  (URL: `https://kqujhispsknyxcmpfdkl.supabase.co`).
- All DB operations happen via migrations in `supabase/migrations/` — never
  ad hoc DDL in the dashboard.
- Do **not** use the global Supabase MCP tools for DB work here; they are wired
  to the Z-Profil project. Use the Supabase CLI against this project's ref.

## Engineering rules

- `bun x tsc -p tsconfig.app.json --noEmit` is mandatory before every commit.
- Deliverables count as done only after **empirical verification** against the
  real DB/UI. Report the verification result in the delivery.
- Workflow: feature branch → PR → Gustav merges.

## Design principle

- Mobile-first, glass aesthetic (`backdrop-blur`), fast.
- Map rendering on canvas — never thousands of DOM nodes.
