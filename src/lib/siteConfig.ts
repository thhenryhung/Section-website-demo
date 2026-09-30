/**
 * Single source of truth for everything that's specific to *this* section, not
 * to the codebase. A section forking this repo should only need to edit this
 * file (plus the ~7 brand hex values in src/index.css, which Tailwind's CSS-only
 * `@theme` block can't import from here — see the comment there) to make the
 * site their own.
 *
 * `wrangler.toml` (KV namespace id, Cloudflare project name) and
 * `.github/workflows/deploy.yml`'s `vars.DATA_REPO`/`vars.CLOUDFLARE_PROJECT`
 * stay hand-edited on fork too — TOML/YAML can't import a TS module.
 */

export const siteConfig = {
  orgName: 'Section J',
  tagline: 'MBA Class of 2028',
  description: 'A private calendar and social hub for MBA 2028 Section J.',
  tabs: [
    { to: '/directory', label: 'Jirectory' },
    { to: '/calendar', label: 'Jalendar' },
    { to: '/social', label: 'Jocial' },
  ],
  github: { owner: 'thhenryhung', repo: 'section-website-demo' },
  cloudflare: { pagesProject: 'section-website-demo' },
  /**
   * The public half of the VAPID keypair used to sign push notifications
   * (functions/_shared/push.ts holds the private half as a secret, never
   * committed). Public by design — RFC 8292 keys are meant to be shared with
   * every subscribing browser; there is nothing to protect by hiding it.
   *
   * This placeholder isn't a working key — generate a real pair for any
   * actual deploy with `npx web-push generate-vapid-keys` and paste the
   * public half here (the private half goes in the Cloudflare dashboard as
   * VAPID_PRIVATE_KEY, never committed).
   */
  vapidPublicKey: 'REPLACE_ME',
} as const

export type SiteConfig = typeof siteConfig
