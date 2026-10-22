import { DitherSettings, StyleId, hexToRgb } from './types'

/** [dx, dy, weight] taps, plus the divisor. */
const KERNELS: Partial<Record<StyleId, [number[][], number]>> = {
  floyd: [[[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]], 16],
  atkinson: [[[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]], 8],
  jjn: [[[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
    [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]], 48],
  stucki: [[[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
    [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]], 42],
  burkes: [[[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]], 32],
  sierra: [[[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
    [-1, 2, 2], [0, 2, 3], [1, 2, 2]], 32],
  sierra2: [[[1, 0, 4], [2, 0, 3], [-2, 1, 1], [-1, 1, 2], [0, 1, 3], [1, 1, 2], [2, 1, 1]], 16],
  sierralite: [[[1, 0, 2], [-1, 1, 1], [0, 1, 1]], 4],
  falsefloyd: [[[1, 0, 3], [0, 1, 3], [1, 1, 2]], 8],
  fan: [[[1, 0, 7], [-2, 1, 1], [-1, 1, 3], [0, 1, 5]], 16],
  shiaufan: [[[1, 0, 8], [-3, 1, 1], [-2, 1, 1], [-1, 1, 2], [0, 1, 4]], 16],
  stevenson: [[[2, 0, 32], [-3, 1, 12], [-1, 1, 26], [1, 1, 30], [3, 1, 16], [-2, 2, 12], [0, 2, 26], [2, 2, 12],
    [-3, 3, 5], [-1, 3, 12], [1, 3, 12], [3, 3, 5]], 200],
  simple: [[[1, 0, 1]], 1],
}

/** Knuth's 8×8 class matrix: pixels are processed class by class, pushing error only to higher classes. */
const KNUTH = [
  34, 48, 40, 32, 29, 15, 23, 31, 42, 58, 56, 53, 21, 5, 7, 10,
  50, 62, 61, 45, 13, 1, 2, 18, 38, 46, 54, 37, 25, 17, 9, 26,
  28, 14, 22, 30, 35, 49, 41, 33, 20, 4, 6, 11, 43, 59, 57, 52,
  12, 0, 3, 19, 51, 63, 60, 44, 24, 16, 8, 27, 39, 47, 55, 36,
]

/** Hilbert curve index → (x, y) on an n×n grid, n a power of two. */
function hilbert(n: number, d: number): [number, number] {
  let x = 0, y = 0, t = d
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t / 2), ry = 1 & (t ^ rx)
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y }
      const tmp = x; x = y; y = tmp
    }
    x += s * rx; y += s * ry
    t = Math.floor(t / 4)
  }
  return [x, y]
}

const work = document.createElement('canvas')
const workCtx = work.getContext('2d', { willReadFrequently: true })!

export function adjustRGB(r: number, g: number, b: number, s: DitherSettings): [number, number, number] {
  const ig = 1 / s.gamma
  const k = 1 + s.contrast
  let c = [r, g, b].map((v) => (Math.pow(Math.max(v, 0), ig) - 0.5) * k + 0.5 + s.brightness)
  const l = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114
  c = c.map((v) => Math.min(1, Math.max(0, l + (v - l) * s.saturation)))
  if (s.invert) c = c.map((v) => 1 - v)
  return c as [number, number, number]
}

