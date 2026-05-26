export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface SourceImage {
  id: string
  name: string
  file: File
  /** Original bitmap dimensions (px). */
  width: number
  height: number
  /** Object URL for cheap previews — revoked when the image is removed. */
  objectUrl: string
  /** Source bytes — used for "untouched" size comparisons. */
  bytes: number
}

export interface ResizeTarget {
  /** Target output width in px. */
  width: number
  /** Target output height in px. */
  height: number
  /** When true, editing width/height keeps the source aspect ratio. */
  aspectLocked: boolean
  /** 0..1 — used for jpeg/webp, ignored for png. */
  quality: number
  format: OutputFormat
}

export type PresetSize = 'S' | 'M' | 'L'

/** Crop rectangle in source-image pixel space. */
export interface SourceCrop {
  x: number
  y: number
  width: number
  height: number
}
