import { useImageStore } from '../../stores/imageStore'
import { formatBytes } from '../../lib/imageResize'

export default function ImageGrid() {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const selectImage = useImageStore((s) => s.selectImage)
  const removeImage = useImageStore((s) => s.removeImage)

  if (images.length === 0) return null

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
                  onClick={(e) => {
                    e.stopPropagation()
                    removeImage(img.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      removeImage(img.id)
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
