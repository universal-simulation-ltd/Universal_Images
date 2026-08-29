import { useEffect, useMemo, useState } from 'react'
import { locatePoint, refineLocation, type LocatedPoint, type LonLat } from '../../lib/geo'

// The locator map under the Location row of the metadata panel.
//
// Two decimal numbers are easy to skim past. The same point as a dot on the
// country it was taken in is not, and that recognition is the entire job of
// this panel — somebody about to post a photo should feel what the file is
// carrying, not decode it.
//
// It draws from boundaries bundled with the app (see `src/lib/geo.ts`), so
// there are no tiles, no lookups and no requests: nothing here tells anybody
// where the photo was taken. That is the constraint the whole feature is built
// inside of, and it is why the map stops at the country outline rather than
// zooming to a street.
//
// Zooming to the county and naming the nearest town needs that country's
// outlines, which are too big to hand everybody up front — so they are fetched,
// and that fetch is the only request this panel can make. It therefore sits
// behind a button the reader presses, which is the same bargain as the Copy
// button beside the coordinates: opening a photo costs nothing, and anything
// that could leave takes a deliberate press. It also lets the default caption
// keep saying "nothing was sent" without qualification, because by default
// nothing has been.

/** Width:height of the frame. Wide and short — it sits inside a dialog row. */
const ASPECT = 20 / 9

/**
 * Below this distance from a border, `approximate` is the boundary data being
 * coarse rather than the photo being at sea. A 1:50m coastline is drawn to
 * within a couple of kilometres, and a country smaller than that — Monaco is
 * about two kilometres across — has a town centre that falls outside its own
 * simplified outline. Saying "off the coast of Monaco" to somebody standing in
 * Monaco would be wrong in a way the plain coordinates never were.
 */
const OFFSHORE_KM = 5

/**
 * Within this many kilometres of a town's centre, the answer is just that town;
 * beyond it the distance is quoted too.
 *
 * The gazetteer gives one point per settlement rather than its outline, so
 * "Wem" over a photo taken in Wem is right and "Wem" over one taken eight
 * kilometres away is not. Two kilometres is about the radius of a place small
 * enough for that to matter — anywhere larger has a nearer entry of its own.
 */
const IN_THE_PLACE_KM = 2

/**
 * A highlighted place whose longest side is under this many viewBox units is
 * smaller on screen than the marker sitting on top of it — literally hidden by
 * the dot that points at it. Monaco, which has no regions to zoom to, frames at
 * about sixteen units. The map cannot fix that by zooming further (the boundary
 * data does not know Monaco to better than a kilometre), so it says so instead.
 */
const HIDDEN_UNDER_MARKER = 45

/**
 * Points closer together than this, in viewBox units, are dropped. The frame's
 * long side is 1000 units and renders around 400px wide, so this is a sliver
 * over a pixel: far too small to see, and the difference between a path with a
 * few hundred points in it and one with sixty thousand. Canada is the test.
 */
const SIMPLIFY = 1.4

interface Props {
  latitude: number
  longitude: number
}

interface Frame {
  /** viewBox dimensions. The long side is always 1000. */
  width: number
  height: number
  /** Rings already projected into viewBox units. */
  country: string
  context: string
  /** The point itself, as a percentage of the frame. */
  markerX: number
  markerY: number
  /** The country's longest side, in viewBox units, for judging visibility. */
  countryUnits: number
}

