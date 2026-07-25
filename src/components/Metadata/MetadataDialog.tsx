import { useMemo, useState } from 'react'
import { useImageStore } from '../../stores/imageStore'
import type { ScrubResult } from '../../lib/metadata'

// The "Metadata (identification)" panel. Opened from the badge above the
// preview or from Actions → Metadata. Shows exactly what the selected photo
// says about where, when and on what it was taken, and strips it on request.

interface Props {
  onClose: () => void
}

export default function MetadataDialog({ onClose }: Props) {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const metadataMap = useImageStore((s) => s.metadata)
  const scrubMetadata = useImageStore((s) => s.scrubMetadata)
  const scrubbing = useImageStore((s) => s.scrubbing)

  const selected = useMemo(
    () => images.find((i) => i.id === selectedId) ?? null,
    [images, selectedId]
  )
  const meta = selectedId ? metadataMap[selectedId] ?? null : null

  const [infoOpen, setInfoOpen] = useState(false)
  const [result, setResult] = useState<ScrubResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onScrub() {
    setError(null)
    try {
      setResult(await scrubMetadata())
    } catch (err) {
      console.error(err)
      setError((err as Error).message || 'Could not strip the metadata')
    }
  }

  if (!selected) return null

  const scrubbed = result?.mode === 'lossless'
  const unsupported = result?.mode === 'unsupported'

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !scrubbing) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span aria-hidden="true">🏷</span>
              Metadata
            </h2>
            <p className="text-xs text-slate-500 truncate" title={selected.name}>
              {selected.name}
            </p>
          </div>
          {!scrubbing && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>

        {/* "What is metadata?" behind a small (i) — the panel should be about
            this photo, not a lecture, for anyone who already knows. */}
        <div className="my-3">
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-700 transition-colors"
          >
            <span
              aria-hidden="true"
              className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-serif italic leading-none"
            >
              i
            </span>
            What is metadata?
          </button>
          {infoOpen && (
            <p className="mt-2 text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5">
              Your camera writes a hidden note into every photo: where you were,
              the moment you pressed the shutter, and which phone or camera took
              it. It stays in the file when you send or post it. Stripping it
              removes the note and leaves the picture exactly as it is.
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm mb-3">{error}</div>
          )}

          {scrubbed && (
            <div className="rounded-lg bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-medium mb-3">
              Metadata removed — {result!.removedBytes.toLocaleString()} bytes dropped.
              <span className="block text-[11px] font-normal text-emerald-600 mt-0.5">
                The picture itself wasn’t re-compressed, so there’s no quality loss.
              </span>
            </div>
          )}

          {unsupported && (
            <div className="rounded-lg bg-amber-50 text-amber-800 px-4 py-3 text-sm mb-3">
              Metadata can’t be stripped in place from this file type.
              <span className="block text-[11px] mt-0.5">
                Every image you export from Universal Images is re-encoded, which drops
                metadata anyway — so a downloaded copy will be clean.
              </span>
            </div>
          )}

          {selected.converted && (
            <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2.5 mb-3">
              This file was converted when you added it, so the copy Universal Images
              holds has already lost the original’s metadata. What’s below is what the
              file you dropped in was carrying.
            </p>
          )}

          {!meta && !scrubbed && (
            <div className="rounded-lg bg-slate-50 text-slate-600 px-4 py-3 text-sm">
              No metadata found in this image. Nothing to strip.
            </div>
          )}

          {meta && (
            <>
              {meta.identifyingCount > 0 && !scrubbed && (
                <div className="rounded-lg bg-amber-50 text-amber-800 px-3 py-2 text-xs mb-3">
                  {meta.identifyingCount} of these {meta.identifyingCount === 1 ? 'field' : 'fields'}{' '}
                  could identify you, your location or your device.
                </div>
              )}

              <dl className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {meta.fields.map((f) => (
                  <div key={f.key} className="px-3 py-2 bg-white">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400 font-medium flex items-center gap-1.5">
                      {f.label}
                      {f.identifying && (
                        <span className="text-amber-600 normal-case tracking-normal" title="Can identify you">
                          ⚠
                        </span>
                      )}
                    </dt>
                    <dd className="text-sm text-slate-800 break-words tabular-nums">{f.value}</dd>
                    {f.key === 'gps' && (
                      <dd className="text-[11px] text-slate-500 mt-0.5">
                        Accurate to within a few metres — usually a home, school or workplace.
                      </dd>
                    )}
                  </div>
                ))}
                {meta.hasThumbnail && (
                  <div className="px-3 py-2 bg-white">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400 font-medium flex items-center gap-1.5">
                      Embedded thumbnail
                      <span className="text-amber-600 normal-case tracking-normal" title="Can identify you">
                        ⚠
                      </span>
                    </dt>
                    <dd className="text-[11px] text-slate-500">
                      A small preview saved alongside the photo. It’s made before edits, so it can
                      still show what was cropped or retouched out.
                    </dd>
                  </div>
                )}
                {meta.otherCount > 0 && (
                  <div className="px-3 py-2 bg-white">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                      Other tags
                    </dt>
                    <dd className="text-sm text-slate-800">
                      {meta.otherCount} further technical {meta.otherCount === 1 ? 'tag' : 'tags'}
                      <span className="block text-[11px] text-slate-500">
                        Exposure, white balance, maker notes and similar — removed too.
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 justify-end shrink-0">
          <button
            onClick={onClose}
            disabled={scrubbing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {scrubbed ? 'Done' : 'Close'}
          </button>
          {meta && !scrubbed && (
            <button
              onClick={onScrub}
              disabled={scrubbing}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {scrubbing ? 'Stripping…' : 'Scrub metadata'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
