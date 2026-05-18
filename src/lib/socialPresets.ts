export interface SocialPreset {
  id: string
  label: string
  /** Single-word platform name used to group buttons in the UI. */
  group: string
  width: number
  height: number
}

/**
 * Pixel sizes referenced from each platform's image-spec page as of early 2026.
 * Sizes change occasionally — bump these if a platform redesigns.
 */
export const SOCIAL_PRESETS: SocialPreset[] = [
  { id: 'ig-square',   label: 'Square post',     group: 'Instagram', width: 1080, height: 1080 },
  { id: 'ig-portrait', label: 'Portrait post',   group: 'Instagram', width: 1080, height: 1350 },
  { id: 'ig-story',    label: 'Story / Reel',    group: 'Instagram', width: 1080, height: 1920 },

  { id: 'x-post',      label: 'Post image',      group: 'X / Twitter', width: 1600, height: 900 },
  { id: 'x-header',    label: 'Header',          group: 'X / Twitter', width: 1500, height: 500 },

  { id: 'li-post',     label: 'Post image',      group: 'LinkedIn', width: 1200, height: 627 },
  { id: 'li-banner',   label: 'Profile banner',  group: 'LinkedIn', width: 1584, height: 396 },

  { id: 'yt-thumb',    label: 'Thumbnail',       group: 'YouTube', width: 1280, height: 720 },
  { id: 'yt-banner',   label: 'Channel banner',  group: 'YouTube', width: 2560, height: 1440 },

  { id: 'fb-post',     label: 'Post image',      group: 'Facebook', width: 1200, height: 630 },
  { id: 'fb-cover',    label: 'Cover photo',     group: 'Facebook', width: 851,  height: 315 }
]

export function groupedPresets(): Array<{ group: string; items: SocialPreset[] }> {
  const map = new Map<string, SocialPreset[]>()
  for (const p of SOCIAL_PRESETS) {
    const list = map.get(p.group) ?? []
    list.push(p)
    map.set(p.group, list)
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
}
