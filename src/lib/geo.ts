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
  /**
   * County, state or province, when that country's region set is available and
   * loaded. Null otherwise — the country map is still drawn.
   */
  region: string | null
  /**
   * Nearest named town or village, and how far the point is from its centre.
   *
   * A nearest-place answer, not a containing one: `km` is what stops "Wem"
   * being printed over a photo taken eight kilometres outside it. Comes from
   * the same file as the regions, so it costs no request of its own.
   */
  place: { name: string; km: number } | null
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
 * The same near-border allowance as `NEAR_SHORE_KM`, but for regions — much
 * tighter, because the region boundaries are drawn at 1:10m where the country
 * ones are 1:50m. A point more than a couple of kilometres outside every county
 * of a country it is definitely in means something is wrong, not that the
 * coastline is coarse.
 */
const NEAR_REGION_KM = 3

/**
 * Smallest span the region map will show, in degrees of latitude — roughly
 * 50 km. Small enough to be a county map, large enough that a city district
 * still shows the city around it.
 */
const MIN_REGION_VIEW_SPAN_DEGREES = 0.45

/**
 * One generated boundary set. `world.json` is the countries; each
 * `regions/<iso3>.json` is one country's counties, states or provinces, in the
 * identical shape — so every helper below serves both layers.
 *
 * Exported so `scripts/geo.test.mjs` can hand real ones in: Node's
 * type-stripping can't resolve Vite's `?raw` import, so the tests load the JSON
 * themselves and skip the loaders.
 */
export interface Boundaries {
  transform: { scale: [number, number]; translate: [number, number] }
  arcs: [number, number][][]
  names: string[]
  polys: { c: number; b: [number, number, number, number]; r: number[][] }[]
  /**
   * Populated places as `[name, x, y]`, quantised onto the same grid as the
   * boundaries above. Only the per-country region files carry these.
   */
  places?: [string, number, number][]
}

