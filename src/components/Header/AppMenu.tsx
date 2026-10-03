import { useState } from 'react'
import { AdvancedMenu, MENU, useCloseAppMenu, useFileDrop, type AboutAppConfig } from '@unisim/sdk'
// Generated — `npm run credits` after any dependency change. Never edit it by
// hand: it is read off the installed tree, so a hand-kept list drifts from the
// lockfile the first time anyone upgrades anything, and a credits list naming a
// package we removed is worse than no list at all.
import credits from '../../generated/credits.json'
import { KNOWLEDGE_BASE } from '../../knowledge'
import { useImageStore } from '../../stores/imageStore'
import { useThemeStore } from '../../stores/themeStore'

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
// passed only once an image was open) — "Open images…" is how the landing page
// is reached from the menu too.
//
// Grouped (James, 2026-10-04): File ▸ Add more images / Make a collage, then
// Clear all images, then Advanced ▸ Metadata / Knowledge base. Advanced is the
// SDK's own <AdvancedMenu>, drawn HERE rather than by the navbar's
// `knowledgeBase` prop, because that is the only way to put Metadata in it —
// so App.tsx no longer passes `knowledgeBase` (two Advanced sections otherwise).
//
// There is no Appearance section here any more. Since SDK 0.143 the colour
// scheme is a Global preference with a per-app override in the SDK's own App
// preferences dialog (App.tsx passes `themeStore`), so a second copy of the
// control here would be a second place to disagree with it.

type Tint = { bg: string; fg: string }
type Palette = {
  rest: string
  sub: string
  faint: string
  divider: string
  sectionBg: string
  count: string
  warn: string
  tints: { add: Tint; meta: Tint; danger: Tint }
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
    faint: MENU.light.faint,
    divider: MENU.light.divider,
    sectionBg: MENU.light.rowHover,
    count: '#94a3b8',
    warn: '#d97706',
    tints: {
      add: { bg: '#ecfdf5', fg: '#047857' },
      meta: { bg: '#fffbeb', fg: '#92400e' },
      danger: { bg: '#fef2f2', fg: '#b91c1c' },
    },
  },
  dark: {
    rest: MENU.dark.body,
    sub: MENU.dark.faint,
    faint: MENU.dark.faint,
    divider: MENU.dark.divider,
    sectionBg: MENU.dark.rowHover,
    count: MENU.dark.faint,
    warn: '#fbbf24',
    tints: {
      add: { bg: 'rgba(16,185,129,0.16)', fg: '#6ee7b7' },
      meta: { bg: 'rgba(245,158,11,0.16)', fg: '#fcd34d' },
      danger: { bg: MENU.dark.dangerHoverBg, fg: MENU.dark.dangerHoverText },
    },
  },
}

// "About this app" — handed to <UniversalAppsNavBar about={…}> in App.tsx.
// Since SDK 0.161 the SDK draws the row at the foot of "Tune this app" and opens
// its own AboutAppDialog, so it no longer sits in this actions menu.
export const ABOUT: AboutAppConfig = {
  repo:    'https://github.com/universal-simulation-ltd/Universal_Images',
  proof:   'https://github.com/universal-simulation-ltd/Universal_Images/blob/main/PRIVACY.md',
  subject: 'Your images',
  plural:  true,
  except:  'backup',
  version: __APP_VERSION__,
  credits,
  noticesHref: 'https://github.com/universal-simulation-ltd/Universal_Images/blob/main/THIRD-PARTY-NOTICES.md',
}

export default function AppMenu() {
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const metadataMap = useImageStore((s) => s.metadata)
  const setMetadataOpen = useImageStore((s) => s.setMetadataOpen)
  const setCollageOpen = useImageStore((s) => s.setCollageOpen)
  const addFiles = useImageStore((s) => s.addFiles)
  const clearAll = useImageStore((s) => s.clearAll)
  const theme = useThemeStore((s) => s.effective)
  // The rows below are rendered INSIDE the SDK's Actions dropdown, which is
  // portaled to <body> at the top of the z stack — well above our own dialogs
  // at z-1100. So a row that opens a screen has to dismiss the menu itself, or
  // the menu is left sitting over the thing it just opened (James, 2026-09-18,
  // about Metadata). A no-op outside a menu, so it is safe to call blind.
  const closeMenu = useCloseAppMenu()
  const p = PALETTE[theme]
  // Collapsed by default, like the SDK's Advanced beside it.
  const [fileOpen, setFileOpen] = useState(false)
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

      <SectionHeader label="File" open={fileOpen} onToggle={() => setFileOpen((v) => !v)} palette={p} />
      {fileOpen && (
        <div style={{ borderTop: `1px solid ${p.divider}`, background: p.sectionBg }}>
          <MenuRow
            icon="🖼"
            indent
            palette={p}
            tint={p.tints.add}
            onClick={picker.open}
            label={hasImages ? 'Add more images…' : 'Open images…'}
          />

          {hasImages && (
            <MenuRow
              icon="🧩"
              indent
              palette={p}
              tint={p.tints.add}
              onClick={() => { closeMenu(); setCollageOpen(true) }}
              label="Make a collage…"
              sub="Photos side by side, one above the other, or in a grid"
            />
          )}
        </div>
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

      <AdvancedMenu knowledgeBase={KNOWLEDGE_BASE} theme={theme}>
        {hasImages && selectedId && (
          <MenuRow
            icon="🏷"
            indent
            palette={p}
            tint={p.tints.meta}
            onClick={() => { closeMenu(); setMetadataOpen(true) }}
            label="Metadata"
            sub={selectedMeta
              ? 'See where and when this photo was taken — then scrub it'
              : 'Check what this photo reveals about you'}
            trailing={selectedMeta && selectedMeta.identifyingCount > 0
              ? <span style={{ flexShrink: 0, color: p.warn }} title="Can identify you" aria-hidden>⚠</span>
              : null}
          />
        )}
      </AdvancedMenu>
    </>
  )
}

function MenuRow({
  icon,
  label,
  sub,
  trailing,
  indent,
  palette,
  tint,
  onClick,
}: {
  icon: string
  /** Inside a section: the SDK's Advanced rows' 24px left inset. */
  indent?: boolean
  label: string
  sub?: string
  trailing?: React.ReactNode
  palette: Palette
  tint: Tint
  onClick: () => void
}) {
  const restBg = 'transparent'
  const restFg = palette.rest
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
        padding:    indent ? '8px 14px 8px 24px' : '8px 14px',
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

// A collapsible section header, drawn to match the SDK's <AdvancedMenu> header
// (same rule above, same chevron) so File and Advanced read as a pair.
function SectionHeader({
  label,
  open,
  onToggle,
  palette,
}: {
  label: string
  open: boolean
  onToggle: () => void
  palette: Palette
}) {
  return (
    <button
      type="button"
      aria-haspopup="true"
      aria-expanded={open}
      onClick={onToggle}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        width:      '100%',
        padding:    '8px 14px',
        fontSize:   13,
        fontFamily: 'inherit',
        border:     0,
        background: 'transparent',
        color:      palette.rest,
        cursor:     'pointer',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = palette.sectionBg }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <span aria-hidden style={{ display: 'inline-flex' }}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      </span>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      <svg
        viewBox="0 0 12 12"
        width="11"
        height="11"
        aria-hidden="true"
        style={{
          flexShrink: 0,
          color: palette.faint,
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 150ms',
        }}
      >
        <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
