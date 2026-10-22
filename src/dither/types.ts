import type { MapId } from './maps'

export type StyleId =
  | 'threshold' | 'bayer2' | 'bayer4' | 'bayer8' | 'bayer16' | 'cluster4' | 'cluster8'
  | 'halftone' | 'lines' | 'cross' | 'diagonal' | 'diamond' | 'spiral' | 'brick' | 'ripple' | 'grid'
  | 'bluenoise' | 'blue' | 'white' | 'triangle'
  | 'floyd' | 'falsefloyd' | 'atkinson' | 'jjn' | 'stucki' | 'burkes' | 'sierra' | 'sierra2' | 'sierralite'
  | 'fan' | 'shiaufan' | 'stevenson' | 'simple'
  | 'riemersma' | 'dotdiffusion'

export type StyleGroup = 'Ordenado' | 'Padrão' | 'Ruído' | 'Difusão' | 'Especial'

export interface StyleDef {
  id: StyleId
  label: string
  group: StyleGroup
  /** Shader style index; absent means a CPU style. */
  gpu?: number
  /** Threshold map used when gpu === GPU_MAP. */
  map?: MapId
}

export const GPU_MAP = 10

export const STYLES: StyleDef[] = [
  { id: 'bayer2', label: 'Bayer 2×2', group: 'Ordenado', gpu: GPU_MAP, map: 'bayer2' },
  { id: 'bayer4', label: 'Bayer 4×4', group: 'Ordenado', gpu: GPU_MAP, map: 'bayer4' },
  { id: 'bayer8', label: 'Bayer 8×8', group: 'Ordenado', gpu: GPU_MAP, map: 'bayer8' },
  { id: 'bayer16', label: 'Bayer 16×16', group: 'Ordenado', gpu: GPU_MAP, map: 'bayer16' },
  { id: 'cluster4', label: 'Clustered 4×4', group: 'Ordenado', gpu: GPU_MAP, map: 'cluster4' },
  { id: 'cluster8', label: 'Clustered 8×8', group: 'Ordenado', gpu: GPU_MAP, map: 'cluster8' },
  { id: 'threshold', label: 'Limiar', group: 'Ordenado', gpu: 9 },
  { id: 'halftone', label: 'Retícula', group: 'Padrão', gpu: 6 },
  { id: 'lines', label: 'Linhas', group: 'Padrão', gpu: 7 },
  { id: 'cross', label: 'Hachura', group: 'Padrão', gpu: 8 },
  { id: 'diagonal', label: 'Diagonal', group: 'Padrão', gpu: GPU_MAP, map: 'diagonal' },
  { id: 'diamond', label: 'Diamante', group: 'Padrão', gpu: GPU_MAP, map: 'diamond' },
  { id: 'spiral', label: 'Espiral', group: 'Padrão', gpu: GPU_MAP, map: 'spiral' },
  { id: 'brick', label: 'Tijolos', group: 'Padrão', gpu: GPU_MAP, map: 'brick' },
  { id: 'ripple', label: 'Ondas', group: 'Padrão', gpu: GPU_MAP, map: 'ripple' },
  { id: 'grid', label: 'Grade', group: 'Padrão', gpu: GPU_MAP, map: 'grid' },
  { id: 'bluenoise', label: 'Blue noise', group: 'Ruído', gpu: GPU_MAP, map: 'bluenoise' },
  { id: 'blue', label: 'Interleaved', group: 'Ruído', gpu: 4 },
  { id: 'white', label: 'Random', group: 'Ruído', gpu: 5 },
  { id: 'triangle', label: 'Triangular', group: 'Ruído', gpu: 11 },
  { id: 'floyd', label: 'Floyd–Steinberg', group: 'Difusão' },
  { id: 'falsefloyd', label: 'Falso Floyd', group: 'Difusão' },
  { id: 'atkinson', label: 'Atkinson', group: 'Difusão' },
  { id: 'jjn', label: 'Jarvis-Judice-Ninke', group: 'Difusão' },
  { id: 'stucki', label: 'Stucki', group: 'Difusão' },
  { id: 'burkes', label: 'Burkes', group: 'Difusão' },
  { id: 'sierra', label: 'Sierra', group: 'Difusão' },
  { id: 'sierra2', label: 'Sierra 2 linhas', group: 'Difusão' },
  { id: 'sierralite', label: 'Sierra Lite', group: 'Difusão' },
  { id: 'fan', label: 'Fan', group: 'Difusão' },
  { id: 'shiaufan', label: 'Shiau-Fan', group: 'Difusão' },
  { id: 'stevenson', label: 'Stevenson-Arce', group: 'Difusão' },
  { id: 'simple', label: 'Simples 1D', group: 'Difusão' },
  { id: 'riemersma', label: 'Riemersma', group: 'Especial' },
  { id: 'dotdiffusion', label: 'Dot diffusion', group: 'Especial' },
]

