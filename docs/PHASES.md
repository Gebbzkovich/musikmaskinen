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

> **Pivot (2026-07-13):** Kartan är SLOPAD. Appen blev en premium bläddrare + spelare.
> everynoise-datat används som taxonomi + färg, inte som scatter-karta.
> Spec: `docs/superpowers/specs/2026-07-13-musikmaskinen-fas1-browse-player-design.md`.

## Fas 1 — Bläddrare + spelare

Genre → subgenre → låtar → glas-spelare. Mörk premium/glas, text alltid överst.

- **Fas 1a (data)** ✅ — migration `0003` (genre_families, genres.family_id/slug,
  tracks-berikning: itunes_track_id/artwork_url/preview_url/apple_music_url/duration_ms,
  subgenre_tracks) + `0004` (släpp för strikt (artist,track)-unik). `scripts/lib/taxonomy.ts`
  (22 kurerade familjer), `apply-taxonomy.ts` (taggar subgenrer), `import-tracks.ts`
  (iTunes: omslag + 30s-preview + Apple Music-länk, dry-run/execute, idempotent, fail-loud,
  retry/throttle mot iTunes rate-limit).
  - Not: iTunes rate-limitar per IP (~20 req/min); en körning fyller det den hinner före
    cooldown. Kör om `import-tracks.ts --execute` (idempotent) för att fylla resterande
    subgenrer. WARNING-raden listar vilka som saknas.
- **Fas 1b (app)** — React browse+player: `/` genrer, `/g/:family` subgenrer,
  `/s/:subgenre` låtar, global glas-spelare, `/track/:itunesId` delningslänk,
  Spotify/Apple Music-genvägar (deep links). Delningslänk + Share-knapp (utan konto).

## Fas 2 — Social (kärnan)

Konton (magisk länk + Google; Apple senare, kräver $99/år). Vänner via @handle. Dela
låt + kommentar till en vän precis som en TikTok. Privata konversation-per-vän-chattar
(aldrig publikt). Realtime. `tracks.id` refereras av delade låtar (kind='track').
Spec: `docs/superpowers/specs/2026-07-13-musikmaskinen-fas2-social-design.md`.

- **Fas 2a (data)** ✅ — migration `0005` (profiles, friendships, conversations,
  conversation_members, messages) + RLS (icke-medlem läser **0 rader**, empiriskt bevisat) +
  `get_or_create_direct_conversation`-RPC (endast vänner) + realtime på messages.
- **Fas 2b (app)** — inloggning (magisk länk + Google), @handle-setup, vänner,
  inkorg/chatt med inline spelbara låtkort, dela-ark. Wira Apple senare.

## Fas 3 — Fördjupning

Fler tjänst-deep-links, rikare previews, upptäckt.

## Fas 4 — Polish / PWA

Finputsning, prestanda, PWA-installerbarhet.
