export default function ImageIllustration() {
  return (
    <svg
      className="img-illu w-full max-w-md"
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Back card */}
      <g className="photo-back">
        <rect x="120" y="160" width="280" height="200" rx="14" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="120" y="160" width="280" height="200" rx="14" fill="#f1f5f9" opacity="0.4" />
      </g>

      {/* Front photo card */}
      <g className="photo-card">
        <rect x="100" y="140" width="300" height="220" rx="16" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />

        {/* Sunset photo content */}
        <defs>
          <clipPath id="photo-clip">
            <rect x="112" y="152" width="276" height="196" rx="8" />
          </clipPath>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="60%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
        </defs>
        <g clipPath="url(#photo-clip)">
          <rect x="112" y="152" width="276" height="196" fill="url(#sky)" />
          {/* Sun */}
          <circle cx="250" cy="270" r="28" fill="#fef3c7" />
          <circle cx="250" cy="270" r="22" fill="#fde68a" />
          {/* Far mountain silhouette */}
          <path d="M112 320 L200 240 L260 290 L320 220 L388 290 L388 348 L112 348 Z" fill="#7c2d12" opacity="0.55" />
          {/* Near mountain silhouette */}
          <path d="M112 348 L180 280 L240 320 L300 270 L388 348 Z" fill="#431407" />
        </g>

        {/* Resize handle corner */}
        <g className="resize-corner">
          <circle cx="400" cy="360" r="14" fill="#ea580c" />
          <path d="M394 360 L406 360 M400 354 L400 366" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Arrow indicating shrink */}
        <path
          className="resize-arrow"
          d="M400 360 L340 300"
          stroke="#ea580c"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="resize-arrow"
          d="M345 300 L340 300 L340 305"
          stroke="#ea580c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  )
}
