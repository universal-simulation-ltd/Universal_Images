// Universal Images brand icon — icon-only by design. The SDK's
// UniversalAppsNavBar renders the product name from the catalogue beside this
// slot, and wraps logo+name in a single home-link when App.tsx passes
// productHomeHref. So no anchor, no wordmark, just the icon.
export default function ProductLogo() {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-600 text-white"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1.5" y="2.75" width="13" height="10.5" rx="1.5" />
        <circle cx="5" cy="6" r="1.1" fill="currentColor" stroke="none" />
        <path d="M2.5 11 L5.5 7.8 L8 9.8 L10.5 7 L13.5 10.2" />
      </svg>
    </span>
  )
}
