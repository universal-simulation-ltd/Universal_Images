// Collage geometry — where each photo's space lands on the canvas.
//
//   npm run test:collage
//
// Runs under Node's type-stripping, so `collage.ts` is imported directly (its
// drawing half only touches a canvas when called). Pinned: the gaps are equal
// everywhere, including the outside edge; "Fit photos" gives each photo a space
// of its OWN shape (so nothing is cropped) with the long edge where it belongs;
// the drag arithmetic keeps a photo covering its space at both extremes.
import assert from 'node:assert/strict'
import { LAYOUTS, coverPlacement, hitSlot, layoutById, layoutCollage } from '../src/lib/collage.ts'

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)) + 0.51, `${msg}: ${a} ≠ ${b}`)
let n = 0
const t = (name, fn) => { fn(); n++; console.log('  ✓', name) }

t('every layout yields as many spaces as it claims, inside the canvas', () => {
  for (const l of LAYOUTS) {
    for (const shape of ['1:1', '4:5', '16:9', 'fit']) {
      const g = layoutCollage(l, shape, [], 1000, 0.02)
      assert.equal(g.rects.length, l.slots, l.id)
      for (const r of g.rects) {
        assert.ok(r.w > 0 && r.h > 0, `${l.id} ${shape} positive`)
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= g.width + 0.5 && r.y + r.h <= g.height + 0.5, `${l.id} ${shape} inside`)
      }
      assert.equal(Math.max(g.width, g.height), 1000, `${l.id} ${shape} long edge`)
    }
  }
})

t('side by side, square: two equal halves with the gap between and around them', () => {
  const g = layoutCollage(layoutById('row2'), '1:1', [], 1000, 0.02)
  const [a, b] = g.rects
  near(a.x, 20, 'left margin'); near(a.y, 20, 'top margin')
  near(b.x - (a.x + a.w), 20, 'middle gap')
  near(g.width - (b.x + b.w), 20, 'right margin')
  near(a.w, b.w, 'equal widths'); near(a.w, 470, 'width')
})

t('fit photos, side by side: each space has its photo\'s shape and the row is the long edge', () => {
  const g = layoutCollage(layoutById('row2'), 'fit', [1.5, 0.75], 2000, 0.01)
  const [a, b] = g.rects
  near(a.w / a.h, 1.5, 'landscape keeps 3:2'); near(b.w / b.h, 0.75, 'portrait keeps 3:4')
  near(a.h, b.h, 'same height')
  assert.equal(g.width, 2000)
  near(g.height, a.h + 40, 'height = photo + two margins')
})

t('fit photos, one above the other: same width, stacked, height is the long edge', () => {
  const g = layoutCollage(layoutById('col2'), 'fit', [1.5, 1.5], 1000, 0)
  const [a, b] = g.rects
  near(a.w, b.w, 'same width'); near(b.y, a.y + a.h, 'stacked with no gap')
  assert.equal(g.height, 1000); near(g.width, 1000 * 1.5 / 2, 'width')
})

t('fit photos with two tall photos side by side: the thickness becomes the long edge', () => {
  const g = layoutCollage(layoutById('row2'), 'fit', [0.25, 0.25], 1000, 0)
  assert.equal(g.height, 1000); near(g.width, 500, 'width')
  near(g.rects[0].w / g.rects[0].h, 0.25, 'shape kept')
})

t('fit on a grid falls back to square', () => {
  const g = layoutCollage(layoutById('grid4'), 'fit', [2, 2, 2, 2], 800, 0)
  assert.equal(g.width, 800); assert.equal(g.height, 800)
})

t('big left: the big space is twice the width of the column beside it', () => {
  const g = layoutCollage(layoutById('bigL3'), '1:1', [], 900, 0)
  near(g.rects[0].w, 600, 'big'); near(g.rects[1].w, 300, 'small'); near(g.rects[1].h, 450, 'half height')
})

t('cover placement always covers the space, at both ends of a drag and when zoomed', () => {
  const space = { x: 10, y: 10, w: 100, h: 100 }
  for (const [ox, oy, zoom] of [[0, 0, 1], [1, 1, 1], [0.5, 0.5, 2.5], [1, 0, 4]]) {
    const d = coverPlacement(space, 400, 200, { ox, oy, zoom })
    assert.ok(d.x <= space.x + 1e-9 && d.y <= space.y + 1e-9, 'top-left covered')
    assert.ok(d.x + d.w >= space.x + space.w - 1e-9 && d.y + d.h >= space.y + space.h - 1e-9, 'bottom-right covered')
  }
})

t('hit testing finds the space under a point and nothing in a gap', () => {
  const g = layoutCollage(layoutById('row2'), '1:1', [], 1000, 0.02)
  assert.equal(hitSlot(g, 100, 500), 0)
  assert.equal(hitSlot(g, 900, 500), 1)
  assert.equal(hitSlot(g, 500, 500), -1)
})

console.log(`${n} collage tests passed`)
