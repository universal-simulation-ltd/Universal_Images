// Turning a photo's coordinates into somewhere a human recognises — without
// telling anybody where the photo was taken.
//
// The rest of this app never uploads an image, and the metadata panel has
// always refused to link GPS coordinates to a map, because looking a location
// up hands that location to somebody else's server. That reasoning doesn't
// change just because a map is nicer to look at than two decimal numbers: a
// reverse-geocode request, or a single map tile, would leak the exact thing
// the panel exists to warn you about, along with your IP.
//
// So the boundaries ship with the app. `src/data/world.json` is Natural Earth's
// 1:50m country set (see `scripts/build-world-data.mjs`), and everything below
// — naming the country, drawing the outline — is arithmetic on those bytes in
// this tab. It is loaded lazily, on the first geotagged photo somebody opens,
// so a visitor who never opens one never pays for it.
//
// What this deliberately cannot do is give a street address. That needs a
// gazetteer nobody can bundle, i.e. somebody else's server. Country and a dot
// on the outline is the honest limit of what can be answered offline, and it
// is enough to make the point that the coordinates are real.

/** A point on the ring, in degrees. */
export type LonLat = [number, number]

export interface LocatedPoint {
  /** Country the point falls inside, or null (at sea, or off the boundary set). */
  country: string | null
  /** Closed rings of the matched country, in degrees. Outer rings and holes both. */
  rings: LonLat[][]
  /**
   * Land belonging to *other* countries that falls inside `view`. Drawn muted,
   * behind `rings`. Without it a small country is an unrecognisable blob in an
   * empty box; with it, it reads as a map.
   */
  context: LonLat[][]
  /**
   * [west, south, east, north] of the single landmass the point is on, in
   * degrees — not of the whole country.
   *
   * The difference is the whole of the framing. France owns French Guiana and
   * Réunion, the United States owns Alaska and Guam: framed to everything a
   * country holds, a photo taken in Manhattan draws a map of the world with a
   * speck on it. Framed to the landmass the point is actually on, it draws the
   * contiguous United States.
   */
  bounds: [number, number, number, number]
  /**
   * [west, south, east, north] the map should actually show: `bounds` with
   * room around it, widened for countries too small to fill a frame.
   */
  view: [number, number, number, number]
  /** True when `rings` is the whole world because no country matched. */
  isWorld: boolean
  /**
   * True when the point fell just outside every border and was attributed to
   * the nearest one. See `NEAR_SHORE_KM`.
   */
  approximate: boolean
  /**
   * How far outside `country` the point actually fell, in kilometres, when
   * `approximate`. Zero otherwise.
   *
   * Worth keeping apart from the flag, because the two cases behind it are
   * different: a few hundred metres means the border is drawn coarsely and the
   * point is really in that country, while ten kilometres means the photo was
   * genuinely taken off the coast. Only the caller can word that.
   */
  offshoreKm: number
}

/**
 * How far outside a border a point may fall and still be attributed to it.
 *
 * At 1:50m a coastline is drawn to within a few kilometres, and anything
 * narrower than that is not drawn at all — Manhattan is open water in this
 * data, and Monaco is a sliver its own town centre sits outside of. Answering
 * "nowhere" for a photo taken in Manhattan would be a worse failure than the
 * plain coordinates this panel replaced, so a point that misses every border
 * is attributed to the nearest one within this margin.
 *
 * The number is a compromise: comfortably more than the simplification error
 * at this scale, comfortably less than the distance to the next country across
 * any strait a photo is likely to be taken in. Genuinely open sea is hundreds
 * of kilometres from anywhere and still answers null.
 */
const NEAR_SHORE_KM = 25

/** Share of the country's own size left as margin around it. */
const VIEW_PADDING = 0.35

/**
 * Smallest span the map will show, in degrees of latitude — roughly 550 km.
 *
 * The floor exists because framing tightly on a small landmass produces a
 * picture of nowhere. Monaco is two kilometres across; the nearest land to a
 * photo taken in Manhattan is Long Island. Framed to their own bounds, both
 * draw an anonymous stretch of coast at a zoom the boundary data cannot honour
 * anyway. At this span they draw the Riviera and the northeastern United
 * States, which a person can place — and a country too small to see at that
 * scale is better served by the caption saying so than by a lie about
 * precision.
 */
const MIN_VIEW_SPAN_DEGREES = 5

/**
 * The generated boundary set. Exported so `scripts/geo.test.mjs` can hand a
 * real one to `locateIn` — Node's type-stripping can't resolve Vite's `?raw`
 * import, so the test loads `world.json` itself and skips `loadWorld`.
 */
export interface World {
  transform: { scale: [number, number]; translate: [number, number] }
  arcs: [number, number][][]
  names: string[]
  polys: { c: number; b: [number, number, number, number]; r: number[][] }[]
}

let worldPromise: Promise<World> | null = null

