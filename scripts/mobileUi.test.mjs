// The three phone-only regressions fixed on 2026-08-30, pinned in source.
//
//   npm run test:mobile-ui
//
// None of these can be caught by `tsc` or by a desktop screenshot, and all three
// are one careless class away from coming back:
//
//   1. The navbar edit shortcuts were `hidden lg:flex`, so the iPhone app had
//      none of them.
//   2. Dialogs sat below the SDK navbar's INLINE `zIndex: 1000` and were sized
//      in `vh`, so a tall one put its own header — title and close button —
//      behind the bar.
//   3. Every text field was under 16px, which is the exact condition iOS uses
//      to decide to zoom the page in on focus and never zoom back out.
//
// These are source assertions, not a browser run: they are cheap enough to keep
// green forever, and each names the specific thing that was wrong. The rendered
// behaviour was verified separately in Playwright at 390×844 with touch
// emulation (and with the safe-area insets forced to an iPhone 15's numbers).
//
// ⚠️ Negative control, run 2026-08-30: restoring `hidden lg:flex`, putting
// `z-50` back on the metadata overlay, and deleting the coarse-pointer block
// from index.css turns 3 of these red, one per fix. If they all pass after a
// change that should have broken one, the locator is what to check first.

import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

let pass = 0
let fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) {
    pass++
    console.log(`  ok   ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`)
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (name.endsWith('.tsx')) out.push(rel)
  }
  return out
}
const TSX = walk('src')

// ---------------------------------------------------------------------------
console.log('1. The edit shortcuts reach the phone:')

const shortcuts = read('src/components/Header/EditShortcuts.tsx')

ok(
  !/className="hidden lg:flex/.test(shortcuts),
  'the shortcut row is not hidden below `lg`',
  'that class is what left the iPhone app with no Remove bg / Blur faces at all',
)
ok(
  /className="flex items-center gap-1"/.test(shortcuts),
  'the row is a plain flex at every width',
)
// The label is the only thing that goes away on a phone, so everything the
// label was saying has to be somewhere a screen reader can still reach it.
ok(
  /aria-label=\{label\}/.test(shortcuts),
  'the state text ("Removing…", "Restore bg", "Faces · N") survives as aria-label',
)
ok(
  /title=\{`\$\{label\} — \$\{title\}`\}/.test(shortcuts),
  'the title carries the state AND the explanation',
)
ok(
  /hidden lg:inline/.test(shortcuts),
  'the visible label is what drops below `lg`, not the button',
)
ok(
  /busy \? <Spinner \/>/.test(shortcuts),
  'a run in flight shows a spinner — with no label, opacity alone said nothing',
)
ok(
  /badge=\{facesBlurred && !detectingFaces \? blurredCount : null\}/.test(shortcuts),
  'the face count gets a badge, since "Faces · 3" is not rendered on a phone',
)

// ---------------------------------------------------------------------------
console.log('\n2. Dialogs clear the SDK navbar and fit the visible viewport:')

const dialogLib = read('src/lib/dialog.ts')

// ⚠️ `UniversalAppsNavBar` sets an inline `zIndex: 1000`. Tailwind's scale stops
// at 50 and an inline style outranks a class anyway, so anything under 1000 is
// painted over by the bar — see the suite landmines.
ok(/z-\[1100\]/.test(dialogLib), 'the overlay is z-[1100], above the navbar’s inline zIndex: 1000')
ok(/100dvh/.test(dialogLib), 'the overlay is capped in dvh, not vh (vh on iOS is the LARGE viewport)')
ok(
  /env\(safe-area-inset-top\)/.test(dialogLib) && /env\(safe-area-inset-bottom\)/.test(dialogLib),
  'both safe-area insets are padded for — a fixed box is laid out against the whole screen',
)
ok(/max-h-full/.test(dialogLib), 'the panel can never be taller than the padded overlay')
ok(
  /overflow-y-auto/.test(dialogLib) && /flex-1 min-h-0/.test(dialogLib),
  'only the body scrolls, so the header and footer stay pinned',
)

// Every full-screen overlay in the app must go through that shell. A new dialog
// that hand-rolls `fixed inset-0 … z-50` is exactly the bug coming back.
// ⚠️ `\{?` is load-bearing: the class is nearly always written as
// `className={"…"}` or `className={`…`}`, and a pattern anchored straight onto
// the quote matches neither — it reported a clean sweep against a deliberately
// re-broken MetadataDialog (negative control, 2026-08-30).
const overlays = TSX.filter((f) => /className=\{?["`][^"`]*fixed inset-0/.test(read(f)))
ok(
  overlays.length === 0,
  'no component hand-rolls a `fixed inset-0` overlay class',
  overlays.length ? `hand-rolled in: ${overlays.join(', ')}` : '',
)

const dialogs = ['src/components/Metadata/MetadataDialog.tsx', 'src/components/HostedStoreDialog.tsx']
for (const f of dialogs) {
  const src = read(f)
  const name = f.split('/').pop()
  ok(/DIALOG_OVERLAY/.test(src) && /DIALOG_PANEL/.test(src), `${name} uses the shared shell`)
  ok(/DIALOG_BODY/.test(src), `${name} scrolls its body rather than the whole panel`)
  ok(!/max-h-\[\d+vh\]/.test(src), `${name} has no bare-vh height cap left`)
}

// ---------------------------------------------------------------------------
console.log('\n3. iOS does not zoom the page when a field is focused:')

const css = read('src/index.css')
const coarse = css.match(/@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\n\}/)

ok(!!coarse, 'index.css has a coarse-pointer block')
if (coarse) {
  const block = coarse[0]
  ok(/font-size: max\(16px, 1em\)/.test(block), 'fields are floored at 16px — under it, iOS zooms')
  for (const sel of ['input', 'textarea', 'select']) {
    ok(new RegExp(`(^|[\\s,])${sel}[\\s,:)]`, 'm').test(block), `the floor covers <${sel}>`)
  }
  ok(
    /\(hover: none\) and \(pointer: coarse\)/.test(block),
    'scoped to touch-only pointers, so the desktop type scale is unchanged',
  )
}

// ⚠️ The other way to stop the zoom is to lock the viewport, and it is the wrong
// way: pinch-zoom is an accessibility feature. `viewport-fit=cover` must also
// survive — the Capacitor build's safe-area insets are all zero without it.
const html = read('index.html')
const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)
ok(!!viewport, 'index.html has a viewport meta')
if (viewport) {
  const content = viewport[1]
  ok(!/maximum-scale/.test(content), 'no maximum-scale — that would take pinch-zoom away')
  ok(!/user-scalable\s*=\s*no/.test(content), 'no user-scalable=no, same reason')
  ok(/viewport-fit=cover/.test(content), 'viewport-fit=cover kept — env(safe-area-inset-*) is 0 without it')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
