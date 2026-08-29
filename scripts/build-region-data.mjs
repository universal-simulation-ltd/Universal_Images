// Generates `src/data/regions/*.json` — the county / state / province outlines
// the metadata panel zooms to once it knows which country a photo is from.
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
// Natural Earth is public domain. See `src/data/README.md`.

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
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

  const json = JSON.stringify({ transform: topo.transform, arcs: topo.arcs, names, polys })
  writeFileSync(resolve(outDir, `${country.toLowerCase()}.json`), json)
  written++
  totalBytes += json.length
}

console.log(`regions: ${written} countries, ${(totalBytes / 1024 / 1024).toFixed(2)} MB raw total`)
if (unmatched.length > 0) {
  // Expected leftovers are dependencies and disputed areas that the admin-0 set
  // does not carry as countries of their own. A familiar country appearing here
  // is a bug, not a curiosity.
  console.log(
    `\n${unmatched.length} admin-1 entries have no country in world.json ` +
      `and were skipped:\n  ${unmatched.join('\n  ')}`
  )
}
