// Generates `src/data/regions/*.json` — the county / state / province outlines
// the metadata panel zooms to once it knows which country a photo is from, and
// the towns and villages it names the nearest of.
//
// Both live in one file per country on purpose. They are always wanted
// together, and folding them in means naming somewhere costs no request beyond
// the one the county zoom already makes.
//
// Run: node scripts/build-region-data.mjs
//
// ── Why one file per country ───────────────────────────────────────────────
//
// Regions are cheap per country and ruinous worldwide. Natural Earth's admin-1
// set is 4,596 regions across 253 countries; bundled as one file that is over a
// megabyte gzipped, four to six times what the country boundaries
// (`world.json`) cost — paid by everybody who opens a geotagged photo, to
// answer a question about one country. The United Kingdom's 232 districts on
// their own are about 50 KB.
//
// So the split is the feature. `geo.ts` already identifies the country before
// anything is drawn, which means it can then fetch that country's regions and
// nothing else. A photo from Shropshire pulls Shropshire's neighbours, not
// Hokkaido's.
//
// ── The source ─────────────────────────────────────────────────────────────
//
// Natural Earth 1:10m admin-1, from the natural-earth-vector repository. 1:10m
// because it is the only admin-1 set with worldwide coverage — the 1:50m one
// has nine countries in it and no United Kingdom, no France, no Japan.
//
// The source is a 40 MB GeoJSON, which is not committed: too large to be worth
// versioning for a file that is downloaded once and never diffed. It is fetched
// on first run and cached beside the repo in `.cache/`. What IS committed is
// everything this writes, so a checkout builds and ships without the network.
//
// ⚠️ TWO sources, on two different licences.
//
// Boundaries are Natural Earth, which is public domain and asks for nothing.
// The places are GeoNames, which is **CC BY 4.0 and requires attribution** —
// that is a condition of shipping, not a courtesy, and the app carries it under
// the map. If the places are ever dropped, the credit goes with them; if
// another gazetteer is swapped in, check its licence before assuming the same.
//
// See `src/data/README.md`.

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import JSZip from 'jszip'
import { topology } from 'topojson-server'
import { presimplify, simplify } from 'topojson-simplify'
import { quantize } from 'topojson-client'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(root, 'src/data/regions')
const cache = resolve(root, '.cache/ne_10m_admin_1_states_provinces.geojson')
const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'

/**
 * Vertex-dropping tolerance, in square degrees. Deliberately gentle: it trims
 * about 8% and is invisible at the zoom these are drawn at. There is no point
 * being aggressive when the per-country files are tens of kilobytes anyway.
 */
const SIMPLIFY_WEIGHT = 1e-5

const placesCache = resolve(root, '.cache/cities500.zip')
// Populated places down to about 500 people, which is what makes the answer a
// village rather than the nearest city fifty miles away. 235,000 worldwide;
// per country that is a median of 1.4 KB gzipped and 254 KB at the very worst.
const PLACES_SOURCE = 'https://download.geonames.org/export/dump/cities500.zip'
const admin0Path = resolve(root, '.cache/ne_50m_admin_0_countries.geojson')

// Spelled out rather than written inline, because a shell heredoc collapsed
// '\n' to a real newline here once and the file would not parse.
const NEWLINE = '\n'
const TAB = '\t'


async function loadSource() {
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))
  console.log('fetching Natural Earth admin-1 (40 MB, once)…')
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`could not fetch admin-1 data (${res.status})`)
  const text = await res.text()
  mkdirSync(dirname(cache), { recursive: true })
  writeFileSync(cache, text)
  return JSON.parse(text)
}

const source = await loadSource()

/**
 * GeoNames' places, grouped by the ISO alpha-3 these files are keyed on.
 *
 * The dump keys on alpha-2, so the two are bridged through the same Natural
 * Earth admin-0 release everything else here is aligned to. `jszip` is already
 * a runtime dependency of the app, so reading the archive costs no new one.
 */
async function loadPlaces() {
  if (!existsSync(admin0Path)) {
    throw new Error('Missing .cache/ne_50m_admin_0_countries.geojson — see build-world-data.mjs')
  }
  if (!existsSync(placesCache)) {
    console.log('fetching GeoNames cities500 (13 MB, once)…')
    const res = await fetch(PLACES_SOURCE)
    if (!res.ok) throw new Error(`could not fetch places (${res.status})`)
    mkdirSync(dirname(placesCache), { recursive: true })
    writeFileSync(placesCache, Buffer.from(await res.arrayBuffer()))
  }
  const zip = await JSZip.loadAsync(readFileSync(placesCache))
  const text = await zip.file('cities500.txt').async('string')
  const admin0 = JSON.parse(readFileSync(admin0Path, 'utf8'))

  // ⚠️ `ISO_A2_EH`, not `ISO_A2`. Natural Earth carries `-99` in the plain
  // field for a handful of countries — France and Norway among them — so
  // keying on it silently gave FRANCE no places at all while every neighbour
  // worked. The `_EH` variant is the corrected one, and is absent only for
  // genuinely code-less disputed areas (Somaliland, Northern Cyprus, Kashmir).
  //
  // ⚠️ And several features can claim the same alpha-2, where a plain Map keeps
  // the LAST — which handed every Australian place to Ashmore and Cartier
  // Islands and left Australia itself empty. A dependency never displaces a
  // sovereign country that claims the same code.
  const alpha3 = new Map()
  for (const f of admin0.features) {
    const a2 = f.properties.ISO_A2_EH
    if (!a2 || a2 === '-99') continue
    if (alpha3.has(a2) && f.properties.TYPE === 'Dependency') continue
    alpha3.set(a2, f.properties.ADM0_A3)
  }

  const byCode = new Map()
  for (const line of text.split(NEWLINE)) {
    if (!line) continue
    // name, latitude, longitude and country are columns 1, 4, 5 and 8.
    const f = line.split(TAB)
    const code = alpha3.get(f[8])
    const lat = Number(f[4])
    const lon = Number(f[5])
    if (!code || !f[1] || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code).push({ name: f[1], lat, lon })
  }
  return byCode
}

