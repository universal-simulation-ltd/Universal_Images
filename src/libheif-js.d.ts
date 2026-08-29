// libheif-js ships types for the raw emscripten bindings only — its high-level
// `HeifDecoder` wrapper (the part we actually use) is untyped, and the deep
// pre-bundled WASM entry has no declaration at all. This is that surface, no
// wider than what `decodeHeicIfNeeded` calls.
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number
    get_height(): number
    /** Fills `imageData` in place, then calls back with it — or null on failure. */
    display(imageData: ImageData, cb: (out: ImageData | null) => void): void
  }
  interface HeifDecoder {
    decode(buffer: Uint8Array): HeifImage[]
  }
  interface LibHeif {
    HeifDecoder: new () => HeifDecoder
  }
  export default function libheifFactory(options?: unknown): Promise<LibHeif>
}
