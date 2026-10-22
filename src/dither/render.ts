import { getMedia } from '../media'
import type { Item } from '../store'
import { diffuse } from './cpu'
import { glFx } from './fx'
import { glDither } from './gl'
import { DitherSettings, hasFx, styleDef } from './types'

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
  return { w: Math.max(1, Math.round(cw * it.exportScale)), h: Math.max(1, Math.round(ch * it.exportScale)) }
}

export function renderItem(it: Item, target: HTMLCanvasElement, opts: RenderOpts = {}): boolean {
  const m = getMedia(it.src)
  if (!m || !m.w) return false
  const s = { ...it.dither, ...opts.override }
  const sx = it.crop.l * m.w, sy = it.crop.t * m.h
  const sw = (it.crop.r - it.crop.l) * m.w, sh = (it.crop.b - it.crop.t) * m.h
  const full = outputSize(it)
  const scale = opts.maxDim ? Math.min(1, opts.maxDim / Math.max(full.w, full.h)) : 1
  const w = Math.max(1, Math.round(full.w * scale))
  const h = Math.max(1, Math.round(full.h * scale))
  const k = it.exportScale * scale
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

  if (styleDef(s.style).gpu === undefined) {
    diffuse(m.el, sx, sy, sw, sh, s, w, h, px, target)
  } else {
    glDither().render({
      source: m.el,
      dynamic: m.kind !== 'image',
      crop: [it.crop.l, it.crop.t, it.crop.r - it.crop.l, it.crop.b - it.crop.t],
      srcPerOut: sw / w,
      outW: w, outH: h, px, pat, s,
    }, target)
  }
  if (hasFx(s) && !opts.noFx) {
    // Effect sizes scale with the image so a preset looks the same on a thumbnail and a 4K photo.
    const unit = k * Math.max(1, Math.max(sw, sh) / 480)
    glFx().apply(target, s, unit, m.kind !== 'image')
  }
  return true
}
