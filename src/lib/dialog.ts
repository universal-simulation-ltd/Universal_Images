// The shell every modal in this app is built from. Three things a dialog here
// has to get right, all of which were wrong until 2026-08-30 and all of which
// only show up on a phone:
//
// 1. **It must sit above the suite nav bar.** `UniversalAppsNavBar` sets an
//    INLINE `zIndex: 1000`, and no Tailwind `z-*` class can beat that — the
//    scale stops at `z-50`, and an inline style outranks a class whatever the
//    number. Below it, two things go wrong at once: the bar stays brightly lit
//    on top of the dialog's own backdrop, and — the bug the owner reported — a
//    dialog tall enough to reach the top of the screen slides its own header
//    UNDERNEATH the bar, taking the title and the close button with it.
//    `z-[1100]`, which is the suite-wide answer to this (see the landmines).
//
// 2. **It must never be taller than the VISIBLE viewport.** `vh` on iOS is the
//    LARGE viewport: measured with the browser toolbars hidden, whether or not
//    they are. So `max-h-[85vh]` is 85% of a taller box than the one the user
//    can see, and the overflow goes off both ends of a centred dialog. `dvh`
//    tracks what is actually on screen. The panel then takes `max-h-full` —
//    the height of the padded overlay — so the two can never drift apart.
//
// 3. **Safe areas.** The Capacitor build runs full-screen under the Dynamic
//    Island and the home indicator (`index.html` asks for `viewport-fit=cover`),
//    and a `position: fixed` box is laid out against the whole SCREEN, not the
//    safe area. Without these insets the top of a full-height dialog is behind
//    the notch. `env(safe-area-inset-*)` is 0 in a browser, so this costs the
//    web and desktop builds nothing.
//
// The panel is a flex COLUMN and the body is the only part that scrolls, so the
// header and the action row stay pinned inside the dialog's own box. Scrolling
// the whole panel instead — which is what `HostedStoreDialog` used to do — hides
// the title as soon as there is more content than room, which on a phone is
// nearly always.

/** Backdrop + centring frame. Give it the click-outside handler. */
export const DIALOG_OVERLAY = [
  'fixed inset-0 z-[1100] flex items-center justify-center',
  'max-h-[100dvh]',
  'px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]',
].join(' ')

/** The white box. Add the width cap (`max-w-md`, `max-w-lg`) and the surface. */
export const DIALOG_PANEL = 'flex w-full flex-col max-h-full min-h-0 overflow-hidden'

/** Title row — pinned. */
export const DIALOG_HEADER = 'shrink-0'

/** The only part that scrolls. `overscroll-contain` keeps the page behind still. */
export const DIALOG_BODY = 'flex-1 min-h-0 overflow-y-auto overscroll-contain'

/** Action row — pinned, so "Close" is reachable however long the body is. */
export const DIALOG_FOOTER = 'shrink-0'
