import { useImageStore } from '../../stores/imageStore'
import { formatBytes } from '../../lib/imageResize'

interface Props {
  /** Full-screen overlay mode used on mobile. */
  mobileExpanded?: boolean
  /** Called after an image is selected (mobile) or when "Done" is tapped. */
  onBack?: () => void
}

export default function ImageGrid({ mobileExpanded = false, onBack }: Props) {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const selectImage = useImageStore((s) => s.selectImage)
  const removeImage = useImageStore((s) => s.removeImage)

  if (images.length === 0) return null

  function handleSelect(id: string) {
    selectImage(id)
    if (mobileExpanded) onBack?.()
  }

  if (mobileExpanded) {
    return (
      <div className="flex flex-col flex-1 bg-white overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-white sticky top-0 z-10 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
            {images.length} image{images.length === 1 ? '' : 's'}
          </span>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold text-orange-700 hover:text-orange-800 px-2 py-1 rounded-md hover:bg-orange-50 transition-colors"
            >
              Done
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          <ul className="grid grid-cols-2 gap-3 p-3">
            {images.map((img) => {
              const isSelected = img.id === selectedId
              return (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(img.id)}
                    className={[
                      'group relative w-full rounded-xl border-2 overflow-hidden text-left transition-all',
                      isSelected
                        ? 'border-orange-500 shadow-md shadow-orange-500/20'
                        : 'border-slate-200 hover:border-orange-300'
                    ].join(' ')}
                  >
                    <div className="checker-bg aspect-square w-full">
                      <img
                        src={img.objectUrl}
                        alt={img.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-2 py-2 bg-white border-t border-slate-100">
                      <div className="truncate text-xs font-medium text-slate-700">{img.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {img.width}×{img.height} · {formatBytes(img.bytes)}
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${img.name}`}
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault(); e.stopPropagation(); removeImage(img.id)
                        }
                      }}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-slate-900/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-all cursor-pointer"
                    >
                      ✕
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }

  // Desktop sidebar
  return (
    <div className="border-r border-slate-200 bg-white w-44 shrink-0 overflow-y-auto">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 font-medium border-b border-slate-100 sticky top-0 bg-white z-10">
        {images.length} image{images.length === 1 ? '' : 's'}
      </div>
      <ul className="p-2 space-y-2">
        {images.map((img) => {
          const isSelected = img.id === selectedId
          return (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => selectImage(img.id)}
                className={[
                  'group relative w-full rounded-lg border-2 overflow-hidden text-left transition-all',
                  isSelected
                    ? 'border-orange-500 shadow-md shadow-orange-500/20'
                    : 'border-slate-200 hover:border-orange-300'
                ].join(' ')}
              >
                <div className="checker-bg aspect-square w-full">
                  <img
                    src={img.objectUrl}
                    alt={img.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                  <div className="truncate text-xs font-medium text-slate-700">{img.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {img.width}×{img.height} · {formatBytes(img.bytes)}
                  </div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${img.name}`}
                  onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault(); e.stopPropagation(); removeImage(img.id)
                    }
                  }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-all cursor-pointer"
                >
                  ✕
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
