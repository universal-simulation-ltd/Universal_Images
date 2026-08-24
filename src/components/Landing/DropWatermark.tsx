/**
 * The drop circle's backdrop — a photo being framed, then edited.
 *
 * Companion to Universal PDF's version of this, and built to the same rule:
 * STROKE ONLY, no fills. The ring's interior is an opaque white circle, so a
 * drawing with white or pale fills has nothing left to show once it is knocked
 * back to a fraction of full opacity — thin lines are what survive.
 *
 * ⚠️ It must be rendered as a CHILD of <DropRing>, not behind it. DropRing
 * paints that white interior itself, so anything positioned behind the ring is
 * simply covered. As a child it lands above the fill and below the ring's own
 * copy, which follows it in the DOM.
 *
 * Deliberately sparse through the middle: the ring's copy sits on top and has
 * to stay the first thing read.
 */

/** One pass: frame the photo, draw what's in it, then edit it. */
const LOOP_MS = 9000

// ⚠️ pathLength={100} on every animated path, so the dash numbers below are
// PERCENTAGES of each stroke rather than measured lengths. Without it every
// value here would need re-deriving whenever a curve moved, and a wrong one
// does not error — it just leaves the stroke half-drawn.
const CSS = `
  .iw-frame, .iw-hill, .iw-sun, .iw-slider, .iw-knob {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation-duration: ${LOOP_MS}ms;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
  }
  @keyframes iw-draw {
    0%        { stroke-dashoffset: 100; opacity: 0; }
    4%        { opacity: 1; }
    22%, 82%  { stroke-dashoffset: 0; opacity: 1; }
    94%, 100% { stroke-dashoffset: 0; opacity: 0; }
  }
  .iw-frame  { animation-name: iw-draw; animation-delay: 0ms; }
  .iw-sun    { animation-name: iw-draw; animation-delay: 700ms; }
  .iw-hill   { animation-name: iw-draw; animation-delay: 1100ms; }
  .iw-slider { animation-name: iw-draw; animation-delay: 2300ms; }
  .iw-knob   { animation-name: iw-draw; animation-delay: 2800ms; }

  /* ⚠️ Reduced motion gets the FINISHED picture, not a slower loop and not
     frame 0 — frame 0 is an empty rectangle, the least useful still of the
     set. Same rule the other apps' watermarks follow. */
  @media (prefers-reduced-motion: reduce) {
    .iw-frame, .iw-hill, .iw-sun, .iw-slider, .iw-knob {
      animation: none;
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }
`

const INK = '#94a3b8'    // slate-400 — the photo and its contents
const ACCENT = '#f97316' // orange-500 — the edit, which is what this app does

export default function DropWatermark() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" focusable="false">
      <style>{CSS}</style>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* The photo, landscape rather than portrait — the shape that says
            "picture" where PDF's portrait page says "document". */}
        <rect className="iw-frame" pathLength={100} x="22" y="30" width="76" height="58" rx="5" stroke={INK} strokeWidth="1.6" />
        <circle className="iw-sun" pathLength={100} cx="40" cy="46" r="5" stroke={INK} strokeWidth="1.5" />
        {/* The hillside, drawn as one stroke so it sweeps in rather than
            appearing as two disconnected slopes. */}
        <path className="iw-hill" pathLength={100} d="M24 82 L48 60 L64 74 L78 62 L96 80" stroke={INK} strokeWidth="1.6" />

        {/* An adjustment slider — the edit. Universal Images is a photo EDITOR,
            and a framed picture on its own could be any gallery app. */}
        <path className="iw-slider" pathLength={100} d="M34 100 H86" stroke={INK} strokeWidth="1.4" strokeOpacity="0.7" />
        <circle className="iw-knob" pathLength={100} cx="68" cy="100" r="4.5" stroke={ACCENT} strokeWidth="2.2" />
      </g>
    </svg>
  )
}
