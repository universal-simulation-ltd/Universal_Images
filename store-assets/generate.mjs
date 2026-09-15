#!/usr/bin/env node
// Regenerates the App Store and Google Play images for Universal Images.
//
//   npm run build:desktop                 # the bundle the iOS/Android shells load
//   node store-assets/generate.mjs        # every screen, every device
//   node store-assets/generate.mjs 03     # only screens whose name starts 03
//   DEVICE=iphone node store-assets/generate.mjs
//
// Needs Playwright's Chromium. It is not a dependency of this repo, so either
// `npm i --no-save playwright && npx playwright install chromium`, or point
// PLAYWRIGHT at an existing copy's index.mjs.
//
// The screens are the real app: dist/ is served to the browser through
// Playwright's request routing (no local server, no port), at each store
// device's viewport and pixel ratio, and driven like a person would drive it.
// Nothing off-app is loaded.
//
// ⚠️ The sample photos are DRAWN here, from SVG — a lake at dusk, a mug, a tile
// pattern, a meadow. The app's own "Try with example image" is a portrait of a real
// person, so it is deliberately not used in store screenshots.
//
// Output (committed): the real captures, raw/iphone (1320x2580), raw/ipad
// (2064x2664) and raw/android (1080x2172). The UNI·SIM store kit frames them
// into the store screenshots in out/, drawing the status bar and home
// indicator they leave out. store.json says which capture each screen shows,
// strings/en-GB.json every word on it:
//
//   node ../../Docs_UNI_SIM/store-kit/build.mjs store-assets
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dist = path.join(root, 'dist')
const { chromium } = await import(
  process.env.PLAYWRIGHT ? pathToFileURL(process.env.PLAYWRIGHT).href : 'playwright'
)

// Each device's screen less the status bar and home indicator the store kit
// draws (its layouts.mjs, CLASSES[…].insets): iPhone 17 Pro Max 956 pt less
// 62 + 34, iPad 13" 1376 pt less 24 + 20, an Android phone 780 dp less 32 + 24.
const DEVICES = [
  { key: 'iphone', dir: 'raw/iphone', width: 440, height: 860, dpr: 3 },
  { key: 'ipad', dir: 'raw/ipad', width: 1032, height: 1332, dpr: 2 },
  { key: 'android', dir: 'raw/android', width: 360, height: 724, dpr: 3 },
]
const ORIGIN = 'https://app.test'
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
}

// ── Sample photos (drawn, not found) ───────────────────────────────────────
const LAKE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#27365f"/><stop offset=".45" stop-color="#b5657a"/>
      <stop offset=".75" stop-color="#f3a96b"/><stop offset="1" stop-color="#ffd9a0"/></linearGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1b27c"/><stop offset=".35" stop-color="#9a5f78"/><stop offset="1" stop-color="#1f2c4f"/></linearGradient>
    <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff4d6"/><stop offset=".6" stop-color="#ffd48a"/><stop offset="1" stop-color="#ffd48a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="520" fill="url(#sky)"/>
  <circle cx="760" cy="430" r="130" fill="url(#sun)"/>
  <circle cx="760" cy="440" r="46" fill="#fff1cf"/>
  <path d="M0 430 C120 360 220 380 330 410 S560 330 700 400 S980 360 1200 420 V520 H0Z" fill="#6b4f78"/>
  <path d="M0 470 C160 420 300 450 420 470 S700 430 860 470 S1080 450 1200 470 V520 H0Z" fill="#43395f"/>
  <rect y="520" width="1200" height="280" fill="url(#lake)"/>
  <rect x="700" y="530" width="120" height="6" rx="3" fill="#ffe7bd" opacity=".8"/>
  <rect x="680" y="552" width="160" height="5" rx="2.5" fill="#ffe7bd" opacity=".55"/>
  <rect x="720" y="574" width="80" height="4" rx="2" fill="#ffe7bd" opacity=".45"/>
  <path d="M0 520 C120 500 180 470 260 480 S380 520 420 520Z" fill="#2c2848"/>
  <g fill="#1d1b33">
    <path d="M60 520 l18-120 l18 120z"/><path d="M100 520 l24-160 l24 160z"/><path d="M150 520 l16-100 l16 100z"/>
    <path d="M1040 520 l22-150 l22 150z"/><path d="M1090 520 l28-190 l28 190z"/><path d="M1146 520 l18-120 l18 120z"/>
  </g>
  <g stroke="#1d1b33" stroke-width="3" fill="none" stroke-linecap="round">
    <path d="M520 250 q12 -10 24 0 q12 -10 24 0"/><path d="M580 210 q9 -8 18 0 q9 -8 18 0"/><path d="M470 290 q8 -7 16 0 q8 -7 16 0"/>
  </g>
