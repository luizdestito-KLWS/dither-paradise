import { getMedia } from '../media'
import type { Item } from '../store'
import { MIN_GLYPH_ROW } from './ascii'
import { diffuse } from './cpu'
import { glFx } from './fx'
import { glDither } from './gl'
import { DitherSettings, hasFx, hexToRgb, styleDef } from './types'

export interface RenderOpts {
  /** Cap on the longest output side; omit for full export resolution. */
  maxDim?: number
  compare?: boolean
  override?: Partial<DitherSettings>
  /** Minimum dither cell in output pixels, so tiny thumbnails still show the pattern. */
  pxMin?: number
  /** Skip post effects (used by the style thumbnails so they stay readable). */
  noFx?: boolean
}

export function outputSize(it: Item) {
  const cw = (it.crop.r - it.crop.l) * it.natW
  const ch = (it.crop.b - it.crop.t) * it.natH
  let scale = it.exportScale
  // ASCII needs enough pixels per row to draw real letters, so small sources get upscaled.
  if (it.dither.mode === 'ascii') scale = Math.max(scale, MIN_GLYPH_ROW / Math.max(1, it.dither.asciiCell ?? 8))
  return { w: Math.max(1, Math.round(cw * scale)), h: Math.max(1, Math.round(ch * scale)) }
}

const levelCache = new Map<string, [number, number]>()
const probe = document.createElement('canvas')
probe.width = probe.height = 64
const probeCtx = probe.getContext('2d', { willReadFrequently: true })!

/** Black and white points (0.5% / 99.5% luminance) of the cropped source, cached per source+crop. */
function autoLevels(el: CanvasImageSource, key: string, sx: number, sy: number, sw: number, sh: number): [number, number] {
  const hit = levelCache.get(key)
  if (hit) return hit
  probeCtx.drawImage(el, sx, sy, sw, sh, 0, 0, 64, 64)
  const d = probeCtx.getImageData(0, 0, 64, 64).data
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) hist[Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)]++
  const n = 64 * 64
  let acc = 0, lo = 0, hi = 255
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.005) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.005) { hi = v; break } }
  if (hi - lo < 24) { lo = 0; hi = 255 }
  const out: [number, number] = [lo / 255, hi / 255]
  // Videos are measured once (first decoded frame) so the tone doesn't pump frame to frame.
  if (levelCache.size > 200) levelCache.clear()
  levelCache.set(key, out)
  return out
}

/** What shows between shaped cells: the darkest colour the item can output. */
function gapColorFor(s: DitherSettings) {
  if (s.colorMode === 'mono') return s.dark
  if (s.colorMode === 'palette' && s.palette.length) {
    const luma = (h: string) => { const [r, g, b] = hexToRgb(h); return r * 0.299 + g * 0.587 + b * 0.114 }
    return [...s.palette].sort((a, b) => luma(a) - luma(b))[0]
  }
  return '#000000'
}

export function renderItem(it: Item, target: HTMLCanvasElement, opts: RenderOpts = {}): boolean {
  const m = getMedia(it.src)
  if (!m || !m.w) return false
  const s = { ...it.dither, ...opts.override }
  const sx = it.crop.l * m.w, sy = it.crop.t * m.h
  const sw = (it.crop.r - it.crop.l) * m.w, sh = (it.crop.b - it.crop.t) * m.h
  if (s.autoContrast ?? true) {
    ;[s._lo, s._hi] = autoLevels(m.el, `${it.src}|${sx}|${sy}|${sw}|${sh}`, sx, sy, sw, sh)
  } else {
    s._lo = 0; s._hi = 1
  }
  const full = outputSize(it)
  const scale = opts.maxDim ? Math.min(1, opts.maxDim / Math.max(full.w, full.h)) : 1
  const w = Math.max(1, Math.round(full.w * scale))
  const h = Math.max(1, Math.round(full.h * scale))
  // Output pixels per source pixel (includes export scale, ASCII upscaling and the preview cap).
  const k = w / sw
  const px = Math.max(opts.pxMin ?? 0, s.pixelSize * k)
  const pat = Math.max(opts.pxMin ? opts.pxMin * 3 : 0, s.patternSize * k)

  if (opts.compare || !s.enabled) {
    if (target.width !== w) target.width = w
    if (target.height !== h) target.height = h
    const ctx = target.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(m.el, sx, sy, sw, sh, 0, 0, w, h)
    return true
  }

  // Exact cell size in output pixels, so shaped cells line up with what the ditherer produced.
  let cell: [number, number] = [px, px]
  if (s.mode !== 'ascii' && styleDef(s.style).gpu === undefined) {
    diffuse(m.el, sx, sy, sw, sh, s, w, h, px, target)
    const pxc = Math.max(px, 1)
    cell = [w / Math.max(1, Math.round(w / pxc)), h / Math.max(1, Math.round(h / pxc))]
  } else {
    glDither().render({
      source: m.el,
      dynamic: m.kind !== 'image',
      crop: [it.crop.l, it.crop.t, it.crop.r - it.crop.l, it.crop.b - it.crop.t],
      srcPerOut: sw / w,
      outW: w, outH: h, px, pat, s,
      cell: Math.max(opts.pxMin ? opts.pxMin * 3 : 0, (s.asciiCell ?? 8) * k),
    }, target)
  }
  if (hasFx(s) && !opts.noFx) {
    // Effect sizes scale with the image so a preset looks the same on a thumbnail and a 4K photo.
    const unit = k * Math.max(1, Math.max(sw, sh) / 480)
    glFx().apply(target, s, unit, m.kind !== 'image', cell, gapColorFor(s))
  }
  return true
}
