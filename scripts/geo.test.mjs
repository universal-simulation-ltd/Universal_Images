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
//   · dropping the cross-border layer from `refineToRegion`'s context → 1 red,
//     Dover, whose map loses the French coast and draws sea instead
//   · `NEAR_REGION_KM = 0` → 1 red, the beach 2 km offshore
//
// ⚠️ Both region-layer controls were green the first time they were run, and
// the tests were wrong rather than the code. "France is drawn beside it" was a
// ring COUNT, which Kent's own neighbouring boroughs clear by themselves, so it
// could not tell the cross-border layer was gone; it counts geometry on the far
// side of the Channel now. And nothing exercised an offshore point at all. A
// negative control that does not go red is not a passing test — it is a test
// that was never testing.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { locateIn, refineToRegion } from '../src/lib/geo.ts'

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

// ── The region layer: county / state / province ────────────────────────────
//
// Loaded per country, so these read the same files the app would. `refineToRegion`
// is the seam for the same reason `locateIn` is — the shipping path reaches the
// data through a Vite `import.meta.glob` that Node cannot resolve.
const gbr = JSON.parse(readFileSync(resolve(root, 'src/data/regions/gbr.json'), 'utf8'))
const usa = JSON.parse(readFileSync(resolve(root, 'src/data/regions/usa.json'), 'utf8'))

const region = (regions, lat, lon) =>
  locateIn2(regions, lat, lon).region

function locateIn2(regions, lat, lon) {
  return refineToRegion(world, regions, at(lat, lon), lat, lon)
}

check('London is Westminster', region(gbr, 51.5074, -0.1278), 'Westminster')
check('Shrewsbury is Shropshire', region(gbr, 52.7069, -2.7527), 'Shropshire')
check('Edinburgh', region(gbr, 55.9533, -3.1883), 'Edinburgh')
check('Cardiff', region(gbr, 51.4816, -3.1791), 'Cardiff')
check('Manhattan is New York', region(usa, 40.7128, -74.006), 'New York')
check('Anchorage is Alaska', region(usa, 61.2181, -149.9003), 'Alaska')

// Crossing one county line should change the answer and nothing else — this is
// the region-layer twin of the shared-border check further up.
check('Camden, one borough north', region(gbr, 51.5423, -0.1435), 'Camden')
check('  …still the same country', locateIn2(gbr, 51.5423, -0.1435).country, 'United Kingdom')

// The country stays on the result: the caption reads "Westminster, United
// Kingdom", so losing either half breaks it.
const westminster = locateIn2(gbr, 51.5074, -0.1278)
check('a region keeps its country', westminster.country, 'United Kingdom')
check('a region reframes the map', westminster.view[3] - westminster.view[1] < 1, true)
check('a region brings its neighbours', westminster.context.length > 0, true)

// Context has to include the neighbouring COUNTRY as well as the neighbouring
// counties, or a county on a national border draws open sea where its
// neighbour should be. Kent looks across the Channel at France.
const kent = locateIn2(gbr, 51.1279, 1.3134)
check('Dover is in Kent', kent.region, 'Kent')
// Count context geometry on the FRENCH side of the Channel. A ring count alone
// does not discriminate — Kent's own neighbouring boroughs clear any plausible
// threshold on their own, so dropping the cross-border layer left the test
// green while the map drew open sea across the whole eastern half.
const acrossTheChannel = kent.context
  .flat()
  .filter(([lon]) => lon > 1.45).length
check('  …and France is drawn beside it, not sea', acrossTheChannel > 500, true)

// The near-region margin, which is the region-layer twin of NEAR_SHORE_KM: a
// photo from a beach or a pier is metres outside every county polygon.
check('a beach 2 km offshore is still its county',
  region(gbr, 50.8198 - 0.02, -0.1367), 'Brighton and Hove')
check('  …but 4 km out gives up rather than guessing',
  region(gbr, 50.8198 - 0.04, -0.1367), null)

// A point at sea never reaches the region layer, and must not be broken by it.
check('the ocean is still nobody', refineToRegion(world, gbr, atlantic, 30, -40).region, null)

// A country whose regions we do not carry keeps the country-level answer
// rather than losing the map. Monaco is one region, so it has no file at all.
const monacoBase = at(43.7384, 7.4246)
check('Monaco has no region file to load', monacoBase.region, null)
check('  …and still names the country', monacoBase.country, 'Monaco')

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
