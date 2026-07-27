import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useImageStore } from '../../stores/imageStore'
import {
  computePresets,
  formatBytes,
  formatFilename,
  loadImage,
  processAndEncode,
  computeCenteredCoverCrop,
  supportsAvifEncode,
  imageHasAlpha
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

// Preset background-fill swatches. `value: null` = keep transparent. The custom
// "+" swatch (a native colour picker) covers everything else.
const BG_SWATCHES: { value: string | null; label: string; swatchClass: string }[] = [
  { value: null, label: 'Transparent', swatchClass: 'checker-bg' },
  { value: '#000000', label: 'Black', swatchClass: 'bg-black' },
  { value: '#ffffff', label: 'White', swatchClass: 'bg-white' },
  { value: '#ea580c', label: 'Orange', swatchClass: 'bg-orange-600' }
]

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
  const removeBackground = useImageStore((s) => s.removeBackground)
  const restoreBackground = useImageStore((s) => s.restoreBackground)
  const removingBg = useImageStore((s) => s.removingBg)
  const bgProgress = useImageStore((s) => s.bgProgress)
  const bgOriginal = useImageStore((s) => s.bgOriginal)
  const bgFill = useImageStore((s) => s.bgFill)
  const setBgFill = useImageStore((s) => s.setBgFill)
  const faceBoxes = useImageStore((s) => s.faceBoxes)
  const detectingFaces = useImageStore((s) => s.detectingFaces)
  const faceOriginal = useImageStore((s) => s.faceOriginal)
  const faceBlurStrength = useImageStore((s) => s.faceBlurStrength)
  const faceBlurStyle = useImageStore((s) => s.faceBlurStyle)
  const setFaceBlurStrength = useImageStore((s) => s.setFaceBlurStrength)
  const setFaceBlurStyle = useImageStore((s) => s.setFaceBlurStyle)
  const detectFaces = useImageStore((s) => s.detectFaces)
  const setFaceEnabled = useImageStore((s) => s.setFaceEnabled)
  const applyFaceBlur = useImageStore((s) => s.applyFaceBlur)
  const clearFaceBlur = useImageStore((s) => s.clearFaceBlur)
  const metadataMap = useImageStore((s) => s.metadata)
  const setMetadataOpen = useImageStore((s) => s.setMetadataOpen)
  const renameImage = useImageStore((s) => s.renameImage)

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
  // Crop, Background and the custom-size inputs are collapsed by default — Size
  // presets sit at the top of the column as the primary control.
  const [cropOpen, setCropOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const [faceOpen, setFaceOpen] = useState(false)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [faceError, setFaceError] = useState<string | null>(null)
  // Hidden native colour picker backing the "+" custom background-fill swatch.
  const customColorRef = useRef<HTMLInputElement>(null)
  // Inline rename of the filename shown in the info bar.
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  // Whether the selected image has real transparency — gates the background-fill
  // swatches (which only make sense on a transparent image).
  const [hasAlpha, setHasAlpha] = useState(false)
  // AVIF encoding only works in Chromium browsers; probe once so we only offer
  // the format where it genuinely encodes (elsewhere it silently yields PNG).
  const [avifOk, setAvifOk] = useState(false)
  // Format & quality is a controlled disclosure so the homepage "Convert" entry
  // can open + highlight it. It starts open on every image — the output format
  // is the setting people reach for first — and is highlighted in convert mode.
  const [formatOpen, setFormatOpen] = useState(true)

  // Hooks always run — the actual encode work is gated on having a real target.
  const estimate = useEncodedPreview(selected, target, effectiveCrop, bgFill, !!selected && !!target)

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

  // Live re-render of the face redaction when its controls change (strength,
  // style, or a per-face toggle) — debounced so dragging the slider doesn't
  // re-encode on every tick. Only runs while a redaction is applied.
  const faceApplied = !!faceOriginal
  const enabledSig = faceBoxes ? faceBoxes.map((f) => (f.enabled ? '1' : '0')).join('') : ''
  useEffect(() => {
    if (!faceApplied || detectingFaces || !faceBoxes || faceBoxes.length === 0) return
    const tid = window.setTimeout(() => { applyFaceBlur().catch((e) => console.error(e)) }, 180)
    return () => window.clearTimeout(tid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceBlurStrength, faceBlurStyle, enabledSig])

  // Detect transparency of the selected image (re-runs on any transform that
  // swaps its objectUrl — crop, background removal, restore).
  const selectedUrl = selected?.objectUrl ?? null
  const selectedFile = selected?.file ?? null
  useEffect(() => {
    let alive = true
    setHasAlpha(false)
    if (!selectedFile) return
    loadImage(selectedFile)
      .then(({ image, objectUrl }) => {
        if (!alive) { URL.revokeObjectURL(objectUrl); return }
        setHasAlpha(imageHasAlpha(image))
        URL.revokeObjectURL(objectUrl)
      })
      .catch(() => { /* undecodable — leave swatches locked */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUrl])

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

  function startRename() {
    setRenameDraft(selected!.name)
    setRenaming(true)
  }

  function commitRename() {
    renameImage(selected!.id, renameDraft)
    setRenaming(false)
  }

  // Preselect the stem only, so typing replaces the name but keeps ".jpg" —
  // the same thing Finder and Explorer do when you rename a file.
  function selectStem(input: HTMLInputElement) {
    const dot = input.value.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length)
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


  const bgRemoved = !!bgOriginal && !!selected && bgOriginal.id === selected.id

  async function onRemoveBackground() {
    if (removingBg) return
    setBgError(null)
    try {
      await removeBackground()
    } catch (err) {
      setBgError((err as Error)?.message || 'Background removal failed. Please try again.')
    }
  }

  const faceBlurred = !!faceOriginal && !!selected && faceOriginal.id === selected.id
  const enabledFaceCount = faceBoxes ? faceBoxes.filter((f) => f.enabled).length : 0

  async function onDetectFaces() {
    if (detectingFaces) return
    setFaceError(null)
    try {
      await detectFaces()
    } catch (err) {
      setFaceError((err as Error)?.message || 'Face detection failed. Please try again.')
    }
  }

  async function exportSelected() {
    if (exporting || !selected || !target) return
    setExporting(true)
    try {
      const { image, objectUrl } = await loadImage(selected.file)
      try {
        const blob = await processAndEncode(image, effectiveCrop, target.width, target.height, target.format, target.quality, target.allowTransparency, bgFill)
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
          // The bg fill is a property of the selected image's cut-out; only apply
          // it to that image in a batch, not to every image in the ZIP.
          const fillForImage = img.id === selected!.id ? bgFill : null
          const blob = await processAndEncode(image, cropForImage, w, h, target.format, target.quality, target.allowTransparency, fillForImage)
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

  // Only surfaced when the background read actually found something — a photo
  // with no EXIF shouldn't grow a badge that says "nothing here".
  const selectedMeta = selected ? metadataMap[selected.id] ?? null : null

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
          {/* The filename doubles as the rename control — click it to edit.
              Enter / blur commits, Escape reverts. It's the stem of every
              exported file, so this is the one place to change it. */}
          {renaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onFocus={(e) => selectStem(e.currentTarget)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                else if (e.key === 'Escape') { e.preventDefault(); setRenaming(false) }
              }}
              aria-label="File name"
              className="min-w-0 flex-1 max-w-[22rem] font-medium text-slate-800 bg-white border border-orange-400 rounded px-1.5 py-0.5 text-xs outline-none ring-1 ring-orange-500/30"
            />
          ) : (
            <button
              type="button"
              onClick={startRename}
              title="Rename — this becomes the name of the file you download"
              className="min-w-0 inline-flex items-center gap-1 font-medium text-slate-700 truncate rounded px-1 -mx-1 py-0.5 hover:bg-slate-100 hover:text-slate-900 group/name transition-colors"
            >
              <span className="truncate">{selected.name}</span>
              <span aria-hidden="true" className="shrink-0 text-slate-400 opacity-0 group-hover/name:opacity-100 transition-opacity">✎</span>
            </button>
          )}
          <span className="hidden sm:inline shrink-0">·</span>
          <span className="hidden sm:inline shrink-0">{selected.width} × {selected.height} px</span>
          <span className="hidden sm:inline shrink-0">·</span>
          <span className="hidden sm:inline shrink-0">{formatBytes(selected.bytes)}</span>
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Metadata badge — only when this photo actually carries any. It's
                the one thing in the bar the user may want to act on before
                sharing, so it sits in the main view rather than only in the
                Actions menu. */}
            {selectedMeta && (
              <button
                type="button"
                onClick={() => setMetadataOpen(true)}
                title="See what this photo reveals about you"
                className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 hover:ring-amber-300 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
              >
                <span aria-hidden="true">🏷</span>
                <span>Metadata</span>
                {selectedMeta.identifyingCount > 0 && (
                  <span className="hidden sm:inline font-normal">· can identify you</span>
                )}
              </button>
            )}
            {crop && (
              <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 ring-1 ring-orange-200 rounded-full px-2 py-0.5 text-[11px] font-medium">
                <span aria-hidden="true">✂</span> {Math.round(crop.width)} × {Math.round(crop.height)} crop
              </span>
            )}
            {!crop && socialCrop && activeSocialLabel && (
              <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 ring-1 ring-orange-200 rounded-full px-2 py-0.5 text-[11px] font-medium">
                <span aria-hidden="true">📐</span> {activeSocialLabel}
              </span>
            )}
          </span>
        </div>
        <PreviewArea
          image={selected}
          target={target}
          crop={crop}
          socialCrop={socialCrop}
          previewUrl={estimate.state === 'ready' || estimate.state === 'computing' ? estimate.previewUrl : null}
          onSetCrop={setCrop}
          onMoveSocialCrop={moveSocialCrop}
        />
      </div>

      <div className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-white shrink-0 lg:shrink lg:overflow-y-auto">
        <div className="p-5 space-y-6">
          {/* Size — presets + custom dimensions, the primary control, pinned to
              the top of the column. Custom width/height is a collapsed disclosure. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Size</h2>
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

            {/* Custom width/height — collapsed by default */}
            <button
              type="button"
              onClick={() => setCustomSizeOpen((v) => !v)}
              aria-expanded={customSizeOpen}
              className="mt-2 w-full flex items-center justify-between gap-2 py-1 group"
            >
              <span className="text-[11px] font-medium text-slate-500 group-hover:text-slate-700">Custom size (px)</span>
              <span
                aria-hidden="true"
                className={['text-slate-400 group-hover:text-slate-600 text-xs transition-transform', customSizeOpen ? 'rotate-90' : ''].join(' ')}
              >
                ▸
              </span>
            </button>
            {customSizeOpen && (
              <div className="mt-1.5">
                <div className="flex justify-end mb-2">
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
            )}
          </div>

          {/* Crop — collapsed by default */}
          <div>
            <button
              type="button"
              onClick={() => setCropOpen((v) => !v)}
              aria-expanded={cropOpen}
              className="w-full flex items-center justify-between gap-2 py-1 group"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700">Crop</span>
              <span className="flex items-center gap-1.5">
                {crop && (
                  <span className="text-[10px] uppercase tracking-wide bg-orange-50 text-orange-700 ring-1 ring-orange-200 rounded-full px-2 py-0.5 tabular-nums">
                    {Math.round(crop.width)}×{Math.round(crop.height)}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={['text-slate-400 group-hover:text-slate-600 transition-transform', cropOpen ? 'rotate-90' : ''].join(' ')}
                >
                  ▶
                </span>
              </span>
            </button>
            {cropOpen && (
              <div className="mt-2">
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
                      {crop ? 'Trim the blank border inside your crop.' : 'Trim the blank border around your image.'}
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
            )}
          </div>

          {/* Background — collapsed by default */}
          <div>
            <button
              type="button"
              onClick={() => setBgOpen((v) => !v)}
              aria-expanded={bgOpen}
              className="w-full flex items-center justify-between gap-2 py-1 group"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700">Background</span>
              <span className="flex items-center gap-1.5">
                {bgRemoved && (
                  <span className="text-[10px] uppercase tracking-wide bg-orange-50 text-orange-700 ring-1 ring-orange-200 rounded-full px-2 py-0.5">Removed</span>
                )}
                <span
                  aria-hidden="true"
                  className={['text-slate-400 group-hover:text-slate-600 transition-transform', bgOpen ? 'rotate-90' : ''].join(' ')}
                >
                  ▶
                </span>
              </span>
            </button>
            {bgOpen && (
              <div className="mt-2">
                {bgRemoved ? (
                  <button
                    type="button"
                    onClick={restoreBackground}
                    disabled={removingBg}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 bg-orange-50 text-sm text-orange-700 hover:bg-orange-100 disabled:opacity-60 transition-colors"
                  >
                    <span aria-hidden="true">↩</span>
                    <span className="flex-1 text-left">Restore background</span>
                    <span className="text-[10px] uppercase tracking-wide text-orange-500">Undo</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRemoveBackground}
                    disabled={removingBg}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 text-sm text-slate-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
                  >
                    <span aria-hidden="true">🪄</span>
                    <span className="flex-1 text-left">{removingBg ? 'Removing background…' : 'Remove background'}</span>
                    {!removingBg && <span className="text-[10px] uppercase tracking-wide text-slate-400">AI</span>}
                  </button>
                )}

                {removingBg && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-[width] duration-200"
                        style={{ width: `${Math.round(bgProgress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">
                      {bgProgress > 0 && bgProgress < 1
                        ? `Downloading model — ${Math.round(bgProgress * 100)}%`
                        : 'Working on your device…'}
                      <br />
                      First use downloads a one-time model (~40 MB), then it's cached.
                    </p>
                  </div>
                )}

                {bgError && !removingBg && (
                  <p className="mt-2 text-[11px] text-red-600 leading-snug">{bgError}</p>
                )}

                {!removingBg && !bgError && (
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                    {bgRemoved
                      ? 'Cut-out ready — export as PNG to keep the transparency.'
                      : 'One-click cut-out. Runs entirely on your device — your image is never uploaded.'}
                  </p>
                )}

                {/* Background fill — replace a transparent background with a colour */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[11px] font-medium text-slate-600">Fill background</span>
                    {!hasAlpha && (
                      <span
                        title="Requires a transparent background — remove the background first"
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[9px] font-semibold cursor-help select-none"
                      >
                        i
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {BG_SWATCHES.map((sw) => {
                      const active = (sw.value === null && !bgFill) || bgFill === sw.value
                      return (
                        <button
                          key={sw.label}
                          type="button"
                          disabled={!hasAlpha}
                          onClick={() => setBgFill(sw.value)}
                          title={sw.label}
                          aria-label={sw.label}
                          aria-pressed={active}
                          className={[
                            'w-7 h-7 rounded-full ring-1 ring-slate-300 transition-all',
                            sw.swatchClass,
                            active ? 'ring-2 ring-orange-500 ring-offset-1' : 'hover:ring-slate-400',
                            !hasAlpha ? 'opacity-40 cursor-not-allowed' : ''
                          ].join(' ')}
                        />
                      )
                    })}
                    {(() => {
                      const isCustom = !!bgFill && !BG_SWATCHES.some((s) => s.value === bgFill)
                      return (
                        <button
                          type="button"
                          disabled={!hasAlpha}
                          onClick={() => customColorRef.current?.click()}
                          title="Custom colour"
                          aria-label="Custom background colour"
                          aria-pressed={isCustom}
                          style={isCustom ? { backgroundColor: bgFill! } : undefined}
                          className={[
                            'w-7 h-7 rounded-full ring-1 ring-slate-300 flex items-center justify-center text-slate-500 transition-all',
                            isCustom ? 'ring-2 ring-orange-500 ring-offset-1' : 'hover:ring-slate-400',
                            !hasAlpha ? 'opacity-40 cursor-not-allowed' : ''
                          ].join(' ')}
                        >
                          {!isCustom && <span aria-hidden="true" className="text-sm leading-none">+</span>}
                        </button>
                      )
                    })()}
                    <input
                      ref={customColorRef}
                      type="color"
                      className="sr-only"
                      value={bgFill && /^#[0-9a-fA-F]{6}$/.test(bgFill) ? bgFill : '#000000'}
                      onChange={(e) => setBgFill(e.target.value)}
                      disabled={!hasAlpha}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                    {hasAlpha
                      ? 'Replace the transparent background with a colour.'
                      : 'Remove the background first to replace it with a colour.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Redact faces — on-device face blur. Collapsed by default. */}
          <div>
            <button
              type="button"
              onClick={() => setFaceOpen((v) => !v)}
              aria-expanded={faceOpen}
              className="w-full flex items-center justify-between gap-2 py-1 group"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700">Redact faces</span>
              <span className="flex items-center gap-1.5">
                {faceBlurred && enabledFaceCount > 0 && (
                  <span className="text-[10px] uppercase tracking-wide bg-orange-50 text-orange-700 ring-1 ring-orange-200 rounded-full px-2 py-0.5 tabular-nums">
                    {enabledFaceCount} blurred
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={['text-slate-400 group-hover:text-slate-600 transition-transform', faceOpen ? 'rotate-90' : ''].join(' ')}
                >
                  ▶
                </span>
              </span>
            </button>
            {faceOpen && (
              <div className="mt-2">
                {!faceBoxes ? (
                  <button
                    type="button"
                    onClick={onDetectFaces}
                    disabled={detectingFaces}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 text-sm text-slate-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
                  >
                    <span aria-hidden="true">🙈</span>
                    <span className="flex-1 text-left">{detectingFaces ? 'Detecting faces…' : 'Detect & blur faces'}</span>
                    {!detectingFaces && <span className="text-[10px] uppercase tracking-wide text-slate-400">AI</span>}
                  </button>
                ) : faceBoxes.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-[11px] text-slate-500 leading-snug">No faces detected in this image.</p>
                    <button
                      type="button"
                      onClick={onDetectFaces}
                      disabled={detectingFaces}
                      className="mt-2 text-[11px] font-medium text-orange-700 hover:text-orange-900 disabled:opacity-60"
                    >
                      {detectingFaces ? 'Scanning…' : 'Scan again'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Redact / restore */}
                    {faceBlurred ? (
                      <button
                        type="button"
                        onClick={clearFaceBlur}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 bg-orange-50 text-sm text-orange-700 hover:bg-orange-100 transition-colors"
                      >
                        <span aria-hidden="true">↩</span>
                        <span className="flex-1 text-left">Remove blur</span>
                        <span className="text-[10px] uppercase tracking-wide text-orange-500">Undo</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyFaceBlur()}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 text-sm text-slate-700 transition-colors"
                      >
                        <span aria-hidden="true">🙈</span>
                        <span className="flex-1 text-left">Blur {faceBoxes.length} {faceBoxes.length === 1 ? 'face' : 'faces'}</span>
                      </button>
                    )}

                    {/* Style — blur vs pixelate */}
                    <div className="grid grid-cols-2 gap-2">
                      {(['blur', 'pixelate'] as const).map((style) => {
                        const isActive = faceBlurStyle === style
                        return (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setFaceBlurStyle(style)}
                            className={[
                              'py-1.5 rounded-lg border text-xs font-medium capitalize transition-colors',
                              isActive
                                ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500/30'
                                : 'border-slate-200 text-slate-600 hover:border-orange-400'
                            ].join(' ')}
                          >
                            {style}
                          </button>
                        )
                      })}
                    </div>

                    {/* Strength */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Strength</span>
                        <span className="tabular-nums">{faceBlurStrength}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={faceBlurStrength}
                        onChange={(e) => setFaceBlurStrength(Number(e.target.value))}
                        className="w-full accent-orange-600"
                      />
                    </div>

                    {/* Per-face toggles */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-600 mb-1.5">
                        Faces <span className="text-slate-400">— tap to keep one visible</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {faceBoxes.map((f, i) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setFaceEnabled(f.id, !f.enabled)}
                            aria-pressed={f.enabled}
                            title={f.enabled ? 'Blurred — tap to keep visible' : 'Visible — tap to blur'}
                            className={[
                              'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors',
                              f.enabled
                                ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500/30'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            ].join(' ')}
                          >
                            <span aria-hidden="true">{f.enabled ? '🙈' : '👁'}</span>
                            Face {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {faceError && !detectingFaces && (
                  <p className="mt-2 text-[11px] text-red-600 leading-snug">{faceError}</p>
                )}

                {!faceError && (
                  <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                    {detectingFaces
                      ? 'First use downloads a one-time face model (~2 MB), then it’s cached.'
                      : 'Detects and blurs faces entirely on your device — your image is never uploaded.'}
                  </p>
                )}
              </div>
            )}
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

          {/* Format & quality — expanded by default so the output format and
              quality are visible as soon as an image opens. Sits directly above
              Export so the output settings live next to the download button.
              The homepage "Convert" entry re-opens + highlights this section. */}
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
  // `previewUrl` carries the LAST good encoded preview through a recompute, so
  // changing a setting (format, quality, size) on a committed crop keeps showing
  // the cropped result instead of flashing the full source stretched to the crop
  // size. Null when the source image itself changed (nothing valid to hold).
  | { state: 'computing'; previewUrl: string | null }
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
  bgFill: string | null,
  enabled: boolean
): Estimate {
  const [estimate, setEstimate] = useState<Estimate>({ state: 'idle' })
  const sourceRef = useRef<{ url: string; image: HTMLImageElement } | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  // Geometry (image + crop region) the held preview was encoded for. A held
  // preview may only be shown through a recompute when the geometry is unchanged
  // (a pure format/quality/resolution change). If the crop is added, removed or
  // resized, the held preview is the WRONG shape for the new target, so we drop
  // it and fall back to the true source — e.g. removing a crop must not briefly
  // "zoom into" the old cropped preview stretched to full size.
  const geomKeyRef = useRef<string | null>(null)

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
  // Identity of the *shape* being previewed (source + crop region), independent
  // of output resolution/format/quality. Only when this is unchanged is a held
  // preview still valid to show during a recompute.
  const geomKey = surl === null ? null : `${surl}|${cx},${cy},${cw},${ch}`

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
    geomKeyRef.current = null
    // Source identity changed — no valid preview to hold, so computing carries null.
    setEstimate((prev) => (prev.state === 'idle' ? prev : { state: 'computing', previewUrl: null }))
  }, [surl])

  useEffect(() => {
    if (!enabled || !selected || !target) {
      setEstimate({ state: 'idle' })
      return
    }
    let cancelled = false
    // Hold the last good preview through the recompute ONLY when the crop
    // geometry is unchanged (a format/quality/resolution tweak) — so a committed
    // crop doesn't blink to the full source, but adding/removing/resizing the
    // crop drops the now-wrong-shape held preview instead of flashing it.
    const held = geomKeyRef.current === geomKey ? previewUrlRef.current : null
    setEstimate({ state: 'computing', previewUrl: held })
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
          target.allowTransparency,
          bgFill
        )
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
        geomKeyRef.current = geomKey
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
  }, [enabled, surl, tw, th, tf, tq, ta, cx, cy, cw, ch, bgFill])

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
  // Whether the active crop has been accepted. While a crop is being edited
  // (set but not committed) the encoded-output preview below is hidden, so it
  // can't peek out from behind the full-size source the CropOverlay draws.
  const [committed, setCommitted] = useState(false)
  useEffect(() => {
    if (!crop) setCommitted(false)
  }, [crop])

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
          {/* Encoded-output preview at the TARGET size. Hidden while a crop is
              being edited — the CropOverlay draws the full-size source then, and
              showing both at once made the target-size preview peek out behind
              it ("two overlapping images"). Shown again once the crop is
              committed, so the cropped result previews through. */}
          {(!crop || committed) && (
            <div className="relative flex flex-1 min-h-0 items-center justify-center p-6">
              <img
                src={previewUrl ?? image.objectUrl}
                alt={image.name}
                draggable={false}
                style={{ width: displayW, height: displayH }}
                className="block object-fill shadow-lg ring-1 ring-slate-200 bg-white"
              />
            </div>
          )}
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
          <CropOverlay
            image={image}
            crop={crop}
            onChange={onSetCrop}
            committed={committed}
            onCommittedChange={setCommitted}
          />
        </>
      )}
    </div>
  )
}
