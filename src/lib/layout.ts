// The single page container for the whole app. The navbar (via the SDK's
// `contentClassName`), the landing page and the footer all share it, so the
// suite switcher lines up with the left edge of the page content — and the
// profile/changelog cluster with its right edge — at every breakpoint.
// (The editor view is deliberately full-bleed; the navbar keeps this width
// there, which is what it already did via the SDK's 1280px default.)
export const CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'
