// Generates `src/data/world.json` — the offline country boundaries the metadata
// panel uses to name a photo's country and draw its locator map.
//
// Run: node scripts/build-world-data.mjs
//
// Source is Natural Earth's 1:50m admin-0 set, as packaged by `world-atlas`
// (a devDependency — nothing here ships in the runtime bundle except the JSON
// this writes). 1:50m rather than the smaller 1:110m because 1:110m drops the
// microstates entirely: telling somebody their photo was taken in France when
// it was taken in Monaco is exactly the kind of wrong this panel can't be.
//
// The output is TopoJSON's quantised, delta-encoded arcs kept as-is (that
// encoding is why the whole world fits in a couple of hundred KB), flattened
// to one entry per polygon with a precomputed bounding box. The bbox is the
// point of the build step: a point-in-polygon test over every ring on earth is
// wasteful when a cheap integer bbox check rejects almost all of them first.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const topo = JSON.parse(
  readFileSync(resolve(root, 'node_modules/world-atlas/countries-50m.json'), 'utf8')
)

// Each country also gets its ISO alpha-3 code, which is what
// `src/data/regions/*.json` are named after and what the runtime looks one up
// by. Names are NOT usable as a key across the two Natural Earth layers: the
// admin-0 set this is built from says "Serbia", "Tanzania", "Bahamas" while the
// admin-1 set says "Republic of Serbia", "United Republic of Tanzania", "The
// Bahamas". Matching on those silently dropped 61 countries' regions, and the
// near misses are the dangerous kind — "Congo" and "Dem. Rep. Congo" are
// different countries.
//
// The codes come from the same Natural Earth admin-0 release `world-atlas` is
// built from, so `NAME` lines up exactly. See `scripts/build-region-data.mjs`
// for the download; it is cached, and this build needs it present.
const admin0Path = resolve(root, '.cache/ne_50m_admin_0_countries.geojson')
if (!existsSync(admin0Path)) {
  throw new Error(
    'Missing .cache/ne_50m_admin_0_countries.geojson — run ' +
      '`node scripts/build-region-data.mjs` first, which downloads and caches it.'
  )
}
const codeByName = new Map(
  JSON.parse(readFileSync(admin0Path, 'utf8')).features.map((f) => [
    f.properties.NAME,
    f.properties.ADM0_A3,
  ])
)
// `world-atlas` 2.0.2 predates the 2019 rename, so its name for MKD is the old
// one. Anything else that fails to resolve is a hard error rather than a
// country quietly losing its regions.
codeByName.set('Macedonia', 'MKD')

const { transform, arcs } = topo
const geometries = topo.objects.countries.geometries

// Absolute quantised positions for one arc, so a bbox can be taken without
// re-walking the deltas. The runtime does the same decode lazily, per country.
const arcPoints = arcs.map((arc) => {
  let x = 0
  let y = 0
  return arc.map(([dx, dy]) => {
    x += dx
    y += dy
    return [x, y]
  })
})

const names = []
const codes = []
const polys = []

for (const geom of geometries) {
  const name = geom.properties?.name
  if (!name) continue
  // Antarctica has no residents to identify and its ring is a sizeable share
  // of the file; a geotagged photo from there falls back to the world view
  // like any other unmatched point.
  if (name === 'Antarctica') continue

  const rings =
    geom.type === 'Polygon' ? [geom.arcs]
    : geom.type === 'MultiPolygon' ? geom.arcs
    : null
  if (!rings) continue

  const code = codeByName.get(name)
  if (!code) throw new Error(`no ISO alpha-3 code for "${name}" — add an alias above`)
  const c = names.push(name) - 1
  codes.push(code)

  // One entry per polygon, not per country: Russia and the US straddle the
  // antimeridian, so a single country-wide bbox would span the globe and
  // prefilter nothing.
  for (const ringSet of rings) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const idx of ringSet[0]) {
      for (const [x, y] of arcPoints[idx < 0 ? ~idx : idx]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    polys.push({ c, b: [minX, minY, maxX, maxY], r: ringSet })
  }
}

const out = {
  source: 'Natural Earth 1:50m admin-0 (public domain), via world-atlas (ISC)',
  transform,
  arcs,
  names,
  /** ISO alpha-3 per country, parallel to `names`. Keys the region files. */
  codes,
  polys,
}

const path = resolve(root, 'src/data/world.json')
writeFileSync(path, JSON.stringify(out))
console.log(
  `world.json: ${names.length} countries, ${polys.length} polygons, ` +
    `${(JSON.stringify(out).length / 1024).toFixed(0)} KB raw`
)
