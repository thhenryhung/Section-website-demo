# Listserve → calendar pipeline

Catches calendar invites sent to the section's Outlook listserve and syncs
them onto the site automatically — no admin has to notice and hand-enter
them. Only forwarded messages that carry a real calendar invite (a `.ics`
attachment) turn into an event; anything else on the listserve is ignored.
There is deliberately no human review step before an event publishes and
pushes — that also means anyone who can post to the listserve can trigger a
push notification to the whole section. The short version of that tradeoff is
in this Worker's and `functions/api/ingest/event.ts`'s header comments.

```
Outlook listserve mailbox
  --(forwarding rule)-->
Cloudflare Email Routing (your domain)
  --(routing rule: "send to a Worker")-->
This Worker (email-worker/)
  --(HTTPS POST, bearer token)-->
main app's /api/ingest/event
  --(same write path as the admin panel)-->
KV overlay + GitHub commit + push notification
```

## One-time setup

This is all manual — none of it can be scripted from a repo checkout, since
it touches your Cloudflare account and the listserve mailbox directly.

1. **Add your domain to Cloudflare** (if it isn't already) and enable
   **Email Routing** for it (Cloudflare dashboard → your domain → Email →
   Email Routing). Cloudflare adds the needed MX/TXT records for you.

2. **Deploy this Worker** before wiring the routing rule to it — the rule
   needs an existing Worker to point at:
   ```bash
   cd email-worker
   npm install
   npx wrangler secret put INGEST_SHARED_SECRET   # generate a long random value
   npx wrangler deploy
   ```
   Set the **same** secret value on the main site so the two sides agree:
   ```bash
   cd ..
   npx wrangler pages secret put INGEST_SHARED_SECRET --project-name section-website-demo
   ```

3. **Create the routing rule**: Cloudflare dashboard → Email Routing →
   Routing rules → Create rule. Match a custom address (e.g.
   `events@yourdomain.com`) → Action: **Send to a Worker** →
   `section-website-demo-email-intake`.

4. **Point the listserve at that address.** On the listserve mailbox in
   Outlook: Settings → Mail → Rules → new rule → "Apply to all messages" →
   "Forward to `events@yourdomain.com`".

   **If the rule silently doesn't forward anything:** many school Exchange
   tenants commonly block external auto-forwarding as an anti-phishing
   default. If that happens, the fallback is a Power Automate flow instead
   of a native rule — "When a new email arrives" on the listserve mailbox →
   an HTTP action that POSTs the `.ics` attachment's content straight to
   `INGEST_URL` with the same bearer token. That skips Cloudflare Email
   Routing and this Worker entirely, but needs the flow's owner to have
   delegate/"Full Access" permission on the listserve mailbox.

5. **Test it**: send (or forward) a real Outlook meeting invite to the
   listserve address, or directly to `events@yourdomain.com`. The event
   should appear on the calendar and trigger a push within a minute or two.
   `npx wrangler tail` (from `email-worker/`) shows this Worker's logs live
   if something doesn't show up.

## Fork notes

- `INGEST_URL` in `wrangler.toml` is a placeholder — set it to your deployed
  Pages URL, along with the Cloudflare project name in the main repo's
  `wrangler.toml`.
- This Worker and the main Pages project are two separate Cloudflare deploy
  targets with two separate `wrangler` invocations (`email-worker/` vs. repo
  root). They share nothing except the `INGEST_SHARED_SECRET` value and the
  HTTPS call between them.
