# Universal Images — docs

## What this repo is

Universal Images is a clean Progressive Web App for **resizing, cropping,
converting, and optimising images entirely in the browser** — drag & drop
JPEG/PNG/WebP/HEIC/GIF, crop with live handles, apply social-media size
presets, convert with a quality slider, and batch-export (individually or as a
ZIP). No upload to a server; files stay on the device.

- **Live:** [opensource.unisim.co.uk/images](https://opensource.unisim.co.uk/images/)
  — served by path via the `opensource-portal` Worker, which proxies `/images`
  to its Cloudflare Pages project.
- **Stack:** Vite + React 18 + TypeScript PWA (installable, works offline
  after first load).
- **Wrappers:** an `electron/` folder provides a desktop build
  (`npm run dist`), and a `capacitor.config.ts` exists for native mobile
  packaging. Desktop apps are shipped unsigned per suite policy.

MIT licensed — free and open source, like all Universal Apps.

## Suite context

This repo is one part of the **Universal Simulation suite** (the open-source
Universal Apps family). For cross-repo context — how the `@unisim/sdk`, edge
routing, and the suite changelog wire together — see the suite docs repo:
[`universal-simulation-ltd/docs`](https://github.com/universal-simulation-ltd/docs)
(private; checked out at the umbrella root as `Docs_UNI_SIM/` for suite
contributors). Start with `ARCHITECTURE.md` (the cross-repo map).
