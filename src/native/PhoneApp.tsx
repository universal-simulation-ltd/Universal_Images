import { useFileDrop } from '@unisim/sdk'
import { ABOUT } from '../components/Header/AppMenu'
import EditShortcuts from '../components/Header/EditShortcuts'
import ProductLogo from '../components/Header/ProductLogo'
import { loadArticles } from '../knowledge'
import { useImageStore } from '../stores/imageStore'
import { useThemeStore } from '../stores/themeStore'
import { usePhoneNav } from './nav'
import { ask, Row } from './parts'
import { PhoneBar, PhoneLayers, type PhoneAppInfo } from './screens'
import { useNT } from './strings'

// Universal Images's phone chrome (iOS and Android). On the website the navbar
// holds the Actions dropdown (File ▸ Open images / Make a collage, Clear all
// images, Advanced ▸ Metadata / Knowledge base), the Tune this app dialog and
// About. On the phone the bar is the light bar, the mark and ⋯ (with an image
// open, the quick edits sit beside ⋯ as they do in the website's bar); ⋯ is a
// bottom sheet with the same rows, and Tune this app, the guides and About are
// pages. "Clear all images" asks in a sheet, not the browser's confirm().

const APP: PhoneAppInfo = {
  name: 'Universal Images',
  logo: <ProductLogo />,
  about: ABOUT,
  themeStore: useThemeStore,
  loadArticles,
}

export function ImagesPhoneBar() {
  const hasImages = useImageStore((s) => s.images.length > 0)
  return (
    <PhoneBar
      app={APP}
      // With an image open the bar is the editor's toolbar: the mark alone,
      // and the quick edits beside ⋯.
      left={hasImages ? <span className="flex shrink-0 items-center">{APP.logo}</span> : undefined}
      centre={hasImages ? <EditShortcuts /> : undefined}
    />
  )
}

export function ImagesPhoneLayers() {
  const t = useNT()
  const images = useImageStore((s) => s.images)
  const selectedId = useImageStore((s) => s.selectedId)
  const metadataMap = useImageStore((s) => s.metadata)
  const addFiles = useImageStore((s) => s.addFiles)
  const clearAll = useImageStore((s) => s.clearAll)
  const { setMetadataOpen, setCollageOpen } = useImageStore.getState()
  const closeMore = usePhoneNav((s) => s.closeMore)
  const hasImages = images.length > 0
  const selectedMeta = selectedId ? metadataMap[selectedId] ?? null : null

  // Mounted with the chrome, not inside the sheet: the sheet closes as the
  // phone's picker opens, and the input must outlive it.
  const picker = useFileDrop({
    onFiles: addFiles,
    accept: 'image/*,.heic,.heif',
    clickToBrowse: false,
  })

  return (
    <>
      <input {...picker.inputProps} hidden />
      <PhoneLayers
        app={APP}
        actions={
          <>
            <Row
              icon="🖼"
              label={t(hasImages ? 'app.add_images' : 'app.open_images')}
              chevron={false}
              onClick={() => {
                picker.open()
                closeMore()
              }}
            />
            {hasImages && (
              <Row
                icon="🧩"
                label={t('app.collage')}
                sub={t('app.collage_sub')}
                onClick={() => {
                  closeMore()
                  setCollageOpen(true)
                }}
              />
            )}
            {hasImages && selectedId && (
              <Row
                icon="🏷"
                label={t('app.metadata')}
                sub={t(selectedMeta ? 'app.metadata_found' : 'app.metadata_check')}
                value={selectedMeta && selectedMeta.identifyingCount > 0 ? <span className="text-amber-600 dark:text-amber-400">⚠</span> : undefined}
                onClick={() => {
                  closeMore()
                  setMetadataOpen(true)
                }}
              />
            )}
            {hasImages && (
              <Row
                icon="🗑"
                label={t('app.clear_all')}
                danger
                chevron={false}
                value={<span className="tabular-nums">{images.length}</span>}
                onClick={async () => {
                  closeMore()
                  if (await ask(t('app.clear_confirm'), t('app.clear_yes'))) clearAll()
                }}
              />
            )}
          </>
        }
        // Images has no settings of its own: Reset to defaults is the SDK's
        // half (language, colour scheme, default views).
        onReset={() => {}}
      />
    </>
  )
}
