// Kept as this app's download entry point so no call site had to change. The
// mechanics — and the reason a phone needs a different one entirely — live in
// `saveFile.ts`.
import { saveBlob } from './saveFile'

export function downloadBlob(blob: Blob, filename: string) {
  saveBlob(blob, filename)
}
