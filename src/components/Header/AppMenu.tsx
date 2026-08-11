import { useFileDrop } from '@unisim/sdk'
import { useImageStore } from '../../stores/imageStore'

// The per-app actions that slot into <UniversalAppsNavBar />'s `actions` prop —
// ROWS ONLY, no trigger and no panel of its own. The SDK renders them inside the
// merged profile pill, so the bar carries one dropdown on the right rather than
// an Actions button on the left and an avatar on the right.
//
// Styling is inline rather than Tailwind to match the SDK dropdown's own rows
// (the same 8px/14px rhythm and 13px label the profile and language rows use) —
// these render inside SDK chrome, not ours. The per-row hover tints are kept
// from the old panel: green for "add", amber for metadata, red for the
// destructive one.
export default function AppMenu() {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const metadataMap = useImageStore((s) => s.metadata)
  const setMetadataOpen = useImageStore((s) => s.setMetadataOpen)
  const addFiles = useImageStore((s) => s.addFiles)
  const clearAll = useImageStore((s) => s.clearAll)
  const hasImages = images.length > 0
  // Unlike the badge above the preview, this entry stays visible whether or not
  // metadata was found — "is there anything in this photo?" is a question worth
  // being able to ask, and a clean answer is a useful one.
  const selectedMeta = selectedId ? metadataMap[selectedId] ?? null : null

  // A menu row, not a drop target — only the input and `open()` are used. The
  // SDK owns the mechanics so this picker behaves like every other one in the
  // suite, re-picking the same file included.
  const picker = useFileDrop({
    onFiles: addFiles,
    accept: 'image/*,.heic,.heif',
    clickToBrowse: false,
  })

  return (
    <>
      <input {...picker.inputProps} hidden />

      <MenuRow
        icon="🖼"
        tint={TINTS.add}
        onClick={picker.open}
        label={hasImages ? 'Add more images…' : 'Open images…'}
      />

      {hasImages && selectedId && (
        <MenuRow
          icon="🏷"
          tint={TINTS.meta}
          onClick={() => setMetadataOpen(true)}
          label="Metadata"
          sub={selectedMeta
            ? 'See where and when this photo was taken — then scrub it'
            : 'Check what this photo reveals about you'}
          trailing={selectedMeta && selectedMeta.identifyingCount > 0
            ? <span style={{ flexShrink: 0, color: '#d97706' }} title="Can identify you" aria-hidden>⚠</span>
            : null}
        />
      )}

      {hasImages && (
        <MenuRow
          icon="🗑"
          tint={TINTS.danger}
          onClick={() => { if (confirm('Remove all images?')) clearAll() }}
          label="Clear all images"
          trailing={
            <span style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
              {images.length}
            </span>
          }
        />
      )}
    </>
  )
}

const TINTS = {
  add:    { bg: '#ecfdf5', fg: '#047857' },
  meta:   { bg: '#fffbeb', fg: '#92400e' },
  danger: { bg: '#fef2f2', fg: '#b91c1c' },
} as const

const REST_COLOR = '#374151'

function MenuRow({
  icon,
  label,
  sub,
  trailing,
  tint,
  onClick,
}: {
  icon: string
  label: string
  sub?: string
  trailing?: React.ReactNode
  tint: { bg: string; fg: string }
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        width:      '100%',
        padding:    '8px 14px',
        fontSize:   13,
        fontFamily: 'inherit',
        textAlign:  'left',
        border:     0,
        background: 'transparent',
        color:      REST_COLOR,
        cursor:     'pointer',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tint.bg
        e.currentTarget.style.color = tint.fg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = REST_COLOR
      }}
    >
      <span aria-hidden>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
        {sub && (
          <span style={{ display: 'block', fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>
            {sub}
          </span>
        )}
      </span>
      {trailing}
    </button>
  )
}
