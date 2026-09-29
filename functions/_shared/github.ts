/**
 * Minimal GitHub Contents API client for committing data/events.json changes
 * from functions/api/admin/events.ts. Uses the sha-based optimistic
 * concurrency the Contents API already provides: a PUT with a stale `sha`
 * is rejected by GitHub with 409/422 rather than silently overwriting a
 * concurrent edit.
 */

const GITHUB_API = 'https://api.github.com'

export class GitHubConflictError extends Error {
  constructor() {
    super('Someone else just edited this file — refresh and try again.')
    this.name = 'GitHubConflictError'
  }
}

type ContentsResponse = { content: string; sha: string }

export async function getJSONFile<T>(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<{ data: T; sha: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'section-website-demo-admin',
    },
  })
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`)
  const body = (await res.json()) as ContentsResponse
  // atob alone decodes to Latin1, not UTF-8 — a plain atob here corrupts any
  // non-ASCII character (em dashes, curly quotes) on every read-modify-write
  // round trip. escape/decodeURIComponent mirrors the encodeURIComponent/unescape
  // used to encode in putJSONFile below, so the two stay symmetric.
  const data = JSON.parse(decodeURIComponent(escape(atob(body.content.replace(/\n/g, ''))))) as T
  return { data, sha: body.sha }
}

export async function putJSONFile(
  owner: string,
  repo: string,
  path: string,
  data: unknown,
  sha: string,
  token: string,
  message: string,
): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n'
  const encoded = btoa(unescape(encodeURIComponent(content)))

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'section-website-demo-admin',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: encoded,
      sha,
      // `@users.noreply.github.com` is special-cased by GitHub: without the
      // `ID+username` prefix it expects, it can't attribute the commit to an
      // account and the commit list falls back to showing the email's local
      // part ("noreply") instead of trusting the free-text `name` below —
      // confirmed the hard way, this is exactly what was showing up. A
      // non-GitHub domain sidesteps that special-casing entirely. Set on
      // both author and committer so it displays the same regardless of
      // which one a given GitHub UI surface reads.
      author: { name: 'Section J Agent', email: 'agent@section-website-demo.invalid' },
      committer: { name: 'Section J Agent', email: 'agent@section-website-demo.invalid' },
    }),
  })

  if (res.status === 409 || res.status === 422) throw new GitHubConflictError()
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status}`)
}
