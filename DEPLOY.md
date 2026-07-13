# Deploy Musikmaskinen (Vercel)

The app is a static Vite SPA; the backend (Supabase) is already live. Deploying =
hosting the built static site. `vercel.json` handles SPA routing (all paths →
`index.html`) so deep links like `/s/reggaeton` and `/track/…` work on direct load.

## 1. Import the repo
1. Go to https://vercel.com and **sign in with GitHub** as **Gebbzkovich**.
2. **Add New… → Project → Import** `Gebbzkovich/musikmaskinen`.
3. Vercel auto-detects **Vite** and **bun** (from `bun.lock`). `vercel.json` already
   sets build (`bun run build`) + output (`dist`) — leave the defaults.

## 2. Environment variables
Add these in **Project → Settings → Environment Variables** (values from your local
`.env.local` — they are the client-safe anon key + URL, safe to expose):

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://kqujhispsknyxcmpfdkl.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(copy from `.env.local`)* |

Apply to **Production, Preview, and Development**. Then **Deploy**. You get a URL like
`https://musikmaskinen.vercel.app`.

## 3. Point Supabase Auth at the live URL (required for login)
Magic link + Google redirect back to `window.location.origin`, so the production URL
must be allowlisted, or login will fail in production.

**Supabase Dashboard → Authentication → URL Configuration:**
- **Site URL:** `https://musikmaskinen.vercel.app` (your Vercel URL)
- **Redirect URLs:** add both
  - `https://musikmaskinen.vercel.app/**`
  - `http://localhost:5173/**` (so local dev still works)

If you add a custom domain later, add it here too.

## 4. Google provider (already configured)
Google login's callback is Supabase's `…/auth/v1/callback`, which you already set in
Google Cloud — no change needed. The Site URL above is what makes the post-login
redirect land back on the app.

## Where login lives in the app
The home screen (genre browse) is public — no login needed. Login appears when you
open a social tab (**Inkorg / Vänner / Profil**), which routes to `/login`
(magic link + Continue with Google).

## Redeploys
Every push to `main` auto-builds and deploys. CI (`.github/workflows/ci.yml`) runs
tsc + build on PRs independently.