function loadWorld(): Promise<World> {
  // `?raw` rather than a JSON import on purpose. It keeps TypeScript from
  // inferring a type for three-quarters of a megabyte of nested arrays (which
  // it will happily try to do, very slowly), and parsing one string beats
  // evaluating an equivalent object literal at runtime.
  worldPromise ??= import('../data/world.json?raw').then(
    (m) => JSON.parse(m.default) as World
  )
  return worldPromise
}

/**
 * Arcs are shared between neighbouring countries — France's eastern border is
 * Germany's western one — and stored as deltas, so decoding is worth caching
 * for as long as the world is in memory.
 */
const arcCache = new WeakMap<World, Map<number, [number, number][]>>()

function absoluteArc(world: World, index: number): [number, number][] {
  let cache = arcCache.get(world)
  if (!cache) {
    cache = new Map()
    arcCache.set(world, cache)
  }
  const hit = cache.get(index)
  if (hit) return hit

  let x = 0
  let y = 0
  const points = world.arcs[index].map(([dx, dy]) => {
    x += dx
    y += dy
    return [x, y] as [number, number]
  })
  cache.set(index, points)
  return points
}

/**
 * Stitches a ring's arcs into one closed loop of quantised points. A negative
 * index means "this arc, walked backwards" (that's how a shared border serves
 * both of its countries), and consecutive arcs repeat the point they meet at.
 */
function ringOf(world: World, arcIndexes: number[]): [number, number][] {
  const out: [number, number][] = []
  for (const index of arcIndexes) {
    const reversed = index < 0
    const points = absoluteArc(world, reversed ? ~index : index)
    const ordered = reversed ? [...points].reverse() : points
    for (let i = out.length > 0 ? 1 : 0; i < ordered.length; i++) out.push(ordered[i])
  }
  return out
}

/**
 * Ray casting: count the ring edges crossed by a ray heading east from the
 * point. Odd means inside. Run on the quantised integers rather than degrees,
 * which sidesteps any float wobble at a border.
 */
function contains(ring: [number, number][], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Close enough for distances of a few tens of kilometres. */
const KM_PER_DEGREE = 111.32

/**
 * Shortest distance in kilometres from a point to a ring's edges, on a flat
 * frame centred on the point itself. Over `NEAR_SHORE_KM` that frame is
 * indistinguishable from the sphere, and it keeps the inner loop to
 * arithmetic. `ceiling` lets a ring bail as soon as it cannot win.
 */
function ringDistanceKm(
  world: World,
  ring: [number, number][],
  latitude: number,
  longitude: number,
  ceiling: number
): number {
  const { scale, translate } = world.transform
  const lonScale = Math.cos((latitude * Math.PI) / 180)
  // Degrees of longitude either side of the point that could still be within
  // the ceiling — anything beyond is skipped without a square root.
  const spanLon = ceiling / KM_PER_DEGREE / Math.max(0.02, lonScale)
  const spanLat = ceiling / KM_PER_DEGREE

  // Ring coordinates are quantised, so project them the cheap way inline
  // rather than materialising a degrees copy of every ring considered.
  const px = (p: [number, number]) => {
    let dLon = p[0] * scale[0] + translate[0] - longitude
    // The seam: a point at 179.9°E is a hair from one at 179.9°W, not 360° away.
    if (dLon > 180) dLon -= 360
    else if (dLon < -180) dLon += 360
    return dLon * lonScale * KM_PER_DEGREE
  }
  const py = (p: [number, number]) => (p[1] * scale[1] + translate[1] - latitude) * KM_PER_DEGREE

  let best = ceiling
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    // Reject the whole segment on the raw degree span first.
    const lonI = ring[i][0] * scale[0] + translate[0]
    const latI = ring[i][1] * scale[1] + translate[1]
    const lonJ = ring[j][0] * scale[0] + translate[0]
    const latJ = ring[j][1] * scale[1] + translate[1]
    if (Math.min(latI, latJ) - latitude > spanLat) continue
    if (latitude - Math.max(latI, latJ) > spanLat) continue
    if (Math.min(lonI, lonJ) - longitude > spanLon && Math.abs(lonI - longitude) < 180) continue
    if (longitude - Math.max(lonI, lonJ) > spanLon && Math.abs(lonI - longitude) < 180) continue

    const ax = px(ring[i]), ay = py(ring[i])
    const bx = px(ring[j]), by = py(ring[j])
    const vx = bx - ax, vy = by - ay
    const lengthSq = vx * vx + vy * vy
    // Clamp to the segment: t outside [0,1] means the nearest point is an end.
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * vx + ay * vy) / lengthSq))
    const dx = ax + t * vx
    const dy = ay + t * vy
    const km = Math.sqrt(dx * dx + dy * dy)
    if (km < best) best = km
  }
  return best
}

function toDegrees(world: World, ring: [number, number][]): LonLat[] {
  const { scale, translate } = world.transform
  return ring.map(([x, y]) => [x * scale[0] + translate[0], y * scale[1] + translate[1]])
}

function boundsOf(rings: LonLat[][]): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < w) w = lon
      if (lon > e) e = lon
      if (lat < s) s = lat
      if (lat > n) n = lat
    }
  }
  return [w, s, e, n]
}