export const styleDef = (id: StyleId) => STYLES.find((s) => s.id === id) ?? STYLES[1]

export type ColorMode = 'mono' | 'original' | 'palette'

export type RenderMode = 'dither' | 'ascii'
export type CellShape = 'square' | 'dot' | 'rounded' | 'diamond'
export type AsciiFont = 'mono' | 'pixel' | 'gothic' | 'rounded'

export interface AsciiSetDef { id: string; label: string; chars: string }

/** Character sets; order doesn't matter, glyphs are ranked by measured ink coverage. */
export const ASCII_SETS: AsciiSetDef[] = [
  { id: 'classic', label: 'Clássico', chars: ' .:-=+*#%@' },
  { id: 'detailed', label: 'Detalhado', chars: ` .'\`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$` },
  { id: 'blocks', label: 'Blocos', chars: ' ░▒▓█' },
  { id: 'braille', label: 'Braille', chars: ' ⠁⠃⠇⡇⡏⡟⡿⣿⠿⠛⠉' },
  { id: 'geometric', label: 'Geométrico', chars: ' ·∘○◌◍◎●◆■' },
  { id: 'arrows', label: 'Setas', chars: ' ·→↗↑⇡⇧⇑⬆' },
  { id: 'binary', label: 'Binário', chars: ' 01' },
  { id: 'kana', label: 'Matrix', chars: ' ･ｰｼﾂﾆﾄﾈﾒﾖﾛﾜﾊﾐ' },
  { id: 'medieval', label: 'Medieval', chars: ' .·:†‡✝☩✠⚔' },
  { id: 'stars', label: 'Estrelas', chars: ' .·*✦✧★✶✷✸' },
  { id: 'custom', label: 'Seu texto', chars: '' },
]

export interface DitherSettings {
  /** Dither or ASCII; both share colour, adjust and effects settings. */
  mode: RenderMode
  asciiSet: string
  asciiCustom: string
  /** Repeat the custom text in reading order instead of picking glyphs by density. */
  asciiSequence: boolean
  asciiFont: AsciiFont
  asciiBold: boolean
  /** Character cell size, in source pixels. */
  asciiCell: number
  asciiBg: string
  asciiTransparent: boolean
  enabled: boolean
  style: StyleId
  /** How each dither cell is drawn: a plain square, or a shape with a gap around it (LED / dot-matrix look). */
  cellShape: CellShape
  /** Gap between cells, as a fraction of the cell (0 = touching). */
  cellGap: number
  /** Stretch the image's tones to full black/white before dithering. */
  autoContrast: boolean
  /** Internal: black/white points measured from the source when autoContrast is on. */
  _lo?: number
  _hi?: number
  /** Size of one dither cell, in source pixels. */
  pixelSize: number
  /** Size of halftone / line cells, in source pixels. */
  patternSize: number
  angle: number
  /** How strongly the dither pattern breaks up banding (0 = plain posterize). */
  intensity: number
  /** Blend between the untouched source (0) and the dithered result (1). */
  mix: number
  colorMode: ColorMode
  levels: number
  dark: string
  light: string
  paletteId: string
  palette: string[]
  brightness: number
  contrast: number
  gamma: number
  saturation: number
  invert: boolean
  // Post effects. Lengths are in "work pixels" (about 1/480 of the image's long side).
  glow: number
  glowRadius: number
  glowThreshold: number
  blur: number
  chroma: number
  scanlines: number
  scanlineSize: number
  mask: number
  wave: number
  wavePeriod: number
  vignette: number
  grain: number
}

