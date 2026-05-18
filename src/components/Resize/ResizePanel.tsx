import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useImageStore } from '../../stores/imageStore'
import {
  computePresets,
  formatBytes,
  formatFilename,
  loadImage,
  resizeAndEncode
} from '../../lib/imageResize'
import { downloadBlob } from '../../lib/download'
import { groupedPresets } from '../../lib/socialPresets'
import CropOverlay from './CropOverlay'
import type { OutputFormat, PresetSize } from '../../types/image'

const FORMAT_LABEL: Record<OutputFormat, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP'
}

export default function ResizePanel() {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const target = useImageStore((s) => s.target)
  const setTarget = useImageStore((s) => s.setTarget)
  const resetTargetToSelected = useImageStore((s) => s.resetTargetToSelected)
  const cropMode = useImageStore((s) => s.cropMode)
  const setCropMode = useImageStore((s) => s.setCropMode)
  const applyCrop = useImageStore((s) => s.applyCrop)

  const selected = useMemo(
    () => images.find((i) => i.id === selectedId) ?? null,
    [images, selectedId]
  )

  const [exporting, setExporting] = useState(false)
  const [batchExporting, setBatchExporting] = useState(false)
  const [cropApplying, setCropApplying] = useState(false)
  const [lastResult, setLastResult] = useState<{ bytes: number; width: number; height: number } | null>(null)

  if (!selected || !target) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Select an image to resize.
      </div>
    )
  }

  const presets = computePresets(selected.width, selected.height)
  const aspect = selected.width / selected.height

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

  function applySocialPreset(w: number, h: number) {
    // Social presets have specific aspects that almost never match the source.
    // Unlock aspect so the user gets exactly the target dimensions.
    setTarget({ width: w, height: h, aspectLocked: false })
  }

  async function commitCrop(rect: { x: number; y: number; width: number; height: number }) {
    setCropApplying(true)
    try {
      await applyCrop(rect)
    } catch (err) {
      console.error(err)
      alert(`Crop failed: ${(err as Error).message}`)
    } finally {
      setCropApplying(false)
    }
  }

  async function exportSelected() {
    if (exporting || !selected || !target) return
    setExporting(true)
    try {
      const { image, objectUrl } = await loadImage(selected.file)
      try {
        const blob = await resizeAndEncode(image, target.width, target.height, target.format, target.quality)
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
          if (target.aspectLocked) {
            const longTarget = Math.max(target.width, target.height)
            const longSrc = Math.max(img.width, img.height)
            const ratio = Math.min(1, longTarget / longSrc)
            w = Math.max(1, Math.round(img.width * ratio))
            h = Math.max(1, Math.round(img.height * ratio))
          }
          const blob = await resizeAndEncode(image, w, h, target.format, target.quality)
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

  return (
    <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col bg-slate-100 min-h-0">
        <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-3 text-xs text-slate-500">
          <span className="font-medium text-slate-700 truncate">{selected.name}</span>
          <span>·</span>
          <span>{selected.width} × {selected.height} px</span>
          <span>·</span>
          <span>{formatBytes(selected.bytes)}</span>
          {cropMode && (
            <span className="ml-auto inline-flex items-center gap-1 text-orange-700 bg-orange-50 ring-1 ring-orange-200 rounded-full px-2 py-0.5 text-[11px] font-medium">
              <span aria-hidden="true">✂</span> Cropping
            </span>
          )}
        </div>
        <PreviewArea
          image={selected}
          targetW={target.width}
          targetH={target.height}
          cropMode={cropMode}
          cropApplying={cropApplying}
          onCommitCrop={commitCrop}
          onCancelCrop={() => setCropMode(false)}
        />
      </div>

      <div className="border-l border-slate-200 bg-white overflow-y-auto">
        <div className="p-5 space-y-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Crop</h2>
            {!cropMode ? (
              <button
                type="button"
                onClick={() => setCropMode(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 text-sm text-slate-700 transition-colors"
              >
                <span aria-hidden="true">✂</span>
                <span className="flex-1 text-left">Crop image…</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">drag</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCropMode(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 bg-orange-50 text-sm text-orange-700 transition-colors"
              >
                <span aria-hidden="true">✕</span>
                <span className="flex-1 text-left">Cancel crop</span>
                <span className="text-[10px] uppercase tracking-wide text-orange-500">Esc</span>
              </button>
            )}
            <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
              Drag on the image to pick an area. Enter to apply, Esc to cancel.
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
                const isActive = presetMatch === p
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
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Social media</h2>
            <div className="space-y-2.5">
              {social.map((g) => (
                <div key={g.group}>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{g.group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((p) => {
                      const isActive = target.width === p.width && target.height === p.height
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
            </div>
            <p className="mt-2 text-[11px] text-slate-400 leading-snug">
              Tip: crop first to control which part of your photo fills the preset.
            </p>
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

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Format</h2>
            <div className="grid grid-cols-3 gap-2">
              {(['image/jpeg', 'image/webp', 'image/png'] as OutputFormat[]).map((f) => {
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
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={exportSelected}
              disabled={exporting}
              className="w-full h-10 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm disabled:opacity-60 disabled:cursor-wait transition-colors"
            >
              {exporting ? 'Exporting…' : `Download ${target.width}×${target.height}`}
            </button>
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

interface PreviewAreaProps {
  image: import('../../types/image').SourceImage
  targetW: number
  targetH: number
  cropMode: boolean
  cropApplying: boolean
  onCommitCrop: (rect: { x: number; y: number; width: number; height: number }) => void
  onCancelCrop: () => void
}

/**
 * Preview pane: shows the image at the *target* output dimensions when not
 * cropping, fitting to the container when the target is larger than the
 * available space. A small chip in the corner reports whether the preview
 * is showing the image at 100% or at a shrunk fraction of the actual output.
 */
function PreviewArea({ image, targetW, targetH, cropMode, cropApplying, onCommitCrop, onCancelCrop }: PreviewAreaProps) {
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
    ? Math.min(1, Math.min(availW / targetW, availH / targetH))
    : 1
  const displayW = Math.max(1, Math.round(targetW * fitScale))
  const displayH = Math.max(1, Math.round(targetH * fitScale))
  const pct = Math.round(fitScale * 100)

  return (
    <div ref={wrapperRef} className="relative flex-1 min-h-[55vh] lg:min-h-0 overflow-hidden checker-bg">
      {cropMode ? (
        <CropOverlay image={image} onCommit={onCommitCrop} onCancel={onCancelCrop} />
      ) : (
        <>
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <img
              src={image.objectUrl}
              alt={image.name}
              draggable={false}
              style={{ width: displayW, height: displayH }}
              className="block object-fill shadow-lg ring-1 ring-slate-200 bg-white"
            />
          </div>
          <div className="absolute bottom-3 right-3 pointer-events-none flex items-center gap-2">
            <span className="bg-slate-900/85 text-white text-[11px] font-medium tabular-nums px-2 py-1 rounded-md">
              {targetW} × {targetH}
            </span>
            <span
              className={[
                'text-[11px] font-medium tabular-nums px-2 py-1 rounded-md',
                pct >= 100
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-900/85 text-white'
              ].join(' ')}
              title={pct >= 100 ? 'Showing at actual pixel size' : 'Scaled to fit the preview area'}
            >
              {pct >= 100 ? '1:1' : `${pct}%`}
            </span>
          </div>
        </>
      )}
      {cropApplying && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm text-slate-600">
          Cropping…
        </div>
      )}
    </div>
  )
}