/**
 * Names the country a coordinate falls in and returns that country's outline
 * to draw it on. Falls back to the whole world when nothing matches, so a
 * point at sea still gets a picture rather than an empty box.
 *
 * Entirely offline: no request is made, here or anywhere it is called from.
 */
export async function locatePoint(latitude: number, longitude: number): Promise<LocatedPoint> {
  return locateIn(await loadWorld(), latitude, longitude)
}

/** `locatePoint` with the world supplied — the seam the tests use. */
export function locateIn(world: World, latitude: number, longitude: number): LocatedPoint {
  const { scale, translate } = world.transform
  const x = (longitude - translate[0]) / scale[0]
  const y = (latitude - translate[1]) / scale[1]

  let match: number | null = null
  /** The single polygon the point landed in or nearest to — what to frame on. */
  let matched: World['polys'][number] | null = null
  let approximate = false
  let offshoreKm = 0

  // Pass one: which border actually encloses the point.
  for (const poly of world.polys) {
    // The bbox check is why this stays instant: it rejects all but a handful
    // of the world's 1,500-odd polygons before any ring is decoded.
    const [minX, minY, maxX, maxY] = poly.b
    if (x < minX || x > maxX || y < minY || y > maxY) continue

    const [outer, ...holes] = poly.r
    if (!contains(ringOf(world, outer), x, y)) continue
    // A hole is a lake or an enclave — inside the outline, outside the country.
    if (holes.some((hole) => contains(ringOf(world, hole), x, y))) continue

    match = poly.c
    matched = poly
    break
  }

  // Pass two, only when pass one found nothing: the nearest border within
  // `NEAR_SHORE_KM`. This is what rescues the harbours, islands and
  // microstates that 1:50m draws as water — and it runs over the handful of
  // polygons whose bbox is within the margin, not over the world.
  if (match === null) {
    const marginY = NEAR_SHORE_KM / KM_PER_DEGREE / scale[1]
    const marginX = marginY * (scale[1] / scale[0]) / Math.max(0.02, Math.cos((latitude * Math.PI) / 180))
    let best = NEAR_SHORE_KM

    for (const poly of world.polys) {
      const [minX, minY, maxX, maxY] = poly.b
      if (x < minX - marginX || x > maxX + marginX) continue
      if (y < minY - marginY || y > maxY + marginY) continue

      for (const arcIndexes of poly.r) {
        const km = ringDistanceKm(world, ringOf(world, arcIndexes), latitude, longitude, best)
        if (km < best) {
          best = km
          match = poly.c
          matched = poly
        }
      }
    }
    approximate = match !== null
    offshoreKm = approximate ? best : 0
  }

  const wanted =
    match === null ? world.polys : world.polys.filter((poly) => poly.c === match)
  const rings = wanted.flatMap((poly) =>
    poly.r.map((arcIndexes) => toDegrees(world, ringOf(world, arcIndexes)))
  )

  const bounds = matched ? degreeBox(world, matched.b) : boundsOf(rings)
  const view = match === null ? bounds : viewFor(bounds)

  // Neighbours are only worth decoding when there is a country to put in
  // context; the world fallback is already showing everything.
  const context =
    match === null
      ? []
      : world.polys
          .filter((poly) => poly.c !== match && intersects(degreeBox(world, poly.b), view))
          .flatMap((poly) =>
            poly.r.map((arcIndexes) => toDegrees(world, ringOf(world, arcIndexes)))
          )

  return {
    country: match === null ? null : world.names[match],
    rings,
    context,
    bounds,
    view,
    isWorld: match === null,
    approximate,
    offshoreKm,
  }
}

/** `bounds` with margin added, and widened if the country is very small. */
function viewFor(bounds: [number, number, number, number]): [number, number, number, number] {
  const [w, s, e, n] = bounds
  const midLon = (w + e) / 2
  const midLat = (s + n) / 2

  // Compare spans in the same units. A degree of longitude is a degree of
  // latitude shrunk by the cosine of where you are, so a country is "as tall
  // as it is wide" only after that correction.
  const lonScale = Math.max(0.02, Math.cos((midLat * Math.PI) / 180))
  const halfLat = Math.max(((n - s) / 2) * (1 + VIEW_PADDING), MIN_VIEW_SPAN_DEGREES / 2)
  const halfLon = Math.max(
    ((e - w) / 2) * (1 + VIEW_PADDING),
    MIN_VIEW_SPAN_DEGREES / 2 / lonScale
  )

  return [midLon - halfLon, midLat - halfLat, midLon + halfLon, midLat + halfLat]
}

function degreeBox(
  world: World,
  box: [number, number, number, number]
): [number, number, number, number] {
  const { scale, translate } = world.transform
  return [
    box[0] * scale[0] + translate[0],
    box[1] * scale[1] + translate[1],
    box[2] * scale[0] + translate[0],
    box[3] * scale[1] + translate[1],
  ]
}

function intersects(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}
