import type { ReactNode } from 'react'

// The suite's key buttons (SDK 0.216, BRANDING.md → Buttons, 2026-11-04):
// main.tsx installs their CSS, and buttons take `buttonClass(rank, size)` from
// '@unisim/sdk'. A button's icon sits in a <Key> as its FIRST child; soft and
// quiet buttons put an icon straight inside instead.

/** A key button's icon block, its first child. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <span className="u-btn__key" aria-hidden="true">
      {children}
    </span>
  )
}

const icon = (d: string) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
export const DownloadIcon = () => icon('M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12')
export const UploadIcon = () => icon('M10 17V7m0 0L6.5 10.5M10 7l3.5 3.5M4 4h12')
export const PlusIcon = () => icon('M10 4v12M4 10h12')
export const CheckIcon = () => icon('M4 10.5l4 4 8-9')