/** The countries, plus the ISO alpha-3 that names each one's region file. */
export interface World extends Boundaries {
  codes: string[]
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
const arcCache = new WeakMap<Boundaries, Map<number, [number, number][]>>()

function absoluteArc(world: Boundaries, index: number): [number, number][] {
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
function ringOf(world: Boundaries, arcIndexes: number[]): [number, number][] {
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
  world: Boundaries,
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

function toDegrees(world: Boundaries, ring: [number, number][]): LonLat[] {
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

let regionFiles: Record<string, () => Promise<string>> | null = null

/**
 * Every country's region file, as lazy loaders keyed by path. Vite turns each
 * into its own chunk at build time, so naming one here does not pull in the
 * other two hundred.
 *
 * ⚠️ Resolved on first use rather than at module scope, and that is load-
 * bearing: `import.meta.glob` is a Vite transform with no meaning to anything
 * else, so evaluating it at the top level would make this module unimportable
 * in plain Node — which is exactly how `scripts/geo.test.mjs` runs. Inside a
 * function it is still rewritten at build time and simply never reached by the
 * tests, which supply their boundary sets directly.
 */
function regionLoaders(): Record<string, () => Promise<string>> {
  regionFiles ??= import.meta.glob('../data/regions/*.json', {
    query: '?raw',
    import: 'default',
  }) as Record<string, () => Promise<string>>
  return regionFiles
}

const regionCache = new Map<string, Promise<Boundaries | null>>()

/**
 * Loads one country's regions, by ISO alpha-3.
 *
 * ⚠️ This is the one part of the panel that makes a request. It is to this
 * app's own origin, for a static asset, and it says only which country — never
 * the coordinates, which never leave the tab. But it is a request, and a server
 * log could infer the country from it, so it is worth knowing that the
 * country-level map above is drawn before this is ever called and does not
 * depend on it. See PRIVACY.md.
 */
function loadRegions(code: string): Promise<Boundaries | null> {
  const path = `../data/regions/${code.toLowerCase()}.json`
  const load = regionLoaders()[path]
  // Perfectly normal: 29 countries have no admin-1 subdivisions worth the file.
  if (!load) return Promise.resolve(null)

  if (!regionCache.has(code)) {
    regionCache.set(
      code,
      load()
        .then((raw) => JSON.parse(raw) as Boundaries)
        // Offline on a first visit, or the chunk 404s after a redeploy. The
        // country map is already drawn; losing the zoom is not worth an error.
        .catch(() => null)
    )
  }
  return regionCache.get(code)!
}

/**
 * Names where a coordinate is and returns the outline to draw it on: the
 * county, state or province when that country's regions are available, and the
 * country itself otherwise. Falls back to the whole world when nothing matches,
 * so a point at sea still gets a picture rather than an empty box.
 *
 * The coordinates themselves are never sent anywhere — every answer here is
 * computed in this tab. See `loadRegions` for the one request involved.
 */
export async function locatePoint(latitude: number, longitude: number): Promise<LocatedPoint> {
  const world = await loadWorld()
  const base = locateIn(world, latitude, longitude)
  if (base.country === null) return base

  const code = world.codes[world.names.indexOf(base.country)]
  const regions = code ? await loadRegions(code) : null
  return regions ? refineToRegion(world, regions, base, latitude, longitude) : base
}

/**
 * Which polygon of a boundary set a point falls in — or, failing that, the
 * nearest one within `nearKm`.
 *
 * Shared by both layers, because the question is identical whether the
 * polygons are countries or counties.
 */
function findPolygon(
  boundaries: Boundaries,
  latitude: number,
  longitude: number,
  nearKm: number
): { index: number; poly: Boundaries['polys'][number]; offshoreKm: number } | null {
  const { scale, translate } = boundaries.transform
  const x = (longitude - translate[0]) / scale[0]
  const y = (latitude - translate[1]) / scale[1]

  // Pass one: which border actually encloses the point.
  for (const poly of boundaries.polys) {
    // The bbox check is why this stays instant: it rejects all but a handful
    // of the polygons before any ring is decoded.
    const [minX, minY, maxX, maxY] = poly.b
    if (x < minX || x > maxX || y < minY || y > maxY) continue

    const [outer, ...holes] = poly.r
    if (!contains(ringOf(boundaries, outer), x, y)) continue
    // A hole is a lake or an enclave — inside the outline, outside the place.
    if (holes.some((hole) => contains(ringOf(boundaries, hole), x, y))) continue

    return { index: poly.c, poly, offshoreKm: 0 }
  }

  // Pass two: the nearest border within the margin. This is what rescues the
  // harbours, islands and microstates that a simplified coastline draws as
  // water — and it runs over the handful of polygons whose bbox is within the
  // margin, not over the whole set.
  const marginY = nearKm / KM_PER_DEGREE / scale[1]
  const marginX =
    (marginY * scale[1]) / scale[0] / Math.max(0.02, Math.cos((latitude * Math.PI) / 180))
  let best = nearKm
  let winner: { index: number; poly: Boundaries['polys'][number]; offshoreKm: number } | null = null

  for (const poly of boundaries.polys) {
    const [minX, minY, maxX, maxY] = poly.b
    if (x < minX - marginX || x > maxX + marginX) continue
    if (y < minY - marginY || y > maxY + marginY) continue

    for (const arcIndexes of poly.r) {
      const km = ringDistanceKm(
        boundaries,
        ringOf(boundaries, arcIndexes),
        latitude,
        longitude,
        best
      )
      if (km < best) {
        best = km
        winner = { index: poly.c, poly, offshoreKm: km }
      }
    }
  }
  return winner
}

/**
 * The nearest populated place to a point, with its distance in kilometres.
 *
 * A flat scan: the largest country carries about 22,000 places, which is a few
 * hundredths of a second of arithmetic and not worth an index. Squared
 * distances are compared so only the winner needs a square root.
 */
function nearestPlace(
  boundaries: Boundaries,
  latitude: number,
  longitude: number
): { name: string; km: number } | null {
  const places = boundaries.places
  if (!places || places.length === 0) return null

  const { scale, translate } = boundaries.transform
  const lonScale = Math.max(0.02, Math.cos((latitude * Math.PI) / 180))

  let bestName: string | null = null
  let bestSq = Infinity
  for (const [name, x, y] of places) {
    const dLat = y * scale[1] + translate[1] - latitude
    const dLon = (x * scale[0] + translate[0] - longitude) * lonScale
    const sq = dLat * dLat + dLon * dLon
    if (sq < bestSq) {
      bestSq = sq
      bestName = name
    }
  }
  return bestName === null ? null : { name: bestName, km: Math.sqrt(bestSq) * KM_PER_DEGREE }
}

/** Every ring of every polygon belonging to one entry of a boundary set. */
function ringsOf(boundaries: Boundaries, index: number): LonLat[][] {
  return boundaries.polys
    .filter((poly) => poly.c === index)
    .flatMap((poly) => poly.r.map((arcs) => toDegrees(boundaries, ringOf(boundaries, arcs))))
}

/** Rings of everything in a boundary set that is not `index` and is in view. */
function contextRings(
  boundaries: Boundaries,
  index: number | null,
  view: [number, number, number, number]
): LonLat[][] {
  return boundaries.polys
    .filter((poly) => poly.c !== index && intersects(degreeBox(boundaries, poly.b), view))
    .flatMap((poly) => poly.r.map((arcs) => toDegrees(boundaries, ringOf(boundaries, arcs))))
}

/** `locatePoint`'s country layer, with the world supplied — the tests' seam. */
export function locateIn(world: World, latitude: number, longitude: number): LocatedPoint {
  const hit = findPolygon(world, latitude, longitude, NEAR_SHORE_KM)
  const match = hit ? hit.index : null

  const rings =
    match === null
      ? world.polys.flatMap((poly) =>
          poly.r.map((arcs) => toDegrees(world, ringOf(world, arcs)))
        )
      : ringsOf(world, match)

  const bounds = hit ? degreeBox(world, hit.poly.b) : boundsOf(rings)
  const view = match === null ? bounds : viewFor(bounds, MIN_VIEW_SPAN_DEGREES)

  return {
    country: match === null ? null : world.names[match],
    region: null,
    place: null,
    rings,
    // Neighbours are only worth decoding when there is a country to put in
    // context; the world fallback is already showing everything.
    context: match === null ? [] : contextRings(world, match, view),
    bounds,
    view,
    isWorld: match === null,
    approximate: !!hit && hit.offshoreKm > 0,
    offshoreKm: hit ? hit.offshoreKm : 0,
  }
}

/**
 * Narrows a country-level result to the county, state or province the point is
 * in, given that country's region set.
 *
 * The country layer stays visible underneath: the regions of one country stop
 * at its border, so without it a county on a national frontier would have open
 * sea drawn where its neighbour ought to be.
 */
export function refineToRegion(
  world: World,
  regions: Boundaries,
  base: LocatedPoint,
  latitude: number,
  longitude: number
): LocatedPoint {
  const hit = findPolygon(regions, latitude, longitude, NEAR_REGION_KM)
  if (!hit) return base

  const bounds = degreeBox(regions, hit.poly.b)
  const view = viewFor(bounds, MIN_REGION_VIEW_SPAN_DEGREES)

  return {
    ...base,
    region: regions.names[hit.index],
    place: nearestPlace(regions, latitude, longitude),
    rings: ringsOf(regions, hit.index),
    // Sibling regions first, then land belonging to other countries — without
    // the second, everything across the border reads as water.
    context: [
      ...contextRings(regions, hit.index, view),
      ...contextRings(world, base.isWorld ? null : world.names.indexOf(base.country!), view),
    ],
    bounds,
    view,
  }
}

/** `bounds` with margin added, and widened if the country is very small. */
function viewFor(
  bounds: [number, number, number, number],
  minSpanDegrees: number
): [number, number, number, number] {
  const [w, s, e, n] = bounds
  const midLon = (w + e) / 2
  const midLat = (s + n) / 2

  // Compare spans in the same units. A degree of longitude is a degree of
  // latitude shrunk by the cosine of where you are, so a country is "as tall
  // as it is wide" only after that correction.
  const lonScale = Math.max(0.02, Math.cos((midLat * Math.PI) / 180))
  const halfLat = Math.max(((n - s) / 2) * (1 + VIEW_PADDING), minSpanDegrees / 2)
  const halfLon = Math.max(
    ((e - w) / 2) * (1 + VIEW_PADDING),
    minSpanDegrees / 2 / lonScale
  )

  return [midLon - halfLon, midLat - halfLat, midLon + halfLon, midLat + halfLat]
}

function degreeBox(
  world: Boundaries,
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
