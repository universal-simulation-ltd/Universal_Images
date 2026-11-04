import type { ReactNode } from 'react'
import { PHONE } from '../native/shell'

// The suite's key buttons (SDK 0.216, BRANDING.md → Buttons, 2026-11-04):
// main.tsx installs their CSS, and buttons take `buttonClass(rank, size)` from
// '@unisim/sdk'. A button's icon sits in a <Key> as its FIRST child; soft and
// quiet buttons put an icon straight inside instead.
//
// The website only. The phone app renders these same panels and dialogs but
// keeps its own phone design (store-listings §7), so every changed button picks
// its classes with `web(suite, phone)` and a <Key> draws the phone's old icon
// markup there: decided once, from PHONE (native/shell.ts).

/** A button's classes: the suite's on the website, its own on the phone. */
export const web = (suite: string, phone: string) => (PHONE ? phone : suite)

/**
 * A key button's icon block, its first child. On the phone it is the icon the
 * button had before: `phone` when given (null for none), else the children in a
 * plain aria-hidden span.
 */
export function Key({ children, phone }: { children: ReactNode; phone?: ReactNode }) {
  if (PHONE) return phone !== undefined ? <>{phone}</> : <span aria-hidden="true">{children}</span>
  return (
    <span className="u-btn__key" aria-hidden="true">
      {children}
    </span>
  )
}

type IconProps = { className?: string; strokeWidth?: string }
const icon = (d: string) =>
  function Icon({ className, strokeWidth = '1.8' }: IconProps) {
    return (
      <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    )
  }
export const DownloadIcon = icon('M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12')
export const UploadIcon = icon('M10 17V7m0 0L6.5 10.5M10 7l3.5 3.5M4 4h12')
export const PlusIcon = icon('M10 4v12M4 10h12')
export const CheckIcon = icon('M4 10.5l4 4 8-9')
