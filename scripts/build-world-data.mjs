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

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const topo = JSON.parse(
  readFileSync(resolve(root, 'node_modules/world-atlas/countries-50m.json'), 'utf8')
)

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

  const c = names.push(name) - 1

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
  polys,
}

const path = resolve(root, 'src/data/world.json')
writeFileSync(path, JSON.stringify(out))
console.log(
  `world.json: ${names.length} countries, ${polys.length} polygons, ` +
    `${(JSON.stringify(out).length / 1024).toFixed(0)} KB raw`
)
