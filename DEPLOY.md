# Deploying Decoded

**What ships:** `web/` only — a static site. The `api/` pipeline stays on your machine.

**Why the API is not deployed:** every `/pipeline/*` and `/review/*` endpoint is currently
unauthenticated, so a public deployment would be a world-callable button that spends your
Anthropic credits and marks entries "verified". It also has no persistent database on any free
host. Since the site does not read the API yet — it reads `web/src/data/index.ts` — deploying it
today buys nothing and costs real risk. See "Later: the API" at the bottom.

---

## Before you push: anonymity

This repo is configured with a local git identity that does **not** use your name or email:

```
user.name  = AI engineer
user.email = decoded@users.noreply.github.com
```

That overrides your global config for this repo only, so commits here cannot leak your identity.
Verify any time with:

```bash
git -C "D:/ML Projects/decoded" config user.name && git -C "D:/ML Projects/decoded" config user.email
```

Two things git config cannot hide, which you must decide on separately:

- **Your GitHub account** is visible on any public repo — the owner's username and profile show
  regardless of commit identity. For real anonymity you need a separate GitHub account.
- **Your hosting account.** Vercel and Netlify surface the owning account on deployment URLs and
  build logs. Cloudflare Pages exposes the least by default.

If anonymity matters more than convenience: create a throwaway GitHub account, and connect the
host to that account only.

---

## Deploy (Cloudflare Pages)

Any static host works. Cloudflare Pages is suggested because it has a genuinely free tier with no
sleep, and leaks the least account information.

**1. Commit and push**

```bash
git -C "D:/ML Projects/decoded" add -A && git -C "D:/ML Projects/decoded" commit -m "Decoded: interactive AI truth engine"
```

Create an empty repo on GitHub (private is fine — Pages can read it), then:

```bash
git -C "D:/ML Projects/decoded" remote add origin https://github.com/<account>/<repo>.git && git -C "D:/ML Projects/decoded" push -u origin main
```

**2. Connect it**

In Cloudflare Pages → Create project → Connect to Git → pick the repo, then set:

| Setting | Value |
|---|---|
| Framework preset | None / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `web` |
| Node version | 20 or later |

The **root directory must be `web`** — the repo has `web/` and `api/` side by side, and the build
will fail confusingly if it runs at the repo root.

**3. That's it.** No redirect or rewrite rules are needed: the app uses hash routing
(`createHashRouter`), so every route is served by the single `index.html` and there is no 404 path
to configure.

### Netlify / Vercel equivalents

Same three values — base/root directory `web`, build command `npm run build`, publish directory
`web/dist` (Netlify wants the path from the repo root; Vercel and Cloudflare want it relative to
the root directory you set).

---

## Verify after deploy

- [ ] Feed loads and shows 7 entries
- [ ] An entry page opens and all four view tabs work
- [ ] Deep link works in a fresh tab: `https://<your-domain>/#/entry/hnsw`
- [ ] No console errors
- [ ] Favicon appears

---

## Known gaps, in priority order

**1. `og.png` does not exist yet.** `index.html` references `/og.png` for link previews. Until you
add a 1200x630 PNG at `web/public/og.png`, shared links show title and description but no image
card. This directly affects click-through on the channel you actually distribute through, so it is
worth doing before you promote the link. SVG will not work here — Open Graph and Twitter require a
raster format.

**2. Hash routing limits sharing and search.** With `#/entry/hnsw`, the fragment is never sent to
the server, so:
- every entry link produces the *same* preview card (the site-level title), not a per-entry one
- search engines index hash routes poorly

Fixing this properly means switching to `createBrowserRouter`, adding an SPA fallback rewrite on
the host, and prerendering one HTML file per entry so scrapers get per-entry titles. That is a real
piece of work, not a config toggle — worth doing once the entry count justifies it.

**3. No analytics.** You will not know whether anyone reads past the Architecture view. Cloudflare
Web Analytics is free and cookieless if you want it.

---

## Later: the API

Do not deploy `api/` until all four are done:

1. **Auth** on `/pipeline/*` and `/review/*` — a shared-secret header is the minimum.
2. **Hosted Postgres** instead of SQLite. `DATABASE_URL` is already the only thing that needs to
   change; SQLite on an ephemeral host loses every row on restart.
3. **Alembic migrations.** `create_all()` creates missing tables but never alters existing ones, so
   any schema change silently diverges in production.
4. **CORS** — currently pinned to `http://localhost:5174` in `api/app/main.py`.

Until then, run the pipeline locally and commit approved entries to the repo. That keeps your API
key on your machine and keeps the public surface at zero.
