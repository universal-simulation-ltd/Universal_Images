// Hosted-backup object paths — the "object not found" regression.
//
//   npm run test:hosted-paths
//
// Runs under Node's type-stripping, so `hostedPaths.ts` is imported directly.
// ⚠️ That is why that module imports NOTHING: type-stripping cannot resolve the
// SDK or the zustand stores, and any import of theirs would take this red for a
// reason unrelated to paths.
//
// What is being pinned. `hosted_uploads` grants members SELECT and no UPDATE
// (migration 0041), so the old store flow's third step — reserve with
// `storage_path: 'pending'`, upload, then UPDATE the row with the real path —
// matched zero rows and reported success. Every backup's ledger row therefore
// said `pending`, and opening one asked storage for an object of that name.
//
// The bytes were never lost: the uploader's path was fully determined by the
// row's own `org_id`, `id` and `file_name`. These tests hold that
// reconstruction exact — it is the only thing standing between a user and the
// backups already filed that way — and hold the new flow to naming the object
// before the token is reserved, so no such row is ever written again.
//
// Negative control (2026-08-27, run): reverting `hostedImagePathCandidates` to
// `[upload.storage_path]` turns 3 of these red — both legacy-recovery cases and
// the recorded-path-first ordering. If a future edit makes them all pass
// trivially, that is the thing to check first.

import {
  hostedImagePath,
  hostedImagePathCandidates,
  isUsableStoragePath,
  newObjectId,
  safeName,
  PENDING_PATH,
} from '../src/lib/hostedPaths.ts'

let pass = 0
let fail = 0
const eq = (actual, expected, label) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    pass++
    console.log(`  ok   ${label}  -> ${a}`)
  } else {
    fail++
    console.log(`  FAIL ${label}\n       expected ${e}\n       actual   ${a}`)
  }
}

const ORG = '11111111-1111-4111-8111-111111111111'
const UPLOAD = '22222222-2222-4222-8222-222222222222'

console.log('safeName (must not drift — legacy paths are rebuilt from it):')
eq(safeName('Holiday Snap-1920x1080.jpg'), 'holiday-snap-1920x1080.jpg', 'slug + the real extension')
eq(safeName('PHOTO.PNG'), 'photo.png', 'extension lowercased')
eq(safeName('!!!.webp'), 'image.webp', 'a name with nothing usable falls back')
eq(safeName('no-extension'), 'no-extension.png', 'a name with no dot gets .png, as it always did')
eq(safeName(null), 'image.png', 'no name at all')

console.log('\nhostedImagePath (org id first — every storage policy reads segment 1):')
eq(
  hostedImagePath(ORG, UPLOAD, 'Holiday Snap-1920x1080.jpg'),
  `${ORG}/images/${UPLOAD}-holiday-snap-1920x1080.jpg`,
  'org / product / id-slug.ext',
)
eq(hostedImagePath(ORG, UPLOAD, null).startsWith(`${ORG}/`), true, 'always rooted at the org')

console.log('\nisUsableStoragePath (what may be handed to storage as-is):')
eq(isUsableStoragePath(`${ORG}/images/x-photo.png`, ORG), true, 'a real path')
eq(isUsableStoragePath(PENDING_PATH, ORG), false, "the 'pending' placeholder is not a path")
eq(isUsableStoragePath('', ORG), false, 'empty')
eq(isUsableStoragePath(null, ORG), false, 'null')
eq(
  isUsableStoragePath(`${UPLOAD}/images/x-photo.png`, ORG),
  false,
  "another org's prefix would fail the bucket's read policy anyway",
)

console.log('\nhostedImagePathCandidates (the actual repair):')
eq(
  hostedImagePathCandidates({ id: UPLOAD, org_id: ORG, storage_path: `${ORG}/images/${UPLOAD}-photo.png`, file_name: 'photo.png' }),
  [`${ORG}/images/${UPLOAD}-photo.png`],
  'a healthy row yields exactly one candidate (no pointless second round trip)',
)
eq(
  hostedImagePathCandidates({ id: UPLOAD, org_id: ORG, storage_path: PENDING_PATH, file_name: 'Holiday Snap-1920x1080.jpg' }),
  [`${ORG}/images/${UPLOAD}-holiday-snap-1920x1080.jpg`],
  "a 'pending' row rebuilds the path the uploader really used",
)
eq(
  hostedImagePathCandidates({ id: UPLOAD, org_id: ORG, storage_path: null, file_name: null }),
  [`${ORG}/images/${UPLOAD}-image.png`],
  'a nameless pending row still resolves',
)
eq(
  hostedImagePathCandidates({ id: UPLOAD, org_id: ORG, storage_path: `${ORG}/images/moved-elsewhere.png`, file_name: 'photo.png' }),
  [`${ORG}/images/moved-elsewhere.png`, `${ORG}/images/${UPLOAD}-photo.png`],
  'a recorded path is tried FIRST, with the legacy guess as the fallback',
)
eq(
  hostedImagePathCandidates({ id: UPLOAD, org_id: ORG, storage_path: `${ORG}/images/${UPLOAD}-photo.png`, file_name: 'photo.png' }).length,
  1,
  'the two never duplicate when they agree',
)

console.log('\nnewObjectId (no secure-context dependency — the desktop app is file://):')
const idA = newObjectId()
const idB = newObjectId()
eq(typeof idA === 'string' && idA.length >= 16, true, 'long enough to be unique')
eq(idA === idB, false, 'two calls differ')
eq(/^[a-z0-9-]+$/.test(idA), true, 'safe in an object name')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