export function diffuse(
  source: CanvasImageSource,
  sx: number, sy: number, sw: number, sh: number,
  s: DitherSettings, outW: number, outH: number, px: number,
  target: HTMLCanvasElement,
) {
  const w = Math.max(1, Math.round(outW / Math.max(px, 1)))
  const h = Math.max(1, Math.round(outH / Math.max(px, 1)))
  work.width = w
  work.height = h
  workCtx.imageSmoothingEnabled = true
  workCtx.imageSmoothingQuality = 'high'
  workCtx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h)
  const img = workCtx.getImageData(0, 0, w, h)
  const d = img.data
  const n = w * h
  const mono = s.colorMode === 'mono'
  const ch = mono ? 1 : 3
  const buf = new Float32Array(n * ch)
  const orig = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const [r, g, b] = adjustRGB(d[i * 4] / 255, d[i * 4 + 1] / 255, d[i * 4 + 2] / 255, s)
    orig[i * 3] = r; orig[i * 3 + 1] = g; orig[i * 3 + 2] = b
    if (mono) buf[i] = r * 0.299 + g * 0.587 + b * 0.114
    else { buf[i * 3] = r; buf[i * 3 + 1] = g; buf[i * 3 + 2] = b }
  }

  const L = Math.max(1, s.levels - 1)
  const pal = s.palette.map(hexToRgb)
  const dark = hexToRgb(s.dark)
  const light = hexToRgb(s.light)
  const out = new Float32Array(n * 3)
  const err = [0, 0, 0]

  /** Quantizes pixel i from its (error-adjusted) buffer value; leaves the residual in err. */
  const quantize = (i: number) => {
    if (mono) {
      const v = buf[i]
      const qv = Math.min(1, Math.max(0, Math.round(v * L) / L))
      err[0] = v - qv
      for (let k = 0; k < 3; k++) out[i * 3 + k] = dark[k] + (light[k] - dark[k]) * qv
    } else if (s.colorMode === 'original') {
      for (let k = 0; k < 3; k++) {
        const v = buf[i * 3 + k]
        const q = Math.min(1, Math.max(0, Math.round(v * L) / L))
        err[k] = v - q
        out[i * 3 + k] = q
      }
    } else {
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2]
      let best = Infinity, bi = 0
      for (let p = 0; p < pal.length; p++) {
        const dr = (r - pal[p][0]) * 0.8, dg = g - pal[p][1], db = (b - pal[p][2]) * 0.6
        const dd = dr * dr + dg * dg + db * db
        if (dd < best) { best = dd; bi = p }
      }
      for (let k = 0; k < 3; k++) {
        err[k] = buf[i * 3 + k] - pal[bi][k]
        out[i * 3 + k] = pal[bi][k]
      }
    }
  }
  const push = (j: number, f: number) => {
    for (let k = 0; k < ch; k++) buf[j * ch + k] += err[k] * f
  }

  if (s.style === 'riemersma') {
    // Error travels along a Hilbert curve, fading over the last 16 pixels.
    const Q = 16, R = 16
    // Riemersma: newest error weighs 1, the oldest 1/R. The history stores (original − output),
    // not the adjusted residual, which keeps the accumulated error bounded.
    const weights = Array.from({ length: Q }, (_, k) => Math.pow(R, k / (Q - 1)) / R)
    const hist = Array.from({ length: Q }, () => [0, 0, 0])
    let side = 1
    while (side < Math.max(w, h)) side *= 2
    const origVal = [0, 0, 0]
    for (let d = 0; d < side * side; d++) {
      const [x, y] = hilbert(side, d)
      if (x >= w || y >= h) continue
      const i = y * w + x
      for (let k = 0; k < ch; k++) {
        let e = 0
        for (let q = 0; q < Q; q++) e += hist[q][k] * weights[q]
        origVal[k] = buf[i * ch + k]
        buf[i * ch + k] += e * s.intensity
      }
      quantize(i)
      hist.shift()
      const added = [0, 0, 0]
      for (let k = 0; k < ch; k++) added[k] = origVal[k] - (buf[i * ch + k] - err[k])
      hist.push(added)
    }
  } else if (s.style === 'dotdiffusion') {
    for (let c = 0; c < 64; c++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (KNUTH[(y % 8) * 8 + (x % 8)] !== c) continue
          const i = y * w + x
          quantize(i)
          let total = 0
          const targets: [number, number][] = []
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy
            if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            if (KNUTH[(ny % 8) * 8 + (nx % 8)] <= c) continue
            const wt = dx && dy ? 1 : 2
            targets.push([ny * w + nx, wt])
            total += wt
          }
          for (const [j, wt] of targets) push(j, (wt / total) * s.intensity)
        }
      }
    }
  } else {
    const [taps, div] = KERNELS[s.style] ?? KERNELS.floyd!
    for (let y = 0; y < h; y++) {
      const rtl = y % 2 === 1
      for (let xi = 0; xi < w; xi++) {
        const x = rtl ? w - 1 - xi : xi
        const i = y * w + x
        quantize(i)
        for (const [dx0, dy, wt] of taps) {
          const nx = x + (rtl ? -dx0 : dx0), ny = y + dy
          if (nx < 0 || nx >= w || ny >= h) continue
          push(ny * w + nx, (wt / div) * s.intensity)
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const v = orig[i * 3 + k] + (out[i * 3 + k] - orig[i * 3 + k]) * s.mix
      d[i * 4 + k] = v * 255
    }
    d[i * 4 + 3] = 255
  }
  workCtx.putImageData(img, 0, 0)

  if (target.width !== outW) target.width = outW
  if (target.height !== outH) target.height = outH
  const ctx = target.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(work, 0, 0, outW, outH)
}
