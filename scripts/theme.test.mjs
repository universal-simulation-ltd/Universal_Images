// The theme key is written down TWICE, and this is what stops the two drifting.
//
//   npm run test:theme
//
// `src/stores/themeStore.ts` names it for the SDK's store; `index.html` names it
// again in the inline script that puts `.dark` on `<html>` before the first
// paint, which is the only place early enough to matter (the store applies the
// same class, but not until the module bundle has parsed). There is no way to
// share one constant between a bundled module and a script that must run during
// head parsing — so instead, renaming either without the other fails here.
//
// It is not a style rule. The key IS every user's saved choice: change it and
// everybody who chose dark is silently back on light.
//
// Same three assertions as Universal Jukebox's `src/lib/theme.test.ts`, in this
// repo's plain-node test style.

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

/** The key as the store declares it: `createThemeStore('…')`. */
const match = /createThemeStore\('([^']+)'\)/.exec(read('src/stores/themeStore.ts'))
if (!match) {
  console.log('  FAIL themeStore.ts no longer calls createThemeStore with a literal key')
  process.exit(1)
}
const key = match[1]

/** The `<head>`, i.e. everything before the module bundle can run. */
const html = read('index.html')
const head = html.slice(0, html.indexOf('</head>'))

console.log(`The pre-paint theme script (key '${key}'):`)

ok(
  head.includes(`localStorage.getItem('${key}')`),
  'reads the same localStorage key as the theme store',
  `index.html's <head> has no localStorage.getItem('${key}')`,
)
// 'system' has to be honoured here too, or somebody on the OS setting gets the
// light ground first and the dark one once the bundle catches up.
ok(
  head.includes("classList.add('dark')") && head.includes('prefers-color-scheme: dark'),
  "puts the dark class on <html> before anything is painted, 'system' included",
)
ok(
  !head.includes("classList.remove('dark')"),
  'never removes the class — light is the default, so it only ever adds',
)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
