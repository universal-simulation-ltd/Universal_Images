// Universal Images wordmark — the click target the SuiteSwitcher dropdown
// attaches to inside <UniversalAppsNavBar />.
export default function ProductLogo() {
  return (
    <a
      href={import.meta.env.BASE_URL}
      className="inline-flex items-center gap-2 text-slate-900 no-underline px-1 py-0.5 rounded-md hover:bg-slate-50"
      aria-label="Universal Images — home"
    >
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-600 text-white">
        <svg
          viewBox="0 0 16 16"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="1.5" y="2.75" width="13" height="10.5" rx="1.5" />
          <circle cx="5" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <path d="M2.5 11 L5.5 7.8 L8 9.8 L10.5 7 L13.5 10.2" />
        </svg>
      </span>
      <span className="hidden sm:inline font-semibold tracking-tight text-[15px]">
        Universal Images
      </span>
    </a>
  )
}
