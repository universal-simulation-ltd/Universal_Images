// The single page container for the whole app. The navbar (via the SDK's
// `contentClassName`), the landing page and the footer all share it, so the
// suite switcher lines up with the left edge of the page content — and the
// profile/changelog cluster with its right edge — at every breakpoint.
export const CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'

// …but only on the landing view. The editor is full-bleed — thumbnail sidebar
// hard against the left edge, resize panel against the right — so a centred
// max-w-7xl navbar floats inset above it. With an image open the bar spans the
// viewport too, which is what puts the home button at the far left and the
// actions/profile/changelog cluster at the far right, in line with the editor
// beneath. Universal PDF's open-document toolbar has the same shape.
export const EDITOR_CONTAINER = 'w-full px-3 sm:px-4'
