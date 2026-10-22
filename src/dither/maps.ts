/** Tiled threshold maps for ordered dithering. Each map holds N×N thresholds in [0, 1). */
export interface ThresholdMap { n: number; data: Float32Array }

export type MapId =
  | 'bayer2' | 'bayer4' | 'bayer8' | 'bayer16'
  | 'cluster4' | 'cluster8' | 'diagonal' | 'diamond' | 'spiral' | 'brick' | 'ripple' | 'grid'
  | 'bluenoise'

/** Turns any per-cell score into evenly spaced thresholds by ranking the cells. */
function rank(n: number, score: (x: number, y: number) => number): ThresholdMap {
  const cells: { i: number; s: number }[] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push({ i: y * n + x, s: score(x, y) })
  cells.sort((a, b) => a.s - b.s || a.i - b.i)
  const data = new Float32Array(n * n)
  cells.forEach((c, r) => (data[c.i] = (r + 0.5) / (n * n)))
  return { n, data }
}

function bayer(n: number): ThresholdMap {
  let m = [[0]]
  while (m.length < n) {
    const s = m.length
    const next: number[][] = Array.from({ length: s * 2 }, () => new Array(s * 2).fill(0))
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = m[y][x] * 4
      next[y][x] = v
      next[y][x + s] = v + 2
      next[y + s][x] = v + 3
      next[y + s][x + s] = v + 1
    }
    m = next
  }
  return rank(n, (x, y) => m[y][x])
}

/** Void-and-cluster blue noise (Ulichney), with a toroidal Gaussian energy filter. */
function blueNoise(n: number): ThresholdMap {
  const size = n * n
  const sigma = 1.5
  const kernel = new Float32Array(size)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = Math.min(x, n - x), dy = Math.min(y, n - y)
    kernel[y * n + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
  }
  const energy = new Float32Array(size)
  const on = new Uint8Array(size)
  const splat = (i: number, sign: number) => {
    const px = i % n, py = (i / n) | 0
    for (let y = 0; y < n; y++) {
      const ky = ((y - py + n) % n) * n
      for (let x = 0; x < n; x++) energy[y * n + x] += sign * kernel[ky + ((x - px + n) % n)]
    }
  }
  const extreme = (wantOn: number, max: boolean) => {
    let best = -1, bv = max ? -Infinity : Infinity
    for (let i = 0; i < size; i++) {
      if (on[i] !== wantOn) continue
      if (max ? energy[i] > bv : energy[i] < bv) { bv = energy[i]; best = i }
    }
    return best
  }
  // Seed with a deterministic sparse pattern, then relax it until stable.
  let seed = 12345
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const initial = Math.floor(size / 10)
  while ([...on].filter(Boolean).length < initial) {
    const i = Math.floor(rand() * size)
    if (!on[i]) { on[i] = 1; splat(i, 1) }
  }
  for (let guard = 0; guard < size; guard++) {
    const tight = extreme(1, true)
    on[tight] = 0; splat(tight, -1)
    const voidI = extreme(0, false)
    if (voidI === tight) { on[tight] = 1; splat(tight, 1); break }
    on[voidI] = 1; splat(voidI, 1)
  }
  const ranks = new Int32Array(size)
  const proto = on.slice(), protoEnergy = energy.slice()
  // Phase 1: remove tightest clusters, ranking downward.
  let count = initial
  while (count > 0) {
    const t = extreme(1, true)
    on[t] = 0; splat(t, -1)
    ranks[t] = --count
  }
  on.set(proto); energy.set(protoEnergy)
  // Phase 2 and 3: fill the largest voids, ranking upward.
  for (count = initial; count < size; count++) {
    const v = extreme(0, false)
    on[v] = 1; splat(v, 1)
    ranks[v] = count
  }
  const data = new Float32Array(size)
  for (let i = 0; i < size; i++) data[i] = (ranks[i] + 0.5) / size
  return { n, data }
}

const centered = (n: number, f: (x: number, y: number) => number) => (x: number, y: number) =>
  f((x + 0.5) / n * 2 - 1, (y + 0.5) / n * 2 - 1)

const BUILDERS: Record<MapId, () => ThresholdMap> = {
  bayer2: () => bayer(2),
  bayer4: () => bayer(4),
  bayer8: () => bayer(8),
  bayer16: () => bayer(16),
  // Dots grow from the cell centre, like a printer's halftone screen.
  cluster4: () => rank(4, centered(4, (x, y) => -(Math.cos(Math.PI * x) + Math.cos(Math.PI * y)) + Math.atan2(y, x) * 1e-3)),
  cluster8: () => rank(8, (x, y) => {
    const u = (x + y + 1) / 8 * Math.PI, v = (x - y) / 8 * Math.PI
    return -(Math.cos(u) * Math.cos(v)) + Math.atan2(y - 3.5, x - 3.5) * 1e-3
  }),
  diagonal: () => rank(8, (x, y) => Math.abs(((x + y) % 8) - 3.5) + x * 1e-3),
  diamond: () => rank(8, centered(8, (x, y) => Math.abs(x) + Math.abs(y) + Math.atan2(y, x) * 1e-3)),
  spiral: () => rank(8, centered(8, (x, y) => {
    const r = Math.hypot(x, y), a = (Math.atan2(y, x) + Math.PI) / (2 * Math.PI)
    return Math.floor(r * 4) + a
  })),
  brick: () => rank(8, (x, y) => {
    const row = y < 4 ? 0 : 1
    const bx = (x + row * 4) % 8
    return Math.min(Math.abs(bx - 3.5) / 4, Math.abs((y % 4) - 1.5) / 2) * -1 + bx * 1e-3
  }),
  ripple: () => rank(16, centered(16, (x, y) => {
    const r = Math.hypot(x, y) * 3
    return Math.abs(r - Math.round(r)) + Math.atan2(y, x) * 1e-4
  })),
  grid: () => rank(6, centered(6, (x, y) => -Math.max(Math.abs(x), Math.abs(y)) + Math.atan2(y, x) * 1e-3)),
  bluenoise: () => blueNoise(64),
}

const cache = new Map<MapId, ThresholdMap>()
export function getMap(id: MapId): ThresholdMap {
  let m = cache.get(id)
  if (!m) { m = BUILDERS[id](); cache.set(id, m) }
  return m
}