</svg>`

const MUG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f0ea"/><stop offset="1" stop-color="#c9ddd1"/></linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9cdb8"/><stop offset=".35" stop-color="#fbf7ef"/><stop offset="1" stop-color="#cbbda4"/></linearGradient>
    <radialGradient id="shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#6f8a7b" stop-opacity=".45"/><stop offset="1" stop-color="#6f8a7b" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  <ellipse cx="500" cy="760" rx="300" ry="60" fill="url(#shadow)"/>
  <path d="M650 430 c110 0 130 170 10 190" stroke="#e8ddcb" stroke-width="42" fill="none"/>
  <path d="M330 360 h340 v330 q0 60 -60 60 h-220 q-60 0 -60 -60z" fill="url(#body)"/>
  <ellipse cx="500" cy="360" rx="170" ry="34" fill="#efe6d6"/>
  <ellipse cx="500" cy="366" rx="150" ry="26" fill="#6b4226"/>
  <path d="M345 470 h310" stroke="#2f6f5e" stroke-width="18"/>
  <g stroke="#ffffff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".75">
    <path d="M450 300 c-30 -40 30 -60 0 -110"/><path d="M520 290 c-30 -40 30 -70 0 -130"/>
  </g>
</svg>`

const MEADOW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb3f2"/><stop offset="1" stop-color="#dff0ff"/></linearGradient></defs>
  <rect width="1200" height="800" fill="url(#sky)"/>
  <circle cx="980" cy="150" r="60" fill="#fff4c2"/>
  <g fill="#ffffff" opacity=".9"><ellipse cx="260" cy="170" rx="110" ry="36"/><ellipse cx="330" cy="150" rx="80" ry="40"/><ellipse cx="700" cy="230" rx="90" ry="26"/></g>
  <path d="M0 470 C200 380 380 400 560 450 S900 380 1200 440 V800 H0Z" fill="#7fb85a"/>
  <path d="M0 560 C240 500 460 540 640 560 S980 520 1200 560 V800 H0Z" fill="#5c9a3f"/>
  <path d="M0 660 C300 620 600 660 900 650 S1100 630 1200 650 V800 H0Z" fill="#437d2e"/>
  <rect x="820" y="400" width="110" height="80" fill="#b23a2e"/><path d="M808 404 L875 350 L942 404Z" fill="#7d2620"/><rect x="862" y="440" width="26" height="40" fill="#f3e3c3"/>
  <g fill="#ffd23f">${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 97) % 1200}" cy="${690 + ((i * 37) % 100)}" r="${5 + (i % 3)}"/>`).join('')}</g>
  <g fill="#ffffff">${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 131 + 40) % 1200}" cy="${600 + ((i * 53) % 60)}" r="4"/>`).join('')}</g>
</svg>`

const TILES = (() => {
  let cells = ''
  const colours = ['#c8553d', '#f28f3b', '#588b8b', '#ffd5c2', '#2d3047']
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const c1 = colours[(x + y) % colours.length], c2 = colours[(x * 3 + y * 2 + 1) % colours.length]
    const r = (x + y) % 4
    cells += `<g transform="translate(${x * 100} ${y * 100}) rotate(${r * 90} 50 50)"><rect width="100" height="100" fill="${c1}"/><path d="M0 0 A100 100 0 0 1 100 100 L0 100Z" fill="${c2}"/><circle cx="0" cy="100" r="34" fill="#fbf3e6"/></g>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${cells}</svg>`
})()

async function render(browser, svg, w, h, type = 'jpeg') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`)
  const buf = await page.screenshot(type === 'jpeg' ? { type: 'jpeg', quality: 90 } : {})
  await page.close()
  return buf
}

// ── The screens ────────────────────────────────────────────────────────────
async function add(page, files) {
  await page.locator('input[type=file]').first().setInputFiles(files)
  await page.getByText('SIZE', { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1800)
}
const visible = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible())

