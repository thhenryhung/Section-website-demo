/**
 * Custom line-art phone mockups for the "Add to Home Screen" instructions on
 * /install — not real Safari/Chrome screenshots (which would mean shipping
 * someone else's UI, and go stale the next time Apple/Google redesign it),
 * but close enough in layout that the real thing is easy to recognise.
 */
import type { ReactNode } from 'react'

const FRAME = (
  <>
    <rect x="4" y="4" width="212" height="412" rx="28" fill="#0d0c08" />
    <rect x="4" y="4" width="212" height="412" rx="28" fill="none" stroke="#3d3a35" strokeWidth="2" />
    <rect x="16" y="16" width="188" height="388" rx="16" fill="#f8f7f5" />
  </>
)

/**
 * Fills the whole screen down to where the browser chrome starts, so a step
 * with no overlay on top of it (the "before" half of each pair) doesn't read
 * as broken/empty next to the step beside it that does have one.
 */
function PageBody() {
  return (
    <>
      <rect x="30" y="72" width="160" height="10" rx="3" fill="#e2dfd8" />
      <rect x="30" y="90" width="120" height="10" rx="3" fill="#e2dfd8" />
      <rect x="30" y="112" width="160" height="34" rx="6" fill="#dbeade" />
      <rect x="30" y="154" width="160" height="34" rx="6" fill="#dbeade" />
      <rect x="30" y="196" width="160" height="10" rx="3" fill="#e2dfd8" />
      <rect x="30" y="214" width="90" height="10" rx="3" fill="#e2dfd8" />
      <rect x="30" y="236" width="160" height="34" rx="6" fill="#dbeade" />
      <rect x="30" y="278" width="160" height="34" rx="6" fill="#dbeade" />
      <rect x="30" y="320" width="130" height="10" rx="3" fill="#e2dfd8" />
    </>
  )
}

function AddressBar({ label = 'section-website-demo.pages.dev' }: { label?: string }) {
  return (
    <>
      <rect x="26" y="28" width="168" height="26" rx="13" fill="#e2dfd8" />
      <circle cx="42" cy="41" r="4" fill="#6f6a61" />
      <text x="52" y="45" fontFamily="system-ui, sans-serif" fontSize="9" fill="#3d3a35">
        {label}
      </text>
    </>
  )
}

function Callout({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <g>
      <circle cx={x} cy={y} r="17" fill="none" stroke="#1f6f45" strokeWidth="2.5" />
      <circle cx={x} cy={y} r="17" fill="#1f6f45" fillOpacity="0.12" />
      {children}
    </g>
  )
}

export function IosShareStep() {
  return (
    <svg viewBox="0 0 220 420" className="w-full max-w-[180px]">
      {FRAME}
      <AddressBar />
      <PageBody />
      {/* Safari's bottom toolbar — back chevron, the share icon we're
          highlighting, then tabs, spaced so nothing overlaps the callout
          circle (previously a second "up arrow" icon sat right underneath
          it, smearing into the highlighted share icon). */}
      <rect x="16" y="358" width="188" height="46" fill="#e2dfd8" />
      <path d="M52 372 L44 380 L52 388" stroke="#3d3a35" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="150" y="374" width="14" height="12" rx="2" fill="none" stroke="#3d3a35" strokeWidth="1.5" />
      <Callout x={110} y={381}>
        <path d="M110 373 L110 387 M104 379 L110 373 L116 379" stroke="#1f6f45" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="103" y="387" width="14" height="1.5" fill="#1f6f45" />
      </Callout>
    </svg>
  )
}

export function IosAddToHomeStep() {
  return (
    <svg viewBox="0 0 220 420" className="w-full max-w-[180px]">
      {FRAME}
      <AddressBar />
      <PageBody />
      {/* Share sheet overlay */}
      <rect x="16" y="230" width="188" height="178" rx="16" fill="#ffffff" stroke="#cbc6bc" strokeWidth="1.5" />
      <rect x="90" y="240" width="40" height="4" rx="2" fill="#cbc6bc" />
      {['Copy', 'Add Bookmark'].map((label, i) => (
        <g key={label}>
          <rect x="26" y={256 + i * 34} width="18" height="18" rx="4" fill="#e2dfd8" />
          <text x="52" y={269 + i * 34} fontFamily="system-ui, sans-serif" fontSize="10" fill="#55514a">
            {label}
          </text>
        </g>
      ))}
      <rect x="26" y="324" width="168" height="30" rx="6" fill="#dbeade" />
      <rect x="34" y="331" width="16" height="16" rx="3" fill="none" stroke="#1f6f45" strokeWidth="1.5" />
      <path d="M42 335 v8 M38 339 h8" stroke="#1f6f45" strokeWidth="1.5" strokeLinecap="round" />
      <text x="56" y="343" fontFamily="system-ui, sans-serif" fontSize="10" fill="#18583a" fontWeight="600">
        Add to Home Screen
      </text>
      <Callout x={110} y={339} />
    </svg>
  )
}

export function AndroidMenuStep() {
  return (
    <svg viewBox="0 0 220 420" className="w-full max-w-[180px]">
      {FRAME}
      <AddressBar label="section-website-demo.pages.dev" />
      {/* Chrome puts the 3-dot menu in the address bar row, not below it */}
      <circle cx="182" cy="41" r="2" fill="#3d3a35" />
      <circle cx="182" cy="35" r="2" fill="#3d3a35" />
      <circle cx="182" cy="47" r="2" fill="#3d3a35" />
      <PageBody />
      <Callout x={182} y={41}>
        <circle cx="182" cy="41" r="2" fill="#1f6f45" />
        <circle cx="182" cy="35" r="2" fill="#1f6f45" />
        <circle cx="182" cy="47" r="2" fill="#1f6f45" />
      </Callout>
    </svg>
  )
}

export function AndroidInstallStep() {
  return (
    <svg viewBox="0 0 220 420" className="w-full max-w-[180px]">
      {FRAME}
      <AddressBar />
      <PageBody />
      {/* Dropdown menu from the top-right */}
      <rect x="60" y="58" width="134" height="150" rx="10" fill="#ffffff" stroke="#cbc6bc" strokeWidth="1.5" />
      {['New tab', 'New Incognito tab'].map((label, i) => (
        <text key={label} x="72" y={78 + i * 26} fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#55514a">
          {label}
        </text>
      ))}
      <rect x="60" y="122" width="134" height="30" fill="#dbeade" />
      <rect x="72" y="130" width="14" height="14" rx="3" fill="none" stroke="#1f6f45" strokeWidth="1.5" />
      <path d="M79 133 v8 M75 137 h8" stroke="#1f6f45" strokeWidth="1.5" strokeLinecap="round" />
      <text x="94" y="141" fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#18583a" fontWeight="600">
        Install app
      </text>
      <Callout x={127} y={137} />
      <text x="72" y="176" fontFamily="system-ui, sans-serif" fontSize="9.5" fill="#55514a">
        Downloads
      </text>
    </svg>
  )
}
