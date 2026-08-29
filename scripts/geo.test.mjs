// Offline country lookup — the coordinates in a photo, resolved without a
// network request.
//
//   npm run test:geo
//
// Runs under Node's type-stripping, so `geo.ts` is imported directly. It is
// called through `locateIn`, which takes the boundary set as an argument: the
// shipping path reaches it via a Vite `?raw` import that type-stripping cannot
// resolve. `world.json` is therefore loaded here instead, which has the side
// benefit of pinning the generated file itself, not just the arithmetic.
//
// What is being pinned, and why it earns a test. The panel tells somebody a
// photo they were about to post says where they live. If it names the wrong
// country it is worse than the plain numbers it replaced — confidently wrong
// beats no answer only in the wrong direction. The cases below are the ones
// that break if the ring stitching, the winding, or the quantised-integer
// transform is out:
//
//   · plain interior points, on several continents
//   · microstates (the reason the data is 1:50m and not the six-times-smaller
//     1:110m, which drops them and would answer "France" for Monaco)
//   · a point in an enclave, which is a hole in another country's ring
//   · both sides of a shared border, which is one arc walked in each direction
//   · open sea, which must answer null rather than the nearest country
//   · the antimeridian and the poles, where the bbox prefilter is degenerate
//
// Negative controls (2026-08-29, all four run):
//
//   · dropping the `holes.some(...)` guard in `locateIn` → 1 red, Lesotho,
//     which answers South Africa
//   · ignoring the `reversed` branch in `ringOf` → 2 red, Nairobi and Monaco
//   · `NEAR_SHORE_KM = 0`, i.e. no nearest-border pass → 5 red: Manhattan,
//     Monaco, Anadyr and Nome all fall to null, and the approximate flag stops
//     being set
//   · regenerating `world.json` from countries-110m → 4 red: Monaco answers
//     France, Malta null, Singapore Malaysia, and Manhattan is inside the
//     coarser coastline so it is no longer flagged approximate. (Luxembourg
//     survives at 110m — it is the one microstate that set keeps.)

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { locateIn } from '../src/lib/geo.ts'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const world = JSON.parse(readFileSync(resolve(root, 'src/data/world.json'), 'utf8'))

