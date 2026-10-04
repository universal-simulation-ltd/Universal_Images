import { useEffect, useId, useRef } from 'react'

// The behaviour half of a modal; `./dialog` is the layout half. Until
// 2026-10-04 none of the three dialogs said it WAS one: no role, no name, no
// Escape, and the focus stayed on the button behind the backdrop, so a
// keyboard or screen-reader user carried on tabbing through a page they could
// no longer see. This gives them all the same answer:
//
//   • role="dialog" + aria-modal, named by its title (`titleId`);
//   • focus moves into the panel on open, Tab and Shift+Tab stay inside it,
//     and it goes back to whatever opened the dialog on close;
//   • Escape closes — unless `canClose` is false (mid-scrub, mid-render), the
//     same rule the backdrop click and the close button already follow.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** `open` is for a dialog that stays mounted while shut (the backup one). */
export function useDialog(onClose: () => void, canClose = true, open = true) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  const canCloseRef = useRef(canClose)
  closeRef.current = onClose
  canCloseRef.current = canClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    // The panel itself, not its first button: then the title is what gets
    // read out, and the first Tab lands on the first control.
    panel?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (!panel) return
      if (e.key === 'Escape') {
        if (!canCloseRef.current) return
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  return {
    titleId,
    panelProps: {
      ref: panelRef,
      role: 'dialog' as const,
      'aria-modal': true as const,
      'aria-labelledby': titleId,
      tabIndex: -1,
    },
  }
}