export const FX_KEYS = ['glow', 'blur', 'chroma', 'scanlines', 'mask', 'wave', 'vignette', 'grain'] as const
export const PATTERN_STYLES: StyleId[] = ['halftone', 'lines', 'cross']
/** Cell shapes only make sense when a cell is one flat colour: not for ASCII or pattern screens. */
export const hasCellShape = (s: DitherSettings) =>
  s.mode !== 'ascii' && !PATTERN_STYLES.includes(s.style) && ((s.cellShape ?? 'square') !== 'square' || (s.cellGap ?? 0) > 0)
export const hasFx = (s: DitherSettings) => FX_KEYS.some((k) => (s[k] ?? 0) > 0) || hasCellShape(s)

export const FX_OFF = {
  glow: 0, glowRadius: 12, glowThreshold: 0.45, blur: 0, chroma: 0, scanlines: 0, scanlineSize: 4,
  mask: 0, wave: 0, wavePeriod: 40, vignette: 0, grain: 0,
}

export interface PaletteDef {
  id: string
  name: string
  colors: string[]
}

export const PALETTES: PaletteDef[] = [
  { id: 'gameboy', name: 'Game Boy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { id: 'pocket', name: 'Pocket', colors: ['#1e1e1e', '#5a5a52', '#a5a598', '#e3e3d6'] },
  { id: 'wiisky', name: 'Céu Wii', colors: ['#0b2a45', '#1f6fa8', '#34beed', '#bfe9f7', '#ffffff'] },
  { id: 'angel', name: 'Anjinho', colors: ['#3b3b6b', '#4fa8e8', '#9fe3ff', '#ff7fbf', '#ffc4e5', '#fff4fb'] },
  { id: 'cga', name: 'CGA', colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
  { id: 'virtual', name: 'Virtual', colors: ['#000000', '#550000', '#aa0000', '#ff0000'] },
  { id: 'fire', name: 'Neon fogo', colors: ['#050000', '#3a0a00', '#ff3c1e', '#ffb000', '#fff3a0'] },
  { id: 'holo', name: 'Holograma', colors: ['#00040f', '#0a2a6b', '#1e7bff', '#7fd9ff', '#e8fbff'] },
  { id: 'synth', name: 'Synth', colors: ['#050008', '#5a0fa8', '#ff2fa0', '#ff9a1f', '#fff0c8'] },
  { id: 'paper', name: 'Papel', colors: ['#1b1b2f', '#6b5e4f', '#c9b89a', '#f4ecd8'] },
  { id: 'macpaint', name: '1-bit', colors: ['#000000', '#ffffff'] },
  {
    id: 'pico8', name: 'PICO-8',
    colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
  },
]

export const DEFAULT_DITHER: DitherSettings = {
  mode: 'dither',
  asciiSet: 'classic',
  asciiCustom: 'PARADISE',
  asciiSequence: false,
  asciiFont: 'mono',
  asciiBold: true,
  asciiCell: 8,
  asciiBg: '#000000',
  asciiTransparent: false,
  enabled: true,
  style: 'bayer4',
  cellShape: 'square',
  cellGap: 0,
  autoContrast: true,
  pixelSize: 3,
  patternSize: 7,
  angle: 45,
  intensity: 1,
  mix: 1,
  colorMode: 'mono',
  levels: 2,
  dark: '#111114',
  light: '#f4f1ea',
  paletteId: 'gameboy',
  palette: PALETTES[0].colors,
  brightness: 0,
  contrast: 0,
  gamma: 1,
  saturation: 1,
  invert: false,
  ...FX_OFF,
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

export function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}