const SCREENS = {
  // First open.
  async '01-start'(page) {
    await page.waitForTimeout(600)
  },
  // A photo in, a smaller size picked — S / M / L, with the new dimensions.
  async '02-resize'(page, { photos }) {
    await add(page, [photos.lake])
    await page.locator('button', { hasText: /^M\s*\d/ }).first().click()
    await page.waitForTimeout(1200)
  },
  // Cropping by hand.
  async '03-crop'(page, { photos }) {
    await add(page, [photos.lake])
    await page.getByRole('button', { name: /^Crop/ }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Manual crop/ }).first().click()
    await page.waitForTimeout(1200)
  },
  // Converting: WebP at a chosen quality, with the estimated file size.
  async '04-convert'(page, { photos }) {
    await add(page, [photos.lake])
    await page.getByLabel('More export options').first().click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /^WebP$/ }).first().click().catch(() => page.getByText('WebP', { exact: true }).first().click())
    await page.waitForTimeout(400)
    const q = page.getByLabel('Quality').first()
    if (await visible(q)) await q.fill('72')
    await page.waitForTimeout(1500)
    await page.getByLabel('Quality').first().scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(400)
  },
  // Several at once.
  async '05-batch'(page, { photos }) {
    await add(page, [photos.lake, photos.mug, photos.tiles, photos.meadow])
    const all = page.locator('button[title="All images"]')
    if (await visible(all)) {
      await all.first().click()
      await page.waitForTimeout(900)
    }
  },
}

// ── Running them ───────────────────────────────────────────────────────────
function pngInfo(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colourType: buf[25] }
}

async function serve(ctx) {
  await ctx.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== ORIGIN) return route.abort()
    let p = decodeURIComponent(url.pathname)
    if (p.endsWith('/')) p += 'index.html'
    try {
      const file = path.join(dist, p)
      await route.fulfill({ body: await readFile(file), contentType: TYPES[path.extname(file)] ?? 'application/octet-stream' })
    } catch {
      await route.fulfill({ status: 404, body: '' })
    }
  })
}

const only = process.argv.slice(2)
const devices = DEVICES.filter((d) => !process.env.DEVICE || process.env.DEVICE.split(',').includes(d.key))
const browser = await chromium.launch()
const photos = {
  lake: { name: 'Lake-at-dusk.jpg', mimeType: 'image/jpeg', buffer: await render(browser, LAKE, 1200, 800) },
  mug: { name: 'Mug-studio.jpg', mimeType: 'image/jpeg', buffer: await render(browser, MUG, 1000, 1000) },
  tiles: { name: 'Tiles.png', mimeType: 'image/png', buffer: await render(browser, TILES, 800, 800, 'png') },
  meadow: { name: 'Meadow.jpg', mimeType: 'image/jpeg', buffer: await render(browser, MEADOW, 1200, 800) },
}
let bad = 0
for (const dev of devices) {
  await mkdir(path.join(here, dev.dir), { recursive: true })
  for (const [name, run] of Object.entries(SCREENS)) {
    if (only.length && !only.some((p) => name.startsWith(p))) continue
    const ctx = await browser.newContext({
      viewport: { width: dev.width, height: dev.height }, deviceScaleFactor: dev.dpr,
      isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'en-GB',
    })
    await serve(ctx)
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${ORIGIN}/index.html`)
    await page.waitForTimeout(1200)
    try {
      await run(page, { dev, photos })
    } catch (err) {
      console.error(`FAIL ${dev.dir}/${name}: ${err.message.split('\n')[0]}`)
      bad++
    }
    const buf = await page.screenshot()
    await writeFile(path.join(here, dev.dir, `${name}.png`), buf)
    const { w, h, colourType } = pngInfo(buf)
    const ok = w === dev.width * dev.dpr && h === dev.height * dev.dpr && colourType === 2
    if (!ok) bad++
    console.log(`${ok ? 'OK ' : 'BAD'} ${dev.dir}/${name}.png ${w}x${h}${colourType === 2 ? '' : ' has alpha'}${errors.length ? ` (page errors: ${errors.length})` : ''}`)
    await ctx.close()
  }
}
await browser.close()
if (bad) {
  console.error(`${bad} problem(s) — check the output above`)
  process.exit(1)
}
