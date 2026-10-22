import { adjustRGB } from './cpu'
import { ASCII_SETS, AsciiFont, DitherSettings } from './types'

/** Glyph atlas: one row of square cells, white glyphs on transparent, plus a luminance → glyph lookup. */
export interface GlyphAtlas {
  key: string
  canvas: HTMLCanvasElement
  /** Glyphs in atlas order. */
  chars: string[]
  /** 256 entries: luminance bucket → glyph index (density mode). */
  lut: Float32Array
  /** Character cell width ÷ height, from the font's typical advance. */
  aspect: number
}

/** Minimum output pixels per text row, so glyphs stay legible on small images. */
export const MIN_GLYPH_ROW = 16

export const GLYPH_PX = 64
const MAX_GLYPHS = 120

export const FONT_STACKS: Record<AsciiFont, string> = {
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace',
  pixel: '"DotGothic16", monospace',
  gothic: '"UnifrakturMaguntia", serif',
  rounded: '"M PLUS Rounded 1c", sans-serif',
}

/** Bumped when web fonts finish loading so atlases (and renders) are rebuilt with the real glyphs. */
export let fontEpoch = 0
const cache = new Map<string, GlyphAtlas>()

export function preloadAsciiFonts() {
  const loads = ['"DotGothic16"', '"UnifrakturMaguntia"', '700 "M PLUS Rounded 1c"', '800 "M PLUS Rounded 1c"']
    .map((f) => document.fonts.load(`48px ${f}`, 'Aa01@#'))
  Promise.allSettled(loads).then(() => { cache.clear(); fontEpoch++ })
}

export function glyphString(s: DitherSettings) {
  if (s.asciiSet === 'custom') return s.asciiCustom || 'A'
  return ASCII_SETS.find((x) => x.id === s.asciiSet)?.chars ?? ASCII_SETS[0].chars
}

export function getAtlas(s: DitherSettings): GlyphAtlas {
  const text = glyphString(s)
  const sequence = s.asciiSet === 'custom' && s.asciiSequence
  const key = [text, s.asciiFont, s.asciiBold, sequence, fontEpoch].join('|')
  const hit = cache.get(key)
  if (hit) return hit

  // Sequence mode keeps the text as typed (repeats allowed); density mode uses each glyph once, plus a blank.
  let chars = sequence
    ? Array.from(text.replace(/\s+/g, ' ')).slice(0, MAX_GLYPHS)
    : [...new Set([' ', ...Array.from(text)])].slice(0, MAX_GLYPHS)
  if (!chars.length) chars = ['A']

  const canvas = document.createElement('canvas')
  canvas.width = GLYPH_PX * chars.length
  canvas.height = GLYPH_PX
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const size = s.asciiFont === 'gothic' ? GLYPH_PX * 0.92 : GLYPH_PX * 0.86
  g.font = `${s.asciiBold ? 800 : 400} ${size}px ${FONT_STACKS[s.asciiFont]}`
  // Cells are as wide as a typical glyph advance; each glyph is stretched to fill its square atlas
  // slot and squeezed back by the shader's rectangular cell, so proportions survive.
  const advances = chars.filter((c) => c.trim()).map((c) => g.measureText(c).width).sort((a, b) => a - b)
  const advance = Math.min(size * 0.95, Math.max(size * 0.45, advances[advances.length >> 1] ?? size * 0.6))
  const aspect = advance / GLYPH_PX

  const coverage = chars.map((ch, i) => {
    g.save()
    g.translate(i * GLYPH_PX + GLYPH_PX / 2, GLYPH_PX / 2 + GLYPH_PX * 0.04)
    g.scale(GLYPH_PX / advance, 1)
    g.fillText(ch, 0, 0)
    g.restore()
    const d = g.getImageData(i * GLYPH_PX, 0, GLYPH_PX, GLYPH_PX).data
    let sum = 0
    for (let p = 3; p < d.length; p += 4) sum += d[p]
    return sum / (255 * GLYPH_PX * GLYPH_PX)
  })

  if (!sequence) {
    // Reorder the atlas from emptiest to densest glyph.
    const order = chars.map((_, i) => i).sort((a, b) => coverage[a] - coverage[b])
    const sorted = document.createElement('canvas')
    sorted.width = canvas.width
    sorted.height = canvas.height
    const sg = sorted.getContext('2d')!
    order.forEach((src, dst) => sg.drawImage(canvas, src * GLYPH_PX, 0, GLYPH_PX, GLYPH_PX, dst * GLYPH_PX, 0, GLYPH_PX, GLYPH_PX))
    chars = order.map((i) => chars[i])
    const cov = order.map((i) => coverage[i])
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.drawImage(sorted, 0, 0)
    coverage.splice(0, coverage.length, ...cov)
  }

  // Map luminance to the glyph whose normalized ink coverage is closest.
  const lo = Math.min(...coverage), hi = Math.max(...coverage)
  const norm = coverage.map((c) => (hi > lo ? (c - lo) / (hi - lo) : 0))
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let best = 0
    for (let j = 1; j < norm.length; j++) if (Math.abs(norm[j] - t) < Math.abs(norm[best] - t)) best = j
    lut[i] = best
  }

  const atlas = { key, canvas, chars, lut, aspect }
  cache.set(key, atlas)
  return atlas
}

/** Plain-text version of the ASCII render: one character per cell. */
export function asciiText(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, s: DitherSettings) {
  const cell = Math.max(1, s.asciiCell)
  const atlasForSize = getAtlas(s)
  const cols = Math.max(1, Math.round(sw / (cell * atlasForSize.aspect)))
  const rows = Math.max(1, Math.round(sh / cell))
  const c = document.createElement('canvas')
  c.width = cols
  c.height = rows
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingQuality = 'high'
  g.drawImage(source, sx, sy, sw, sh, 0, 0, cols, rows)
  const d = g.getImageData(0, 0, cols, rows).data
  const atlas = atlasForSize
  const sequence = s.asciiSet === 'custom' && s.asciiSequence
  const lines: string[] = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4
      const [r, gg, b] = adjustRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, s)
      const l = r * 0.299 + gg * 0.587 + b * 0.114
      if (sequence) line += l < 0.12 ? ' ' : atlas.chars[(y * cols + x) % atlas.chars.length]
      else line += atlas.chars[atlas.lut[Math.round(Math.min(1, Math.max(0, l)) * 255)]]
    }
    lines.push(line.replace(/\s+$/, ''))
  }
  return lines.join('\n') + '\n'
}
