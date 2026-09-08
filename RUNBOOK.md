# Decoded — go-live runbook

Everything here is free tier. Total recurring cost: **$0 hosting, $0 auth, $0 scheduling.**
Your only real spend is Anthropic API calls during triage, which are yours, offline, and capped by
`max_triage_per_run`. No model runs when a visitor opens a page — ever.

Steps marked **[you]** need an account or a browser and I cannot do them for you.
Steps marked **[done]** are already built and committed.

---

## Stage 1 — Publish the site (about 20 minutes)

### 1.1 [you] Make an anonymous GitHub account

You asked to stay anonymous. Git commits here are already safe — this repo commits as
`AI engineer <decoded@users.noreply.github.com>` and cannot leak your identity.

But **your GitHub account name is visible on any public repo regardless of commit identity.** If
anonymity matters, sign up for a fresh account with a handle that is not tied to you, and do
everything below under it. Use a private repo if you prefer — Cloudflare Pages can still read it.

### 1.2 [you] Create an empty repo, then push

Create a repo on that account (no README, no .gitignore — the repo already has both), then:

```bash
git -C "D:/ML Projects/decoded" remote add origin https://github.com/<account>/<repo>.git
```

```bash
git -C "D:/ML Projects/decoded" push -u origin main
```

### 1.3 [you] Connect Cloudflare Pages

Cloudflare Pages, because the free tier has no sleep, no bandwidth bill, and leaks the least
account information. Dashboard → Workers & Pages → Create → Pages → Connect to Git.

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| **Root directory** | **`web`** |
| Node version env var | `NODE_VERSION` = `20` |

**Root directory must be `web`.** The repo has `web/` and `api/` side by side and the build fails
confusingly if it runs at the top level.

No redirect rules needed — the app uses hash routing, so every route is served by one `index.html`.

### 1.4 [you] Check it

- Feed loads, 7 entries
- An entry opens, all four view tabs work, reading-level tabs switch the text
- Deep link in a fresh tab: `https://<your-domain>/#/entry/hnsw`
- No console errors

---

## Stage 2 — Free scheduler (about 5 minutes)

### 2.1 [done] The workflow

`.github/workflows/pipeline.yml` runs weekly, plus a manual "Run workflow" button.

It **opens a pull request, it does not publish.** A human still merges. That is deliberate: the
site's entire claim is that a person checked the entry, so the robot is not allowed to publish on
its own.

### 2.2 [you] Add the one secret it needs

Repo → Settings → Secrets and variables → Actions → New repository secret:

- Name: `ANTHROPIC_API_KEY`
- Value: your key

`GITHUB_TOKEN` is provided automatically — nothing to add.

### 2.3 [you] Test it before trusting the schedule

Actions tab → Pipeline → Run workflow → set triage limit to `1`. Watch it, then read the PR it
opens. **This will be the first time the triage pipeline has ever run against the live API** — it
is written and type-checked but has never executed, so expect the first run to need prompt tuning.

---

## Stage 3 — Google login (about 40 minutes, needs two accounts)

Not built yet. Read the honest version below before deciding how far to go.

### The thing you need to know first

**Gating a static site in JavaScript is decoration, not security.** If entries ship inside the JS
bundle, anyone opens DevTools and reads all of them, logged in or not. Two options:

| | Cosmetic gate | Real gate |
|---|---|---|
| Content lives in | the JS bundle | Supabase Postgres behind Row Level Security |
| Can a determined visitor read it without logging in? | Yes | No |
| Work | ~2 hours | ~1 day (schema, migration, export path, loading states) |
| Cost | $0 | $0 |

Both are free. The difference is only effort and honesty.

### And the growth tradeoff

If you gate everything, Google cannot index any of it, shared links preview as nothing, and nobody
can judge the site before signing up. Recommended split, which is what I have built toward:

- **Public:** the feed, and the Architecture view of each entry
- **Gated:** Trace, Displacement, Verdict — the three that take the real work

That gives search engines and social previews something real, and makes the signup worth making.

### 3.1 [you] Supabase project

supabase.com → new project (free tier). From Settings → API, copy:
- Project URL
- `anon` public key

Both are safe in the frontend — that is what the anon key is for. **Never put the `service_role`
key in the web app.**

### 3.2 [you] Google OAuth credentials

Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.

- Authorised redirect URI: the callback URL Supabase shows you on its Google provider page
  (`https://<project>.supabase.co/auth/v1/callback`)

Then in Supabase → Authentication → Providers → Google: paste the client ID and secret, enable it.

Add your Cloudflare domain under Authentication → URL Configuration → Redirect URLs, or login will
bounce back to localhost in production.

### 3.3 [me] Once you have those two values

Give me the project URL and anon key and I will build the auth layer, the sign-in screen, the gate,
and the RLS-backed content path. They go in Cloudflare as `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` build variables — not in the repo.

---

## Stage 4 — Before you promote the link

**`og.png` does not exist.** `index.html` points at `/og.png` for link previews. Until you add a
1200x630 PNG at `web/public/og.png`, shared links show a title and description but no image card.
Your distribution is people clicking links, so this directly costs you reach. SVG will not work —
Open Graph requires a raster format.

**Hash routing limits sharing and search.** With `#/entry/hnsw`, the fragment is never sent to the
server, so every entry link produces the *same* preview card and search engines index hash routes
poorly. Fixing it properly means browser routing + an SPA fallback + prerendering one HTML file per
entry. Worth doing once there are enough entries to justify it; not a config toggle.

---

## What each thing costs

| | Free tier | What would break it |
|---|---|---|
| Cloudflare Pages | Unlimited requests, 500 builds/month | More than ~16 deploys a day |
| GitHub Actions | Free on public repos; monthly minutes on private | This workflow uses a few minutes a week |
| Supabase | 50k monthly active users, 500 MB database | Not a concern at your scale |
| Anthropic API | Pay as you go | Triage calls only. `max_triage_per_run` caps each run |