let failed = 0
const check = (label, actual, expected) => {
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} → ${actual}${ok ? '' : ` (expected ${expected})`}`)
}

const at = (lat, lon) => locateIn(world, lat, lon)
const country = (lat, lon) => at(lat, lon).country

// ── Ordinary interior points ───────────────────────────────────────────────
check('London', country(51.5074, -0.1278), 'United Kingdom')
check('Paris', country(48.8566, 2.3522), 'France')
check('Manhattan', country(40.7128, -74.006), 'United States of America')
check('Tokyo', country(35.6762, 139.6503), 'Japan')
check('Nairobi', country(-1.2921, 36.8219), 'Kenya')
check('Sydney', country(-33.8688, 151.2093), 'Australia')
check('São Paulo', country(-23.5505, -46.6333), 'Brazil')

// ── Microstates: present at 1:50m, absent at 1:110m ────────────────────────
check('Monaco', country(43.7384, 7.4246), 'Monaco')
check('Luxembourg', country(49.6116, 6.1319), 'Luxembourg')
check('Malta', country(35.8989, 14.5146), 'Malta')
check('Singapore', country(1.3521, 103.8198), 'Singapore')

// ── An enclave is a hole in the surrounding country's ring ─────────────────
check('Maseru (in Lesotho, inside South Africa)', country(-29.3151, 27.4869), 'Lesotho')

// ── Both sides of one shared border arc ────────────────────────────────────
check('Strasbourg (French bank)', country(48.5734, 7.7521), 'France')
check('Kehl (German bank)', country(48.5716, 7.8155), 'Germany')

// ── Open sea answers null, and says so by falling back to the world ────────
const atlantic = at(30, -40)
check('mid-Atlantic country', atlantic.country, null)
check('mid-Atlantic falls back to the world', atlantic.isWorld, true)
check('mid-Atlantic still has an outline to draw', atlantic.rings.length > 0, true)

// ── Edges where the bbox prefilter is degenerate ───────────────────────────
check('Anadyr, east of the antimeridian', country(64.7337, 177.5087), 'Russia')
check('Nome, west of it', country(64.5011, -165.4064), 'United States of America')
check('North Pole', country(90, 0), null)
check('South Pole (Antarctica is excluded by design)', country(-90, 0), null)

// ── The near-shore margin: generous enough, and bounded ────────────────────
check('inland points are exact, not approximated', at(51.5074, -0.1278).approximate, false)
check('Manhattan is flagged approximate', at(40.7128, -74.006).approximate, true)
check('160 km west of Ireland is still nobody', country(53.3, -12.5), null)

// ── A match carries its country's outline, not the world's ─────────────────
const uk = at(51.5074, -0.1278)
check('a match is not the world fallback', uk.isWorld, false)
check('a match brings rings to draw', uk.rings.length > 0, true)
const [w, s, e, n] = uk.bounds
check('UK bounds hold London', w < -0.1278 && e > -0.1278 && s < 51.5074 && n > 51.5074, true)
check('UK bounds are the UK, not the globe', e - w < 40 && n - s < 40, true)

// ── Framing: what the map is handed to draw ─────────────────────────────────
const inView = (loc, lat, lon) =>
  loc.view[0] <= lon && loc.view[2] >= lon && loc.view[1] <= lat && loc.view[3] >= lat

check('the view holds the point it is drawn for', inView(uk, 51.5074, -0.1278), true)
check('the view leaves margin around the country', uk.view[3] - uk.view[1] > n - s, true)
check('the UK gets its neighbours for context', uk.context.length > 0, true)

// Monaco is the case the minimum span exists for: two kilometres across, so
// its own bounds would frame a blob nobody could place. It must come back with
// room around it and with the French coast beside it, or the map says nothing.
const monaco = at(43.7384, 7.4246)
check('Monaco is widened to the minimum span', monaco.view[3] - monaco.view[1] >= 5, true)
check('Monaco is given France for context', monaco.context.length > 0, true)

// The world fallback already shows everything; a context layer on top of it
// would just draw every ring in the file twice.
check('the world fallback adds no context layer', atlantic.context.length, 0)

// ── Framing follows the landmass, not everything the country owns ──────────
//
// This is the case that makes or breaks the picture. The United States owns
// Alaska and Guam and France owns Réunion, so a view framed on a country's
// full extent is a map of the world with a speck on it. Each of these must
// frame the landmass under the point instead.
const span = (loc) => Math.max(loc.bounds[2] - loc.bounds[0], loc.bounds[3] - loc.bounds[1])

const manhattan = at(40.7128, -74.006)
check('Manhattan frames the contiguous US, not Alaska too', span(manhattan) < 70, true)
check('  …and still names the country', manhattan.country, 'United States of America')

const anchorage = at(61.2181, -149.9003)
check('Anchorage frames Alaska', anchorage.bounds[0] < -140 && anchorage.bounds[2] < -125, true)

const paris = at(48.8566, 2.3522)
check('Paris frames mainland France, not Réunion', span(paris) < 20, true)

const honolulu = at(21.3069, -157.8583)
check('Honolulu is in the US', honolulu.country, 'United States of America')
check('  …framed on Hawaii, a whole ocean from the mainland', span(honolulu) < 10, true)

// …but framing on the landmass must not zoom in so far that the result is an
// anonymous stretch of coast. The nearest land to Manhattan is Long Island,
// half a degree across; on its own it could be anywhere. Every view has to
// clear the floor that keeps something recognisable in the frame.
const viewSpan = (loc) => Math.max(loc.view[2] - loc.view[0], loc.view[3] - loc.view[1])
for (const [label, lat, lon] of [
  ['Manhattan (nearest land is Long Island)', 40.7128, -74.006],
  ['Monaco (two kilometres across)', 43.7384, 7.4246],
  ['Honolulu (one island in a chain)', 21.3069, -157.8583],
  ['Singapore', 1.3521, 103.8198],
]) {
  check(`${label} still gets a placeable view`, viewSpan(at(lat, lon)) >= 5, true)
}

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
