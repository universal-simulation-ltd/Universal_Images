// Kept as this app's download entry point so no call site had to change. The
// mechanics — and the reason a phone needs a different one entirely — live in
// `@unisim/media/save`.
import { saveBlob } from '@unisim/media/save'

export function downloadBlob(blob: Blob, filename: string) {
  saveBlob(blob, filename)
}
