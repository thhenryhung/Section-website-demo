import type { Person } from '../lib/types'

/**
 * The synthetic sample roster has one generated portrait per person. Production
 * builds remove photo IDs, so no production roster photo can reach this path.
 */
function portraitSrc(photoId: string): string {
  return `/demo-portraits/${photoId}.webp`
}

export function PersonPhoto({
  person,
  className,
}: {
  person: Pick<Person, 'photoId'>
  className: string
}) {
  if (!person.photoId) return null

  return (
    <img
      src={portraitSrc(person.photoId)}
      alt=""
      className={`shrink-0 object-cover ${className}`}
      loading="lazy"
    />
  )
}
