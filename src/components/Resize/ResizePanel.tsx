import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useImageStore } from '../../stores/imageStore'
import {
  computePresets,
  formatBytes,
  formatFilename,
  loadImage,
  processAndEncode,
  computeCenteredCoverCrop,
  supportsAvifEncode
} from '../../lib/imageResize'
import { downloadBlob } from '../../lib/download'
import { groupedPresets } from '../../lib/socialPresets'
import CropOverlay from './CropOverlay'
import SocialCropOverlay from './SocialCropOverlay'
import type { OutputFormat, PresetSize, ResizeTarget, SourceCrop, SourceImage } from '../../types/image'

const FORMAT_LABEL: Record<OutputFormat, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF'
}

interface ResizePanelProps {
  onShowGrid?: () => void
}

export default function ResizePanel({ onShowGrid }: ResizePanelProps) {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const target = useImageStore((s) => s.target)
  const setTarget = useImageStore((s) => s.setTarget)
  const resetTargetToSelected = useImageStore((s) => s.resetTargetToSelected)
  const crop = useImageStore((s) => s.crop)
  const setCrop = useImageStore((s) => s.setCrop)
  const addCenteredCrop = useImageStore((s) => s.addCenteredCrop)
  const autoCrop = useImageStore((s) => s.autoCrop)
  const autoCropping = useImageStore((s) => s.autoCropping)
  const clearCrop = useImageStore((s) => s.clearCrop)
  const convertMode = useImageStore((s) => s.convertMode)
  const setConvertMode = useImageStore((s) => s.setConvertMode)
  const socialCrop = useImageStore((s) => s.socialCrop)
  const applySocialPreset = useImageStore((s) => s.applySocialPreset)
  const moveSocialCrop = useImageStore((s) => s.moveSocialCrop)
  const clearSocialCrop = useImageStore((s) => s.clearSocialCrop)

  // The free-form crop and the social crop are mutually exclusive; either one
  // (if set) is the region the export pipeline should cut.
  const effectiveCrop = crop ?? socialCrop

  const selected = useMemo(
    () => images.find((i) => i.id === selectedId) ?? null,
    [images, selectedId]
  )

  const [exporting, setExporting] = useState(false)
  const [batchExporting, setBatchExporting] = useState(false)
  const [lastResult, setLastResult] = useState<{ bytes: number; width: number; height: number } | null>(null)
  const [socialOpen, setSocialOpen] = useState(false)
  const [autocropOpen, setAutocropOpen] = useState(false)
  // AVIF encoding only works in Chromium browsers; probe once so we only offer
  // the format where it genuinely encodes (elsewhere it silently yields PNG).
  const [avifOk, setAvifOk] = useState(false)
  // Format & quality is a controlled disclosure so the homepage "Convert" entry
  // can open + highlight it. It starts open (and highlighted) in convert mode.
  const [formatOpen, setFormatOpen] = useState(convertMode)

  // Hooks always run — the actual encode work is gated on having a real target.
  const estimate = useEncodedPreview(selected, target, effectiveCrop, !!selected && !!target)

  // Convert-mode entry: reveal the Format & quality section when the flag flips
  // on (e.g. the editor mounts after the homepage "Convert" click).
  useEffect(() => {
    if (convertMode) setFormatOpen(true)
  }, [convertMode])

  useEffect(() => {
    let alive = true
    supportsAvifEncode().then((ok) => { if (alive) setAvifOk(ok) })
    return () => { alive = false }
  }, [])

  if (!selected || !target) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-sm text-slate-400">
        {onShowGrid && (
          <button
            type="button"
            onClick={onShowGrid}
            className="md:hidden inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Open an image
          </button>
        )}
        Select an image to resize.
      </div>
    )
  }

  // When a free-form crop is active the size presets (and the aspect lock)
  // follow the crop's dimensions, so picking S/M/L re-exports the cropped
  // region at that size instead of resizing the whole image.
  const basisW = crop ? crop.width : selected.width
  const basisH = crop ? crop.height : selected.height
  const presets = computePresets(basisW, basisH)
  const aspect = basisW / basisH

  function setPreset(p: PresetSize) {
    const dim = presets[p]
    setTarget({ width: dim.width, height: dim.height })
  }

  function onWidth(nextRaw: number) {
    const next = Math.max(1, Math.round(nextRaw))
    if (target!.aspectLocked) {
      setTarget({ width: next, height: Math.max(1, Math.round(next / aspect)) })
    } else {
      setTarget({ width: next })
    }
  }
  function onHeight(nextRaw: number) {
    const next = Math.max(1, Math.round(nextRaw))
    if (target!.aspectLocked) {
      setTarget({ height: next, width: Math.max(1, Math.round(next * aspect)) })
    } else {
      setTarget({ height: next })
    }
  }


  async function exportSelected() {
    if (exporting || !selected || !target) return
    setExporting(true)
    try {
      const { image, objectUrl } = await loadImage(selected.file)
      try {
        const blob = await processAndEncode(image, effectiveCrop, target.width, target.height, target.format, target.quality, target.allowTransparency)
        downloadBlob(blob, formatFilename(selected.name, target.width, target.height, target.format))
        setLastResult({ bytes: blob.size, width: target.width, height: target.height })
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    } catch (err) {
      console.error(err)
      alert(`Export failed: ${(err as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  async function exportAll() {
    if (batchExporting || !target) return
    setBatchExporting(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (const img of images) {
        const { image, objectUrl } = await loadImage(img.file)
        try {
          let w = target.width
          let h = target.height
          let cropForImage: SourceCrop | null = null
          if (socialCrop) {
            // Per-image centered cover crop at the preset aspect — the user's
            // hand-positioned crop only applies to the currently-selected image.
            cropForImage = img.id === selected!.id
              ? socialCrop
              : computeCenteredCoverCrop(img.width, img.height, target.width, target.height)
          } else if (crop && img.id === selected!.id) {
            // A free-form crop only applies to the image it was drawn on.
            cropForImage = crop
          } else if (target.aspectLocked) {
            const longTarget = Math.max(target.width, target.height)
            const longSrc = Math.max(img.width, img.height)
            const ratio = Math.min(1, longTarget / longSrc)
            w = Math.max(1, Math.round(img.width * ratio))
            h = Math.max(1, Math.round(img.height * ratio))
          }
          const blob = await processAndEncode(image, cropForImage, w, h, target.format, target.quality, target.allowTransparency)
          zip.file(formatFilename(img.name, w, h, target.format), blob)
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(zipBlob, `universal-images_${stamp}.zip`)
    } catch (err) {
      console.error(err)
      alert(`Batch export failed: ${(err as Error).message}`)
    } finally {
      setBatchExporting(false)
    }
  }

  const showQuality = target.format !== 'image/png'
  const presetMatch: PresetSize | null = (['S', 'M', 'L'] as PresetSize[]).find(
    (p) => presets[p].width === target.width && presets[p].height === target.height
  ) ?? null

  const social = groupedPresets()
  const activeSocialLabel = (() => {
    if (!socialCrop) return null
    for (const g of social) {
      const hit = g.items.find((p) => p.width === target.width && p.height === target.height)
      if (hit) return `${g.group} · ${hit.label}`
    }
    return null
  })()

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto lg:grid lg:grid-cols-[1fr_360px] lg:overflow-hidden">
      {/* shrink-0 on mobile: this is a stacked section inside the scroll
          container, so it must keep its natural height (the preview's 55vh min)
          and let the column scroll — otherwise flexbox shrinks it and the
          fixed-height preview overflows on top of the controls below.
          min-h-0 is still needed for the lg grid layout. */}
      <div className="flex flex-col bg-slate-100 shrink-0 lg:shrink lg:min-h-0">
        <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center gap-2 text-xs text-slate-500">
          {/* Mobile: tap to open image picker overlay */}
          {onShowGrid && (
            <button
              type="button"
              onClick={onShowGrid}
              title="All images"
              className="md:hidden shrink-0 inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition-colors"
            >
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor" aria-hidden="true">
                <rect x="0.5" y="0.5" width="4.5" height="4.5" rx="0.75" />
                <rect x="7" y="0.5" width="4.5" height="4.5" rx="0.75" />
                <rect x="0.5" y="7" width="4.5" height="4.5" rx="0.75" />
                <rect x="7" y="7" width="4.5" height="4.5" rx="0.75" />
              </svg>
              {images.length}
            </button>
          )}
          <span className="font-medium text-slate-700 truncate">{selected.name}</span>
          <span className="hidden sm:inline shrink-0">·</span>
          <span className="hidden sm:inline shrink-0">{selected.width} × {selected.height} px</span>
          <span className="hidden sm:inline shrink-0">·</span>
          <span className="hidden sm:inline shrink-0">{formatBytes(selected.bytes)}</span>
          {crop && (
            <span className="ml-auto inline-flex items-center gap-1 text-orange-700 bg-orange-50 ring-1 ring-orange-200 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0">
              <span aria-hidden="true">✂</span> {Math.round(crop.width)} × {Math.round(crop.height)} crop
            </span>
          )}
          {!crop && socialCrop && activeSocialLabel && (
            <span className="ml-auto inline-flex items-center gap-1 text-orange-700 bg-orange-50 ring-1 ring-orange-200 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0">
              <span aria-hidden="true">📐</span> {activeSocialLabel}
            </span>
          )}
        </div>
        <PreviewArea
          image={selected}
          target={target}
          crop={crop}
          socialCrop={socialCrop}
          previewUrl={estimate.state === 'ready' ? estimate.previewUrl : null}
          onSetCrop={setCrop}
          onMoveSocialCrop={moveSocialCrop}
        />
      </div>

      <div className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-white shrink-0 lg:shrink lg:overflow-y-auto">
        <div className="p-5 space-y-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Crop</h2>
            {crop ? (
              <button
                type="button"
                onClick={clearCrop}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 bg-orange-50 text-sm text-orange-700 transition-colors"
              >
                <span aria-hidden="true">✕</span>
                <span className="flex-1 text-left">Remove crop</span>
                <span className="text-[10px] uppercase tracking-wide text-orange-500">Esc</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={addCenteredCrop}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 text-sm text-slate-700 transition-colors"
              >
                <span aria-hidden="true">✂</span>
                <span className="flex-1 text-left">Manual crop</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">or drag</span>
              </button>
            )}

            {/* Autocrop — trims the whitespace/border around the content. */}
            <button
              type="button"
              onClick={() => setAutocropOpen((v) => !v)}
              aria-expanded={autocropOpen}
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 text-sm text-slate-700 transition-colors"
            >
              <span aria-hidden="true">🪄</span>
              <span className="flex-1 text-left">Autocrop</span>
              <span
                aria-hidden="true"
                className={['text-slate-400 text-xs transition-transform', autocropOpen ? 'rotate-90' : ''].join(' ')}
              >
                ▸
              </span>
            </button>
            {autocropOpen && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                <p className="text-[11px] text-slate-500 leading-snug mb-2">
                  Trim the blank border around your image.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { mode: 'max' as const, label: 'Max', hint: 'Tightest' },
                    { mode: 'square' as const, label: '1:1', hint: 'Square' },
                    { mode: 'ratio' as const, label: 'Keep ratio', hint: 'Same shape' }
                  ]).map(({ mode, label, hint }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => autoCrop(mode)}
                      disabled={autoCropping}
                      className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-md border border-slate-200 bg-white hover:border-orange-400 hover:bg-orange-50/40 text-slate-700 text-xs font-medium disabled:opacity-60 disabled:cursor-wait transition-colors"
                    >
                      <span>{label}</span>
                      <span className="text-[9px] uppercase tracking-wide text-slate-400">{hint}</span>
                    </button>
                  ))}
                </div>
                {autoCropping && (
                  <p className="mt-2 text-[11px] text-orange-600">Scanning for whitespace…</p>
                )}
              </div>
            )}

            <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
              Drag on the image to draw a crop, then drag inside to move it or pull
              a handle to resize. Autocrop trims the blank border automatically.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Size preset</h2>
              <button
                type="button"
                onClick={resetTargetToSelected}
                className="text-[11px] text-slate-400 hover:text-slate-700"
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['S', 'M', 'L'] as PresetSize[]).map((p) => {
                const dim = presets[p]
                const isActive = !socialCrop && presetMatch === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
                    className={[
                      'p-3 rounded-lg border text-left transition-colors',
                      isActive
                        ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500/30'
                        : 'border-slate-200 hover:border-orange-400 hover:bg-orange-50/40'
                    ].join(' ')}
                  >
                    <div className={['text-xl font-semibold leading-none', isActive ? 'text-orange-700' : 'text-slate-700'].join(' ')}>
                      {p}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                      {dim.width}×{dim.height}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setSocialOpen((v) => !v)}
              aria-expanded={socialOpen}
              className="w-full flex items-center justify-between gap-2 py-1 group"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700">
                Social Media Sizes
              </span>
              <span className="flex items-center gap-1.5">
                {socialCrop && (
                  <span className="text-[10px] uppercase tracking-wide bg-orange-50 text-orange-700 ring-1 ring-orange-200 rounded-full px-2 py-0.5">
                    Active
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={[
                    'text-slate-400 group-hover:text-slate-600 transition-transform',
                    socialOpen ? 'rotate-90' : ''
                  ].join(' ')}
                >
                  ▶
                </span>
              </span>
            </button>
            {socialOpen && (
              <div className="mt-2 space-y-2.5">
                {socialCrop && (
                  <button
                    type="button"
                    onClick={clearSocialCrop}
                    className="w-full text-left text-[11px] text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 rounded-md px-2 py-1.5 ring-1 ring-orange-200 transition-colors"
                  >
                    Clear social crop · go back to free sizing
                  </button>
                )}
                {social.map((g) => (
                  <div key={g.group}>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{g.group}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((p) => {
                        const isActive = !!socialCrop && target.width === p.width && target.height === p.height
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applySocialPreset(p.width, p.height)}
                            title={`${p.width} × ${p.height} px`}
                            className={[
                              'px-2 py-1 rounded-md border text-[11px] font-medium transition-colors',
                              isActive
                                ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500/30'
                                : 'border-slate-200 text-slate-600 hover:border-orange-400 hover:bg-orange-50/40'
                            ].join(' ')}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-slate-400 leading-snug">
                  Picking a size shows a crop frame on the preview — drag it to reframe so your image isn't squished.
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Custom size (px)</h2>
              <button
                type="button"
                onClick={() => setTarget({ aspectLocked: !target.aspectLocked })}
                title={target.aspectLocked ? 'Unlink aspect ratio' : 'Link aspect ratio'}
                className={[
                  'inline-flex items-center gap-1 text-xs px-2 py-1 rounded ring-1 transition-colors',
                  target.aspectLocked
                    ? 'bg-orange-50 text-orange-700 ring-orange-300'
                    : 'bg-slate-100 text-slate-500 ring-slate-300'
                ].join(' ')}
                aria-pressed={target.aspectLocked}
              >
                <span aria-hidden="true">{target.aspectLocked ? '🔗' : '🔓'}</span>
                <span>{target.aspectLocked ? 'Linked' : 'Unlinked'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] text-slate-500 mb-1">Width</span>
                <input
                  type="number"
                  min={1}
                  value={target.width}
                  onChange={(e) => onWidth(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] text-slate-500 mb-1">Height</span>
                <input
                  type="number"
                  min={1}
                  value={target.height}
                  onChange={(e) => onHeight(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                />
              </label>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Source aspect {aspect.toFixed(3)} · scaling to {(target.width / selected.width * 100).toFixed(0)}%
            </div>
          </div>

          {/* Format & quality — collapsed by default (most users want the
              imported file's format at 85%). Sits directly above Export so the
              output settings live next to the download button. The homepage
              "Convert" entry opens + highlights this section. */}
          <div
            className={[
              'pt-2 border-t border-slate-200 transition-colors',
              convertMode ? 'rounded-lg ring-2 ring-orange-500/60 bg-orange-50/50 -mx-1.5 px-1.5' : ''
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => {
                setFormatOpen((v) => !v)
                if (convertMode) setConvertMode(false)
              }}
              aria-expanded={formatOpen}
              className="w-full flex items-center justify-between gap-2 py-1 group"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700">
                Format &amp; quality
              </span>
              <span className="flex items-center gap-1.5">
                {convertMode && (
                  <span className="text-[10px] uppercase tracking-wide bg-orange-100 text-orange-700 ring-1 ring-orange-300 rounded-full px-2 py-0.5">
                    Convert
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={['text-slate-400 group-hover:text-slate-600 text-xs transition-transform', formatOpen ? 'rotate-90' : ''].join(' ')}
                >
                  ▸
                </span>
              </span>
            </button>
            {formatOpen && (
              <div className="mt-2">
                {/* AVIF only appears where the browser can actually encode it. */}
                <div className={['grid gap-2', avifOk ? 'grid-cols-2' : 'grid-cols-3'].join(' ')}>
                  {(['image/jpeg', 'image/webp', 'image/png', ...(avifOk ? ['image/avif'] : [])] as OutputFormat[]).map((f) => {
                    const isActive = target.format === f
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTarget({ format: f })}
                        className={[
                          'py-2 rounded-lg border text-xs font-medium transition-colors',
                          isActive
                            ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500/30'
                            : 'border-slate-200 text-slate-600 hover:border-orange-400'
                        ].join(' ')}
                      >
                        {FORMAT_LABEL[f]}
                      </button>
                    )
                  })}
                </div>
                {avifOk && target.format === 'image/avif' && (
                  <p className="mt-2 text-[10px] text-slate-400 leading-snug">
                    AVIF gives the smallest files, but isn't supported everywhere for viewing yet.
                  </p>
                )}
                {target.format === 'image/png' && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-medium text-slate-600">Allow transparency</div>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        Off fills the background white behind the image.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={target.allowTransparency}
                      onClick={() => setTarget({ allowTransparency: !target.allowTransparency })}
                      className={[
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                        target.allowTransparency ? 'bg-orange-600' : 'bg-slate-300'
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                          target.allowTransparency ? 'translate-x-4' : 'translate-x-0.5'
                        ].join(' ')}
                      />
                    </button>
                  </div>
                )}
                {showQuality && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>Quality</span>
                      <span>{Math.round(target.quality * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round(target.quality * 100)}
                      onChange={(e) => setTarget({ quality: Number(e.target.value) / 100 })}
                      className="w-full accent-orange-600"
                    />
                    <p className="mt-1 text-[10px] text-slate-400 leading-snug">
                      The preview reflects the chosen quality.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Export</h2>
            <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Estimated output</span>
                <span className="font-medium tabular-nums text-slate-800">
                  {estimate.state === 'ready'
                    ? formatBytes(estimate.bytes)
                    : estimate.state === 'computing'
                      ? '…'
                      : '—'}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-slate-400">
                <span>{target.width}×{target.height} {target.format.replace('image/', '').toUpperCase()}</span>
                {estimate.state === 'ready' && (
                  <span>{Math.round((1 - estimate.bytes / selected.bytes) * 100)}% vs source</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportSelected}
                disabled={exporting}
                className="flex-1 h-10 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm disabled:opacity-60 disabled:cursor-wait transition-colors"
              >
                {exporting ? 'Exporting…' : `Download ${target.width}×${target.height}`}
              </button>
              <button
                type="button"
                onClick={() => useImageStore.setState({ hostedStoreOpen: true })}
                title="Back up — keep online with Hosted by UNI·SIM"
                aria-label="Back up"
                className="shrink-0 inline-flex h-10 items-center justify-center px-3 rounded-lg border border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <path d="M17 21v-8H7v8" />
                  <path d="M7 3v5h8" />
                </svg>
              </button>
            </div>
            {images.length > 1 && (
              <button
                type="button"
                onClick={exportAll}
                disabled={batchExporting}
                className="w-full h-10 rounded-lg bg-white border border-slate-300 hover:border-orange-400 text-slate-700 text-sm font-medium disabled:opacity-60 disabled:cursor-wait transition-colors"
              >
                {batchExporting ? `Zipping ${images.length}…` : `Download all as .zip (${images.length})`}
              </button>
            )}
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span aria-hidden="true">🔒</span>
              EXIF and location metadata are stripped on export.
            </p>
            {lastResult && (
              <div className="text-[11px] text-slate-500 bg-slate-50 rounded-md px-3 py-2 leading-relaxed">
                Saved <span className="font-medium text-slate-700">{lastResult.width}×{lastResult.height}</span>
                {' · '}
                <span className="font-medium text-slate-700">{formatBytes(lastResult.bytes)}</span>
                {' '}({Math.round((1 - lastResult.bytes / selected.bytes) * 100)}% smaller)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type Estimate =
  | { state: 'idle' }
  | { state: 'computing' }
  | { state: 'ready'; bytes: number; previewUrl: string }
  | { state: 'error' }

/**
 * Debounced live encode of the currently-selected image at the current output
 * settings. Returns the resulting byte count for size estimation and a
 * preview object URL so the preview pane can reflect the chosen quality.
 *
 * The decoded HTMLImageElement is cached per selected image so each setting
 * tweak only pays the encode cost, not the decode cost.
 */
function useEncodedPreview(
  selected: SourceImage | null,
  target: ResizeTarget | null,
  socialCrop: SourceCrop | null,
  enabled: boolean
): Estimate {
  const [estimate, setEstimate] = useState<Estimate>({ state: 'idle' })
  const sourceRef = useRef<{ url: string; image: HTMLImageElement } | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  // Cache the decoded source by objectUrl, not id: cropping replaces the
  // image's file/objectUrl in place while keeping the same id, so keying on id
  // would re-encode the stale (pre-crop) bitmap and the preview would never
  // update until the cropper was reopened.
  const surl = selected?.objectUrl ?? null
  const tw = target?.width ?? 0
  const th = target?.height ?? 0
  const tf = target?.format ?? 'image/jpeg'
  const tq = target?.quality ?? 1
  const ta = target?.allowTransparency ?? true
  const cx = socialCrop?.x ?? null
  const cy = socialCrop?.y ?? null
  const cw = socialCrop?.width ?? null
  const ch = socialCrop?.height ?? null

  // When the underlying image changes identity — most importantly after a crop,
  // which swaps the file + objectUrl while keeping the same id — drop BOTH caches
  // synchronously. Without this, the debounced encode below could still hold the
  // pre-crop decoded bitmap (sourceRef) or the pre-crop encoded blob
  // (previewUrlRef) for a frame, and the preview would flash the full,
  // un-cropped image before the new encode lands. Revoking the stale preview
  // here also forces PreviewArea to fall back to the fresh (cropped)
  // `image.objectUrl` instead of a now-wrong encoded blob. This was the
  // mobile-visible "crop shows briefly, then reverts to the full image" bug —
  // the slower the device, the longer the stale frame was on screen.
  useEffect(() => {
    sourceRef.current = null
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setEstimate((prev) => (prev.state === 'idle' ? prev : { state: 'computing' }))
  }, [surl])

  useEffect(() => {
    if (!enabled || !selected || !target) {
      setEstimate({ state: 'idle' })
      return
    }
    let cancelled = false
    setEstimate((prev) => {
      if (prev.state === 'ready') return { state: 'computing' }
      return prev.state === 'computing' ? prev : { state: 'computing' }
    })
    const tid = window.setTimeout(async () => {
      try {
        let source = sourceRef.current
        if (!source || source.url !== selected.objectUrl) {
          const { image } = await loadImage(selected.file)
          if (cancelled) return
          sourceRef.current = { url: selected.objectUrl, image }
          source = sourceRef.current
        }
        const blob = await processAndEncode(
          source.image,
          socialCrop,
          target.width,
          target.height,
          target.format,
          target.quality,
          target.allowTransparency
        )
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
        setEstimate({ state: 'ready', bytes: blob.size, previewUrl: url })
      } catch (err) {
        if (!cancelled) {
          console.error('Encode preview failed', err)
          setEstimate({ state: 'error' })
        }
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(tid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, surl, tw, th, tf, tq, ta, cx, cy, cw, ch])

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  return estimate
}

interface PreviewAreaProps {
  image: SourceImage
  target: ResizeTarget
  crop: SourceCrop | null
  socialCrop: SourceCrop | null
  previewUrl: string | null
  onSetCrop: (rect: { x: number; y: number; width: number; height: number } | null) => void
  onMoveSocialCrop: (x: number, y: number) => void
}

/**
 * Preview pane.
 *   - socialCrop active → pannable crop window (SocialCropOverlay)
 *   - otherwise → encoded-output preview with the live free-form CropOverlay
 *     layered on top (transparent until the user draws a crop, then it shows
 *     the source so the selection can be moved/resized).
 */
function PreviewArea({
  image,
  target,
  crop,
  socialCrop,
  previewUrl,
  onSetCrop,
  onMoveSocialCrop
}: PreviewAreaProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    function update() {
      const node = wrapperRef.current
      if (!node) return
      setBox({ w: node.clientWidth, h: node.clientHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const PADDING = 48
  const availW = Math.max(1, box.w - PADDING)
  const availH = Math.max(1, box.h - PADDING)
  const fitScale = box.w && box.h
    ? Math.min(1, Math.min(availW / target.width, availH / target.height))
    : 1
  const displayW = Math.max(1, Math.round(target.width * fitScale))
  const displayH = Math.max(1, Math.round(target.height * fitScale))
  const pct = Math.round(fitScale * 100)

  return (
    <div ref={wrapperRef} className="relative flex flex-1 min-h-[55vh] lg:min-h-0 overflow-hidden checker-bg">
      {socialCrop ? (
        <SocialCropOverlay image={image} crop={socialCrop} onMove={onMoveSocialCrop} />
      ) : (
        <>
          {/* Encoded-output preview. Hidden under the source while a crop is
              active (the CropOverlay paints the source on top). */}
          <div className="relative flex flex-1 min-h-0 items-center justify-center p-6">
            <img
              src={previewUrl ?? image.objectUrl}
              alt={image.name}
              draggable={false}
              style={{ width: displayW, height: displayH }}
              className="block object-fill shadow-lg ring-1 ring-slate-200 bg-white"
            />
          </div>
          {!crop && (
            <div className="absolute bottom-3 right-3 pointer-events-none flex items-center gap-2">
              <span className="bg-slate-900/85 text-white text-[11px] font-medium tabular-nums px-2 py-1 rounded-md">
                {target.width} × {target.height}
              </span>
              <span
                className={[
                  'text-[11px] font-medium tabular-nums px-2 py-1 rounded-md',
                  pct >= 100 ? 'bg-orange-600 text-white' : 'bg-slate-900/85 text-white'
                ].join(' ')}
                title={pct >= 100 ? 'Showing at actual pixel size' : 'Scaled to fit the preview area'}
              >
                {pct >= 100 ? '1:1' : `${pct}%`}
              </span>
            </div>
          )}
          <CropOverlay image={image} crop={crop} onChange={onSetCrop} />
        </>
      )}
    </div>
  )
}
