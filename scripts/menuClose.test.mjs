// Every Actions row that opens a screen closes the Actions menu first.
//
//   npm run test:menu-close
//
// WHAT THIS IS DEFENDING (James, 2026-09-18: "in images when clicking metadata
// it should auto close the actions menu when clicked to show the metadata
// screen")
//
// The rows in src/components/Header/AppMenu.tsx are ours, but they render
// inside the SDK's Actions dropdown, which <DropdownSurface> portals to <body>
// at z-index 2_147_483_000. Our dialogs are z-[1100] (see lib/dialog.ts, and
// mobileUi.test.mjs for why they are that high). So the menu is ALWAYS painted
// over a dialog a row has just opened — on a phone it covers the dialog's own
// title and close button. `useCloseAppMenu()` from the SDK is the supported way
// out; it is a no-op outside a menu, so it is safe to call unconditionally.
//
// A source assertion rather than a browser run, for the same reason as
// mobileUi.test.mjs: it is cheap enough to keep green forever. The rendered
// behaviour was verified in Playwright at 390×844 on 2026-09-18 — before the
// fix the menu sat over the metadata dialog, after it the dialog is alone.
//
// ⚠️ NOT every row. `Open images…` / `Add more images…` deliberately does NOT
// close the menu: the <input type="file"> it drives is rendered by AppMenu
// itself, so closing the menu unmounts the input while the OS picker is still
// up, and the files chosen never arrive. That one is asserted below too, so a
// later tidy-up does not "finish the job" and break the picker.

import { readFileSync } from 'node:fs'
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

const menu = read('src/components/Header/AppMenu.tsx')

console.log('Actions rows that open a screen close the menu first:')

ok(
  /import \{[^}]*\buseCloseAppMenu\b[^}]*\} from '@unisim\/sdk'/.test(menu),
  'useCloseAppMenu is imported from the SDK',
  'the app used to have no handle on the dropdown at all',
)
ok(
  /const closeMenu = useCloseAppMenu\(\)/.test(menu),
  'and called once, at the top of AppMenu',
)

for (const [row, setter] of [['Metadata', 'setMetadataOpen'], ['Make a collage…', 'setCollageOpen']]) {
  ok(
    new RegExp(`onClick=\\{\\(\\) => \\{ closeMenu\\(\\); ${setter}\\(true\\) \\}\\}`).test(menu),
    `${row} closes the menu, then opens its screen`,
    `${setter}(true) on its own leaves the dropdown on top of the dialog`,
  )
}

// The negative control, and a real constraint — see the header.
ok(
  /onClick=\{picker\.open\}/.test(menu),
  'the image picker row still opens the file dialog and nothing else',
  'closing the menu here unmounts the <input> mid-pick',
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
