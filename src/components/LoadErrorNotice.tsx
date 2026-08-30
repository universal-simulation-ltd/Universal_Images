import { useImageStore } from '../stores/imageStore'

/**
 * The files the last drop could not open. Before this, a file that failed to
 * decode was dropped on the floor with a `console.warn` — so dropping three
 * iPhone HEICs the old decoder could not read was indistinguishable from
 * dropping nothing, and the page just sat on the landing screen.
 *
 * Deliberately not an `alert()`: a batch can fail file-by-file, and a modal per
 * file would need dismissing N times before the images that DID open appear.
 */
export default function LoadErrorNotice() {
  const errors = useImageStore((s) => s.loadErrors)
  const dismiss = useImageStore((s) => s.dismissLoadErrors)
  if (errors.length === 0) return null

  return (
    <div
      role="alert"
      className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-px">⚠</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {errors.length === 1
              ? `Couldn't open ${errors[0]!.name}`
              : `Couldn't open ${errors.length} files`}
          </p>
          {errors.length > 1 && (
            <ul className="mt-1 space-y-0.5 text-amber-800">
              {errors.map((e) => (
                <li key={e.name} className="truncate" title={e.reason}>
                  {e.name} — {e.reason}
                </li>
              ))}
            </ul>
          )}
          {errors.length === 1 && (
            <p className="mt-0.5 text-amber-800">{errors[0]!.reason}</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded px-1.5 text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors"
        >
          {/* SVG, not `✕`: U+2715 has no glyph in iOS's system font and draws
              as a hollow ▯?▯ box, which is the only way to dismiss this. */}
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