const placesByCode = await loadPlaces()

// Files are named after the country's ISO alpha-3 code, never its name.
//
// The two Natural Earth layers disagree about names in ways that are both
// common and dangerous: admin-0 says "Serbia", "Tanzania", "Bahamas" where
// admin-1 says "Republic of Serbia", "United Republic of Tanzania", "The
// Bahamas". Keying on names dropped the regions of 61 countries — and the near
// misses are worse than the misses, since "Congo" and "Dem. Rep. Congo" are
// different places. The codes are carried in `world.json` by
// `build-world-data.mjs`, from this same admin-0 release.
const world = JSON.parse(readFileSync(resolve(root, 'src/data/world.json'), 'utf8'))
const known = new Set(world.codes)

const byCountry = new Map()
for (const feature of source.features) {
  const country = feature.properties.adm0_a3
  const name = feature.properties.name ?? feature.properties.name_en
  if (!country || !name) continue
  if (!byCountry.has(country)) byCountry.set(country, [])
  byCountry.get(country).push({
    type: 'Feature',
    properties: { name },
    geometry: feature.geometry,
  })
}

// Start clean, so a country dropped upstream does not leave a stale file behind
// that the runtime would happily keep serving.
if (existsSync(outDir)) {
  for (const file of readdirSync(outDir)) {
    if (file.endsWith('.json')) rmSync(resolve(outDir, file))
  }
}
mkdirSync(outDir, { recursive: true })

const unmatched = []
let written = 0
let totalBytes = 0
let totalPlaces = 0
const placeless = []

for (const [country, features] of [...byCountry].sort()) {
  if (!known.has(country)) {
    unmatched.push(`${country} (${features.length})`)
    continue
  }
  // One region is not worth a file: it is the country outline again, at a
  // resolution the map already has, and the caption would just repeat itself.
  if (features.length < 2) continue

  let topo = topology({ r: { type: 'FeatureCollection', features } })
  topo = simplify(presimplify(topo), SIMPLIFY_WEIGHT)
  // Quantised against this country's own extent rather than the globe's, which
  // is most of why splitting the file buys precision as well as bytes.
  topo = quantize(topo, 1e5)

  const arcPoints = topo.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x, y]
    })
  })

  const names = []
  const polys = []
  for (const geometry of topo.objects.r.geometries) {
    const name = geometry.properties?.name
    if (!name) continue
    const rings =
      geometry.type === 'Polygon' ? [geometry.arcs]
      : geometry.type === 'MultiPolygon' ? geometry.arcs
      : null
    if (!rings) continue

    const c = names.push(name) - 1
    for (const ringSet of rings) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const index of ringSet[0]) {
        for (const [x, y] of arcPoints[index < 0 ? ~index : index]) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
      polys.push({ c, b: [minX, minY, maxX, maxY], r: ringSet })
    }
  }

  // Places ride on the same quantised grid as the boundaries, so they cost
  // integers rather than decimal strings and need no second transform.
  const { scale, translate } = topo.transform
  const places = (placesByCode.get(country) ?? []).map((place) => [
    place.name,
    Math.round((place.lon - translate[0]) / scale[0]),
    Math.round((place.lat - translate[1]) / scale[1]),
  ])

  const json = JSON.stringify({
    transform: topo.transform,
    arcs: topo.arcs,
    names,
    polys,
    places,
  })
  writeFileSync(resolve(outDir, `${country.toLowerCase()}.json`), json)
  written++
  totalBytes += json.length
  totalPlaces += places.length
  if (places.length === 0) placeless.push(country)
}

console.log(
  `regions: ${written} countries, ${totalPlaces.toLocaleString()} places, ` +
    `${(totalBytes / 1024 / 1024).toFixed(2)} MB raw total`
)

// A country with counties but no towns is almost always a code that failed to
// bridge, not a country with no towns — that is how France shipped empty once.
// Say so loudly rather than leaving it to be noticed in the UI.
if (placeless.length > 0) {
  console.log(
    `WARNING: ${placeless.length} countries have regions but NO places. Expect ` +
      `only genuinely tiny or code-less territories; a familiar country is a bug: ` +
      placeless.join(', ')
  )
}
if (unmatched.length > 0) {
  // Expected leftovers are dependencies and disputed areas that the admin-0 set
  // does not carry as countries of their own. A familiar country appearing here
  // is a bug, not a curiosity.
  console.log(
    `\n${unmatched.length} admin-1 entries have no country in world.json ` +
      `and were skipped:\n  ${unmatched.join('\n  ')}`
  )
}
