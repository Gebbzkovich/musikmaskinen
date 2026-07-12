# Musikmaskinen — fasplan

Kartan över projektets faser. Framtida sessioner ska aldrig behöva gissa nästa steg —
läs denna fil först.

## Fas 0 — Genredata: schema + import + verifiering ✅

Databas-schema, dataimport och empirisk verifiering. Ingen UI.

- `supabase/migrations/0002_genre_schema.sql` — `genres`, `genre_examples`, `tracks` + RLS.
- `scripts/import-genres.ts` — importerar everynoise-genrer (5453 st) från
  EveryNoise-Watch-CSV:n. Råa källkoordinater (x 0..1500, y 35..19666), färg som hex.
- `genre_examples` är tom: primärkällan innehåller ingen artistdata. Artistberikning
  är ett eget beslut senare, inte något som improviseras.
- Not till Fas 1: källans y-axel lagras rått och dess orientering/skala skiljer sig från
  dagens live-everynoise (som driftar över tid). Normalisera — inkl. ev. y-flip — i
  renderingslagret, inte i datat.

## Fas 1 — Canvas-karta

Interaktiv genrekarta renderad på `<canvas>` (aldrig tusentals DOM-noder):
pan/zoom och LOD (level-of-detail). Normalisering av källkoordinater sker här.

## Fas 2 — Auth + egna listor

Supabase Auth. Användare skapar och sparar egna listor. `tracks`-modellen (kanonisk,
plattforms-ID:n som metadata) driver list-funktionerna.

## Fas 3 — Previews + deep links

iTunes-previews och deep links ut till plattformar.

## Fas 4 — Polish / PWA

Finputsning, prestanda, PWA-installerbarhet.
