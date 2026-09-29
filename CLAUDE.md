# Working on Section J

A private calendar and meetup allocator for MBA 2028 Section J. Static
site, no backend, no database. 90 people.

## The one hard rule

**This is a public repository handling 90 classmates' photos, mobile numbers and
email addresses. No real personal data may ever be committed here.**

```bash
npm run check:leaks
```

Run it before every push. CI runs it on every PR. It is not ceremony — it has
already caught two genuine mistakes: a synthetic surname list that collided with a
real Section J surname, and a real classmate's email local part used as an example
in a code comment. **Never invent plausible-looking names, emails or IDs**, not
even in comments or test fixtures. Use `aexample`, `rpatel`, `example.invalid`.

Everything real lives in a separate **private** repo, `section-website-demo-data`, cloned as a
sibling directory (`../section-website-demo-data`). CI reads it with a read-only token.

## Architecture

- **Vite + React 19 + TypeScript + Tailwind v4**, deployed to Cloudflare Pages.
  Not Next.js: with client-side decryption everything is a client component, so
  Next would add complexity for nothing.
- The roster ships as **AES-256-GCM ciphertext**. The browser derives a key from a
  shared section passphrase (PBKDF2-SHA256, 600k iterations) and decrypts in
  memory. `src/lib/crypto.ts` is imported by *both* the build script and the
  browser, so the two halves cannot drift apart.
- `src/lib/` imports no React, so `pairing.ts` runs identically wherever it's
  called from — the `npm run pair` CLI, and the admin panel's in-app round
  generator (see below), which runs the same code client-side inside an
  already-authed session rather than re-exposing it to every visitor the way
  an earlier, deliberately-removed in-app admin page once did.
- Fork PRs get no secrets from GitHub Actions and build against a synthetic
  roster. That is the security boundary working, not an obstacle to route around.
- **Admin panel** (`functions/api/admin/*`, `src/pages/AdminPage.tsx`): a
  Cloudflare Pages Function + KV namespace let a small number of admins edit
  calendar events live, gated by a passphrase that is *separate* from
  `SECTION_PASSPHRASE` and checked server-side — the browser never holds the
  GitHub write token. This is the project's first server-side compute and
  first mutable persistence layer; see `SETUP.md` §8 for setup and
  `functions/api/admin/events.ts`'s header comment for the write path. The
  admin panel can also generate a meetup round (`src/lib/pairing.ts`, run
  client-side) and download the result — it deliberately never auto-commits
  that to the private `section-website-demo-data` repo, so a bad round can't silently
  become the section's history. Roster opt-outs are still not part of it.
- **Listserve ingestion** (`email-worker/`, `functions/api/ingest/event.ts`):
  a separate Cloudflare Worker — not a Pages Function, which can't handle the
  `email` event — catches calendar invites forwarded from the section's
  Outlook listserve and POSTs them to `/api/ingest/event`, which shares the
  admin panel's write path (`functions/_shared/eventWrite.ts`) so the two
  can't drift on what counts as a valid or a genuinely new event. Its own
  bearer-token secret (`INGEST_SHARED_SECRET`) gates it, not the admin
  session — nothing human logs in on this path — and there is deliberately
  no review step before it publishes and pushes. `email-worker/README.md`
  has the full pipeline and setup; `SETUP.md` §9 is the short version.

```
data/          public, non-sensitive: events, courses, synthetic sample roster
email-worker/  standalone Cloudflare Worker: listserve invite -> /api/ingest/event
functions/     Cloudflare Pages Functions — the admin API (functions/api/admin/*),
                the automated ingestion endpoint (functions/api/ingest/event.ts),
                and the public live-events read endpoint (functions/api/events.ts)
scripts/       data pipeline + pairing CLI
scripts/browser/  DevTools snippets for harvesting cards
src/assets/    public, non-sensitive images (section photo, unlock-screen badge)
src/gate/      passphrase unlock and decryption
src/lib/       crypto, pairing, calendar, siteConfig — framework-free
src/pages/     one file per tab, plus the post-unlock welcome page and admin panel
```

**Brand:** Section J's own green (`--color-green-*` in `src/index.css`) carries all
brand decoration — nav, buttons, links, the unlock screen. Crimson survives only
for a genuine error state (wrong passphrase), never as decoration
— see the comment at the top of `src/index.css` for why that split matters.

## Commands

| Command | Notes |
|---|---|
| `npm run dev` | Regenerates + encrypts sample data first. Unlock with `demo`. |
| `npm run typecheck` | Strict mode, `noUnusedLocals` on — unused imports fail the build. |
| `npm run data:parse` | Real cards → `roster.json`. Needs `../section-website-demo-data`. |
| `npm run data:photos` | Photos → webp bundle. |
| `npm run data:encrypt` | Reports passphrase length and source, never the value. |
| `npm run pair -- --kind dinner --date 2026-10-08` | Add `--dry-run` to preview. |
| `npm run check:leaks` | Before every push. |
| `npm run functions:dev` | Builds, then runs `functions/` locally via `wrangler pages dev` — the only way to test the admin API; plain `npm run dev` doesn't run Functions. |
| `npm run admin:hash-passphrase` | One-time: hashes `ADMIN_PASSPHRASE` for the Cloudflare dashboard. See `SETUP.md` §8. |

