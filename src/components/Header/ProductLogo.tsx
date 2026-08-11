// GENERATED FILE — do not edit by hand.
// Source: backoffice/universal-platform/scripts/app-marks/marks.mjs
// Regenerate: node scripts/app-marks/build.mjs (from backoffice/universal-platform)
// Mark: Universal Images — A photo: a sun over hills.
// Hover: The sun rises clear of the hills.
//
// Icon-only by design: the SDK's UniversalAppsNavBar renders the product name
// from its catalogue beside this slot, so a wordmark here would print it twice.

const CSS = `
  /* Resting states */
  .uam-images-sun { transform: translateY(7px); opacity: 0.35; transition: transform .55s cubic-bezier(0.16,1,0.3,1), opacity .5s ease; }

  /* Active states */
  .uam-host-images:hover .uam-images-sun,
  .uam-host-images:focus-visible .uam-images-sun { transform: translateY(0); opacity: 1; }

  @media (prefers-reduced-motion: reduce) {
    .uam-images-sun { transition: none !important; }
  }
`

export default function ProductLogo() {
  return (
    <span
      className="uam-host-images inline-flex h-6 w-6 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      <style>{CSS}</style>
      <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="14" fill="#0f172a" />
        <rect x={12} y={14} width={40} height={32} rx={3} fill="#ffffff" />
        <circle cx={22} cy={24} r={3.4} fill="#e05504" className="uam-images-sun" />
        <path d="M14 42l10-12 8 8 6-6 12 10v4H14z" fill="#e05504" />
      </svg>
    </span>
  )
}
