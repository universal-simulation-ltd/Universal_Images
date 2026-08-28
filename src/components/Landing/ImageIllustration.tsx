import { useRef } from 'react'
import { useIllustrationClock } from '@unisim/sdk'

/** One sweep of the loop, frame 0 → frame 10, in ms. It runs straight back down. */
const SWEEP_MS = 5000

/**
 * The landing illustration: a stack of photos fans out, gets selected, is
 * dragged smaller by its corner, and the size underneath it drops from 4.8 MB
 * to 612 KB. Then it unwinds and does it again.
 *
 * It used to be a hover-only reveal — a float, a corner handle popping in, an
 * arrow drawing itself — which meant the whole picture only ever happened for
 * someone already pointing at it, and it never showed the thing the app does.
 *
 * ONE CLOCK, NOT SIX ANIMATIONS
 * -----------------------------
 * Copied from `PdfIllustration.tsx`, deliberately: everything is a window on a
 * single `--t`, 0 → 1, set here and read by `index.css`. Separate
 * `@keyframes`/transitions cannot do what this needs — an element part way
 * through a `@keyframes` cannot be told to return to its own first frame
 * (`animation-play-state: paused` freezes it wherever it stands, and removing
 * the animation snaps it). With one number, "return to frame 0" is one glide.
 *
 * ⚠️ This clock is now written twice, here and in Universal PDF. A third copy
 * should go to `@unisim/sdk` as a hook rather than be pasted again — the
 * mechanics (the rAF, the park, the mid-glide resume) are identical; only the
 * scene each one drives is per-app.
 *
 * WHY HOVER STOPS IT RATHER THAN STARTING IT
 * ------------------------------------------
 * This sits beside the drop circle, so the pointer arriving means the user is
 * reading or aiming, and a picture that keeps moving under the cursor competes
 * with the thing they came to click. It settles on frame 0 and stays there.
 */
export default function ImageIllustration() {
  const ref = useRef<HTMLDivElement>(null)
  useIllustrationClock(ref, { sweepMs: SWEEP_MS })

  return (
    <div ref={ref} className="img-illu relative w-full max-w-md aspect-square select-none">
      <svg
        viewBox="0 0 500 500"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="photo-clip">
            <rect x="112" y="122" width="276" height="196" rx="8" />
          </clipPath>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="60%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
          <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#0f172a" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* Where the photo started. It appears as the drag begins, so the
            shrink has something to be smaller *than* — without it the card
            just moves, and a picture of a resize that shows no size change is
            the one thing this illustration must not be. */}
        <rect
          className="img-ghost"
          x="100"
          y="110"
          width="300"
          height="220"
          rx="16"
          fill="none"
          stroke="#fb923c"
          strokeWidth="2"
          strokeDasharray="7 7"
        />

        {/* Outer group: the whole stack straightens and lifts across the sweep.
            Inner group: the resize itself, about the top-left corner, so the
            card pulls in towards the handle the cursor is holding. Two windows
            on one element is what the nesting buys. */}
        <g className="img-card" style={{ transformOrigin: '250px 220px' }}>
          <g className="img-scale" style={{ transformOrigin: '100px 110px' }}>
            {/* The rest of the batch, fanning out behind. They resize with the
                front one: this app does the whole drop at once. */}
            <g className="img-back img-back-2" style={{ transformOrigin: '250px 220px' }}>
              <rect x="100" y="110" width="300" height="220" rx="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" filter="url(#card-shadow)" />
              <rect x="112" y="122" width="276" height="196" rx="8" fill="#f1f5f9" />
            </g>
            <g className="img-back img-back-1" style={{ transformOrigin: '250px 220px' }}>
              <rect x="100" y="110" width="300" height="220" rx="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" filter="url(#card-shadow)" />
              <rect x="112" y="122" width="276" height="196" rx="8" fill="#e2e8f0" />
            </g>

            {/* The front photo */}
            <g className="img-photo">
              <rect x="100" y="110" width="300" height="220" rx="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" filter="url(#card-shadow)" />
              <g clipPath="url(#photo-clip)">
                <rect x="112" y="122" width="276" height="196" fill="url(#sky)" />
                <circle cx="250" cy="240" r="28" fill="#fef3c7" />
                <circle cx="250" cy="240" r="22" fill="#fde68a" />
                {/* Far ridge, then the near one in front of it */}
                <path d="M112 290 L200 210 L260 260 L320 190 L388 260 L388 318 L112 318 Z" fill="#7c2d12" opacity="0.55" />
                <path d="M112 318 L180 250 L240 290 L300 240 L388 318 Z" fill="#431407" />
              </g>
            </g>

            {/* Selection: the outline first, then the four handles popping in
                one after another, clockwise from the top-left. */}
            <rect className="img-marquee" x="100" y="110" width="300" height="220" rx="16" fill="none" stroke="#ea580c" strokeWidth="2.5" />
            <g className="img-handle h1" style={{ transformOrigin: '100px 110px' }}>
              <circle cx="100" cy="110" r="9" fill="#ffffff" stroke="#ea580c" strokeWidth="3" />
            </g>
            <g className="img-handle h2" style={{ transformOrigin: '400px 110px' }}>
              <circle cx="400" cy="110" r="9" fill="#ffffff" stroke="#ea580c" strokeWidth="3" />
            </g>
            <g className="img-handle h3" style={{ transformOrigin: '100px 330px' }}>
              <circle cx="100" cy="330" r="9" fill="#ffffff" stroke="#ea580c" strokeWidth="3" />
            </g>
            <g className="img-handle h4" style={{ transformOrigin: '400px 330px' }}>
              <circle cx="400" cy="330" r="9" fill="#ffffff" stroke="#ea580c" strokeWidth="3" />
            </g>
          </g>
        </g>

        {/* −87%, stamped into the space the photo just gave back. */}
        <g className="img-badge" style={{ transformOrigin: '344px 171px' }}>
          <rect x="300" y="150" width="88" height="42" rx="21" fill="#ecfdf5" stroke="#10b981" strokeWidth="2" />
          <text x="344" y="178" textAnchor="middle" fontSize="20" fontWeight="700" fill="#059669" fontFamily="ui-sans-serif, system-ui">
            −87%
          </text>
        </g>

        {/* Before and after, in the same place, with a beat of nothing between
            them: crossfading two lines of text on top of each other is unreadable
            for the whole overlap. */}
        <text className="img-dim-before" x="250" y="402" textAnchor="middle" fontSize="17" fill="#64748b" fontFamily="ui-sans-serif, system-ui">
          1920 × 1280 · 4.8 MB
        </text>
        <text className="img-dim-after" x="250" y="402" textAnchor="middle" fontSize="17" fontWeight="600" fill="#0f172a" fontFamily="ui-sans-serif, system-ui">
          800 × 533 · 612 KB
        </text>

        {/* The cursor arrives at the bottom-right handle, then holds it: its
            drag window is the same window the card shrinks in, so it stays
            glued to that corner all the way down. The base position is an
            attribute, not CSS — a `transform` rule here would replace it. */}
        <g className="img-cursor" transform="translate(400 330)">
          <g className="img-cursor-approach">
            <g className="img-cursor-drag">
              <path d="M0 0 L0 18 L5 14 L9 22 L12 21 L8 13 L14 13 Z" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
