import { AdvancedMenu, MENU, useFileDrop } from '@unisim/sdk'
// Generated — `npm run credits` after any dependency change. Never edit it by
// hand: it is read off the installed tree, so a hand-kept list drifts from the
// lockfile the first time anyone upgrades anything, and a credits list naming a
// package we removed is worse than no list at all.
import credits from '../../generated/credits.json'
import { useImageStore } from '../../stores/imageStore'
import { useThemeStore, type ThemePref } from '../../stores/themeStore'

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
//
// ⚠️ The SDK paints the dropdown dark when the bar's `theme` is dark, but it
// cannot reach these rows — they are ours. So every colour below comes from
// `PALETTE[theme]`, never a bare hex: a light-only #374151 label on the dark
// panel is unreadable, and it looks fine until somebody switches.
//
// ⚠️ Rendered in EVERY state, the empty landing page included (it used to be
// passed only once an image was open). The theme lives here, and a control you
// can only reach after opening a photo is not a setting.

const THEMES: { pref: ThemePref; label: string; glyph: string }[] = [
  { pref: 'light', label: 'Light', glyph: '☀️' },
  { pref: 'dark', label: 'Dark', glyph: '🌙' },
  // 'system' is offered but is deliberately NOT the default — see themeStore.
  { pref: 'system', label: 'Match my device', glyph: '🖥️' },
]

type Tint = { bg: string; fg: string }
type Palette = {
  rest: string
  sub: string
  count: string
  warn: string
  label: string
  tints: { add: Tint; meta: Tint; danger: Tint; pick: Tint }
}

// ⚠️ LIGHT is the exact set of colours these rows have always had — not
// `MENU.light`, whose `body` is #334155 where these were #374151. Light must not
// move by a shade. DARK is read from the SDK's own panel palette, so the rows
// sit on the dropdown they are rendered in; the three tints get dark pairs of
// the same hue, lifted to pass AA on that panel.
const PALETTE: Record<'light' | 'dark', Palette> = {
  light: {
    rest: '#374151',
    sub: '#64748b',
    count: '#94a3b8',
    warn: '#d97706',
    label: MENU.light.muted,
    tints: {
      add: { bg: '#ecfdf5', fg: '#047857' },
      meta: { bg: '#fffbeb', fg: '#92400e' },
      danger: { bg: '#fef2f2', fg: '#b91c1c' },
      pick: { bg: MENU.light.accentBg, fg: MENU.light.accentText },
    },
  },
  dark: {
    rest: MENU.dark.body,
    sub: MENU.dark.faint,
    count: MENU.dark.faint,
    warn: '#fbbf24',
    label: MENU.dark.muted,
    tints: {
      add: { bg: 'rgba(16,185,129,0.16)', fg: '#6ee7b7' },
      meta: { bg: 'rgba(245,158,11,0.16)', fg: '#fcd34d' },
      danger: { bg: MENU.dark.dangerHoverBg, fg: MENU.dark.dangerHoverText },
      pick: { bg: MENU.dark.accentBg, fg: MENU.dark.accentText },
    },
  },
}

export default function AppMenu() {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const metadataMap = useImageStore((s) => s.metadata)
  const setMetadataOpen = useImageStore((s) => s.setMetadataOpen)
  const addFiles = useImageStore((s) => s.addFiles)
  const clearAll = useImageStore((s) => s.clearAll)
  const theme = useThemeStore((s) => s.effective)
  const pref = useThemeStore((s) => s.pref)
  const setPref = useThemeStore((s) => s.setPref)
  const p = PALETTE[theme]
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
        palette={p}
        tint={p.tints.add}
        onClick={picker.open}
        label={hasImages ? 'Add more images…' : 'Open images…'}
      />

      {hasImages && selectedId && (
        <MenuRow
          icon="🏷"
          palette={p}
          tint={p.tints.meta}
          onClick={() => setMetadataOpen(true)}
          label="Metadata"
          sub={selectedMeta
            ? 'See where and when this photo was taken — then scrub it'
            : 'Check what this photo reveals about you'}
          trailing={selectedMeta && selectedMeta.identifyingCount > 0
            ? <span style={{ flexShrink: 0, color: p.warn }} title="Can identify you" aria-hidden>⚠</span>
            : null}
        />
      )}

      {hasImages && (
        <MenuRow
          icon="🗑"
          palette={p}
          tint={p.tints.danger}
          onClick={() => { if (confirm('Remove all images?')) clearAll() }}
          label="Clear all images"
          trailing={
            <span style={{ fontSize: 11, color: p.count, fontVariantNumeric: 'tabular-nums' }}>
              {images.length}
            </span>
          }
        />
      )}

      {/* The theme. Picking one leaves the menu open, so the change is seen
          happening — the panel itself is the first thing that turns. */}
      <MenuLabel color={p.label}>Appearance</MenuLabel>
      {THEMES.map((t) => (
        <MenuRow
          key={t.pref}
          icon={t.glyph}
          palette={p}
          tint={p.tints.pick}
          label={t.label}
          selected={pref === t.pref}
          radio
          onClick={() => setPref(t.pref)}
          trailing={pref === t.pref ? <span aria-hidden style={{ color: p.tints.pick.fg }}>✓</span> : null}
        />
      ))}

      {/* Advanced — the SDK's own category, so every app in the suite has one
          in the same place with the same rhythm, and so whatever goes in it
          next is one change rather than nineteen. "About this app" is always
          its last row; see AdvancedMenu.tsx. `theme` is the RESOLVED one, the
          same value the nav bar gets. */}
      <AdvancedMenu
        theme={theme}
        about={{
          repo:    'https://github.com/universal-simulation-ltd/Universal_Images',
          proof:   'https://github.com/universal-simulation-ltd/Universal_Images/blob/main/PRIVACY.md',
          subject: 'Your images',
          plural:  true,
          except:  'backup',
          version: __APP_VERSION__,
          credits,
          noticesHref: 'https://github.com/universal-simulation-ltd/Universal_Images/blob/main/THIRD-PARTY-NOTICES.md',
        }}
      />
    </>
  )
}

function MenuLabel({ children, color }: { children: string; color: string }) {
  return (
    <div
      style={{
        padding: '8px 14px 4px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </div>
  )
}

function MenuRow({
  icon,
  label,
  sub,
  trailing,
  palette,
  tint,
  selected = false,
  radio = false,
  onClick,
}: {
  icon: string
  label: string
  sub?: string
  trailing?: React.ReactNode
  palette: Palette
  tint: Tint
  selected?: boolean
  /** One of a set where exactly one is chosen — the Appearance rows. */
  radio?: boolean
  onClick: () => void
}) {
  const restBg = selected ? tint.bg : 'transparent'
  const restFg = selected ? tint.fg : palette.rest
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? selected : undefined}
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
        background: restBg,
        color:      restFg,
        cursor:     'pointer',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tint.bg
        e.currentTarget.style.color = tint.fg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = restBg
        e.currentTarget.style.color = restFg
      }}
    >
      <span aria-hidden>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
        {sub && (
          <span style={{ display: 'block', fontSize: 11, color: palette.sub, lineHeight: 1.3 }}>
            {sub}
          </span>
        )}
      </span>
      {trailing}
    </button>
  )
}