## Non-obvious things

Learned the hard way. Ignoring these reintroduces real bugs.

- **The school's card system writes the literal string `'None Listed'` into empty card fields** —
  70 of 90 for activities, 55 for interests. Unfiltered it becomes the section's
  most popular interest and a facet chip reading *None Listed 70*. Everything
  harvested goes through `clean()` in `scripts/parse-cards.ts`.
- **Which fields exist is decided by measured coverage, not by what cards
  offer.** From 89 parsed cards: home region / education / pre-MBA role 89,
  languages 68, professional interests 60, interests 34, activities 19.
  Professional interests is the only interest-style field in the MVP. Interests,
  activities, languages, post-MBA goals and social links are **deliberately out of
  scope** — a filter that can only match 19 people looks authoritative while
  hiding the other 70. `docs/cards.md` records how each is laid out on the
  card so they can be added back without rediscovering it.
- **The results table prints names as "Last, First"**, despite the column heading
  saying "Name". Assuming otherwise silently broke every name-based join. All name
  matching goes through `nameKey()`, which sorts tokens so order cannot matter.
- **`data/courses.json` still contains placeholder professors, rooms and times**,
  and Jalendar no longer imports it at all — course entries were dropped from the
  calendar by decision (see `git log` for `CalendarPage.tsx`). Bringing real course
  times back means re-adding the import there, not just fixing the JSON.
- **The passphrase that unlocks a build is whatever `data:encrypt` saw** when it
  wrote `public/data/*.enc`. Change the secret and you must re-encrypt. The
  deployed site and a local dev build are encrypted independently and can drift.
- **Actions secrets and Codespaces secrets are separate stores.** Setting only the
  Actions one means deploys work but a Codespace silently builds with `demo`.
- Sample data mirrors real sparsity, so empty states are genuinely exercised.
  Always check a person with no photo, no professional interests, no activities.
- **`section-website-demo-data/photos/` must hold the actual image files, not just the
  derived `photos.json`.** `npm run data:photos` (the deploy's "Normalise photos"
  step) *regenerates* `photos.json` from that folder on every single run — commit
  `roster.json`/`photos.json` without the raw images behind them and CI silently
  overwrites good photo data with an empty bundle on the very next deploy. This is
  exactly what happened the first time real data went live: every photo quietly
  became initials, with no error anywhere in the pipeline.
- **`package-lock.json` must be committed.** It wasn't, originally, which
  masked itself for a long time — every deploy failed earlier (missing secrets),
  so `npm ci` never got far enough to hit the missing lockfile. Fixing the earlier
  failure immediately surfaced this one. If CI ever reports "unable to cache
  dependencies" or `npm ci` failing outright, check this first.
- **`check:leaks`'s loose `+`-prefixed phone pattern needs a separator.**
  `\+\d{1,3}\s*\d{7,12}` (optional whitespace) matches a bare `+` sitting next to
  any 7–12 digit run — which a minified production bundle is full of, once every
  dependency's numeric constants get concatenated together. It only ever showed up
  in `dist/`, never in source, so it stayed invisible until the first real deploy.
  Fixed in `scripts/check-leaks.ts` by requiring an actual separator character, the
  same fix already applied once to the plain digit-run pattern next to it — same
  bug shape, different branch of the same regex.
- Opt-outs are applied at **build time** — a suppressed field is never encrypted or
  shipped, not merely hidden in the UI. Keep it that way.

See `docs/cards.md` for the markup specifics: selectors, join keys, and
why pre-MBA industry is inferred rather than read.

## About this copy

This is a public portfolio snapshot of a real project. The original runs for
a real section against a real (private, separately-hosted) roster; this copy
is deliberately frozen against the synthetic sample data in
`data/roster.sample.json` and has no live deployment or private counterpart
repo. Treat the operational notes elsewhere in this file (Codespaces secrets,
`SECTION_PASSPHRASE`, the admin panel's write target) as a description of how
the original is run, not as something this copy is currently doing.

**Deferred by decision in the original project**, kept here for context: LinkedIn
and Instagram links, post-MBA goals, interests, activities, and languages are
all out of scope for the roster's MVP — see `docs/cards.md` for why.

## Other docs

`SETUP.md` operational runbook · `PRIVACY.md` written to forward to the section
as-is · `CONTRIBUTING.md` contributor on-ramp · `scripts/browser/README.md`
harvesting · `CLAUDE.local.md` local machine constraints, if present.