export default function LocationMap({ latitude, longitude }: Props) {
  const [located, setLocated] = useState<LocatedPoint | null>(null)
  const [failed, setFailed] = useState(false)
  const [zooming, setZooming] = useState(false)
  const [zoomFailed, setZoomFailed] = useState(false)

  async function onZoomIn() {
    if (!located || zooming) return
    setZooming(true)
    setZoomFailed(false)
    try {
      setLocated(await refineLocation(located, latitude, longitude))
    } catch (error) {
      console.error(error)
      setZoomFailed(true)
    } finally {
      setZooming(false)
    }
  }

  useEffect(() => {
    let live = true
    setLocated(null)
    setFailed(false)
    setZoomFailed(false)
    // The boundary set is a few hundred KB and loads on first use, so a photo
    // with no coordinates never pays for it.
    locatePoint(latitude, longitude).then(
      (result) => {
        if (!live) return
        setLocated(result)
        // A second photo from a country already fetched costs nothing, so
        // `locatePoint` will have zoomed in already — no button, no asking.
      },
      (error) => {
        console.error(error)
        // The coordinates are already on screen above this; a map that cannot
        // be drawn should cost the panel nothing.
        if (live) setFailed(true)
      }
    )
    return () => {
      live = false
    }
  }, [latitude, longitude])

  const frame = useMemo(
    () => (located ? buildFrame(located, latitude, longitude) : null),
    [located, latitude, longitude]
  )

  // A country matched, but at this zoom its outline is smaller than a pixel.
  const tooSmallToDraw =
    !!located && !located.isWorld && !!frame && frame.countryUnits < HIDDEN_UNDER_MARKER

  if (failed) return null

  return (
    <div className="mt-2">
      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
        <div style={{ aspectRatio: String(ASPECT) }}>
          {frame && (
            <svg
              viewBox={`0 0 ${frame.width} ${frame.height}`}
              className="w-full h-full block"
              role="img"
              aria-label={
                located?.country
                  ? `Map showing the photo's location in ${placeName(located)}`
                  : "Map showing the photo's location"
              }
            >
              {/* Neighbouring land, so the shape is placeable. */}
              <path d={frame.context} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" />
              {/* The country the coordinates fall in. */}
              {/* A thicker outline than the shape strictly needs: on a small
                  county the marker covers most of the fill, and the border
                  drawn around the dot is then the only thing showing which
                  place is meant. */}
              <path d={frame.country} fill="#fde68a" stroke="#d97706" strokeWidth="1.6" />
            </svg>
          )}
        </div>

        {frame && (
          <>
            {/* A country smaller than a pixel at this zoom draws as nothing at
                all, which reads as "no country matched". Ring the dot instead,
                so the highlight is somewhere. */}
            {tooSmallToDraw && (
              <span
                className="absolute block w-7 h-7 rounded-full bg-amber-300/50 border border-amber-500"
                style={{
                  left: `${frame.markerX}%`,
                  top: `${frame.markerY}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-hidden="true"
              />
            )}
            <span
              className="absolute block w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white shadow"
              style={{
                left: `${frame.markerX}%`,
                top: `${frame.markerY}%`,
                transform: 'translate(-50%, -50%)',
              }}
              aria-hidden="true"
            />
          </>
        )}

        {!frame && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">
            Reading the map…
          </div>
        )}
      </div>

      {located && (
        <p className="text-[11px] text-slate-500 mt-1">
          <span className="text-slate-700 font-medium">
            {located.isWorld
              ? 'Not inside any country — at sea, or not a real place.'
              : located.approximate && located.offshoreKm >= OFFSHORE_KM
                ? `About ${Math.round(located.offshoreKm)} km off the coast of ${located.country}.`
                : placeName(located)}
          </span>
          {tooSmallToDraw && (
            <span className="block">Too small to draw at this scale — the dot is the place.</span>
          )}
          {/* The country map is drawn from bundled data and costs nothing. The
              zoomed-in county layer is one same-origin fetch, so the claim has
              to be narrower when it is on screen — saying "nothing was sent"
              over a picture that needed a request would be a lie the Network
              tab exposes in one click. */}
          {located.place && (
            // GeoNames is CC BY 4.0 — this credit is a condition of using the
            // place names, not decoration. It goes wherever they are shown.
            <span className="block">
              Place names from GeoNames (CC BY 4.0); boundaries from Natural Earth.
            </span>
          )}
          <span className="block">
            {located.region
              ? 'Your coordinates never left this tab. The county outlines came from this app’s own server, which reveals the country and nothing finer.'
              : 'Drawn from boundaries stored in the app. Nothing was looked up, so nothing was sent.'}
          </span>
        </p>
      )}

      {/* Offered only when there is somewhere to zoom to and it has not been
          done — and never over the world fallback, where there is no country
          whose regions could be fetched. */}
      {located && !located.region && !located.isWorld && !zoomFailed && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={onZoomIn}
            disabled={zooming}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 disabled:text-slate-400 disabled:no-underline"
          >
            {zooming ? 'Zooming in…' : 'Zoom in to county and town'}
          </button>
          {/* Says the cost before it is paid, not after. */}
          <span className="block text-[11px] text-slate-500">
            Asks this app’s own server for {located.country}’s county outlines — which
            tells it the country, and nothing else. Your coordinates are not sent.
          </span>
        </div>
      )}

      {zoomFailed && (
        <p className="text-[11px] text-slate-500 mt-1.5">
          Couldn’t fetch the county outlines — you may be offline. The map above is
          drawn from the app’s own data and is unaffected.
        </p>
      )}
    </div>
  )
}

/**
 * Where the photo was taken, as one line: most specific first — the town, then
 * the county, then the country.
 *
 * Shared by the caption and the map's accessible label so the two can never
 * drift. They had: the label was built from region and country only, so a
 * screen reader heard "Shropshire, United Kingdom" while the caption on screen
 * said "Wem, Shropshire, United Kingdom".
 *
 * The distance is what keeps a nearest-place answer honest — the gazetteer
 * knows a settlement's centre, not its edges, so beyond `IN_THE_PLACE_KM` the
 * name alone would be a confident lie.
 */
function placeName(located: LocatedPoint): string {
  const place =
    located.place &&
    (located.place.km <= IN_THE_PLACE_KM
      ? located.place.name
      : `${located.place.km.toFixed(1)} km from ${located.place.name}`)
  return [place, located.region, located.country].filter(Boolean).join(', ')
}

/**
 * Projects the located rings into a viewBox, and works out where in it the dot
 * goes.
 *
 * The view is widened to the frame's aspect ratio *before* projecting, rather
 * than letting the SVG letterbox a mismatched one: with the two in step, the
 * marker can be an ordinary positioned element at a percentage of the frame,
 * which keeps it a constant size on screen no matter how far the map is zoomed.
 */
function buildFrame(located: LocatedPoint, latitude: number, longitude: number): Frame {
  const [w, s, e, n] = located.view
  const midLat = (s + n) / 2

  // Equirectangular, with longitude squeezed by the cosine of this latitude.
  // Over a single country that is close enough to true, and it stops Norway
  // from looking twice as wide as it is.
  const lonScale = Math.max(0.02, Math.cos((midLat * Math.PI) / 180))

  let spanLon = (e - w) * lonScale
  let spanLat = n - s
  // Grow the short side until the view matches the frame.
  if (spanLon / spanLat > ASPECT) spanLat = spanLon / ASPECT
  else spanLon = spanLat * ASPECT

  const midLon = (w + e) / 2
  const west = midLon - spanLon / lonScale / 2
  const north = midLat + spanLat / 2

  const scale = 1000 / Math.max(spanLon, spanLat)
  const width = spanLon * scale
  const height = spanLat * scale

  const projectX = (lon: number) => (lon - west) * lonScale * scale
  const projectY = (lat: number) => (north - lat) * scale

  const toPath = (rings: LonLat[][]) => {
    const parts: string[] = []
    for (const ring of rings) {
      let out = ''
      let points = 0
      let lastLon = NaN
      let lastX = NaN
      let lastY = NaN
      for (const [lon, lat] of ring) {
        const x = projectX(lon)
        const y = projectY(lat)

        // Russia and Fiji are drawn as single rings that run off one edge of
        // the world and back on at the other, with -180° and +180° standing
        // for the same meridian. Joined up flat, that is a line straight
        // across the map. Break the subpath at the seam instead.
        const seam = Math.abs(lon - lastLon) > 180
        lastLon = lon

        // Drop anything that lands on top of the point before it. Islands that
        // collapse to nothing drop out with it — at this zoom they were never
        // going to be more than a stray dot.
        if (!seam && Math.abs(x - lastX) < SIMPLIFY && Math.abs(y - lastY) < SIMPLIFY) continue

        out += `${out && !seam ? 'L' : `${out ? 'Z' : ''}M`}${x.toFixed(1)} ${y.toFixed(1)}`
        points++
        lastX = x
        lastY = y
      }
      // Two points cannot enclose anything.
      if (points > 2) parts.push(`${out}Z`)
    }
    return parts.join('')
  }

  const land = toPath(located.rings)
  const [countryWest, countrySouth, countryEast, countryNorth] = located.bounds

  return {
    width,
    height,
    // In the world fallback `rings` is every country on earth and none of them
    // is the answer, so it is drawn as context — highlighting the lot would
    // say the opposite of what happened.
    country: located.isWorld ? '' : land,
    context: located.isWorld ? land : toPath(located.context),
    markerX: (projectX(longitude) / width) * 100,
    markerY: (projectY(latitude) / height) * 100,
    countryUnits: Math.max(
      (countryEast - countryWest) * lonScale * scale,
      (countryNorth - countrySouth) * scale
    ),
  }
}
