import { create } from 'zustand'
import { DEFAULT_DITHER, DitherSettings } from './dither/types'
import type { MediaKind } from './media'

export type Kind = MediaKind | 'text'
export type Tool = 'select' | 'hand' | 'text' | 'eyedrop'
export type Tab = 'dither' | 'color' | 'adjust' | 'fx' | 'object' | 'text'

export interface Crop { l: number; t: number; r: number; b: number }

export interface TextProps {
  content: string
  font: string
  size: number
  color: string
  weight: number
  align: 'left' | 'center' | 'right'
  outline: boolean
}

export interface Item {
  id: string
  kind: Kind
  name: string
  x: number
  y: number
  w: number
  h: number
  src?: string
  natW: number
  natH: number
  crop: Crop
  dither: DitherSettings
  /** Output pixels per source pixel on export. */
  exportScale: number
  text?: TextProps
}

export interface Preset { id: string; name: string; dither: DitherSettings }

export type Theme = 'auto' | 'light' | 'dark'

const loadTheme = (): Theme => {
  try { return (localStorage.getItem('dp.theme') as Theme) || 'auto' } catch { return 'auto' }
}
export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}

export interface Cam { x: number; y: number; z: number }

export interface ExportJob { label: string; progress: number }

let counter = 0
export const uid = () => Math.random().toString(36).slice(2, 8) + (counter++).toString(36)

export const isMedia = (it: Item) => it.kind !== 'text'

const loadPresets = (): Preset[] => {
  try { return JSON.parse(localStorage.getItem('dp.presets') || '[]') } catch { return [] }
}
const savePresets = (p: Preset[]) => {
  try { localStorage.setItem('dp.presets', JSON.stringify(p)) } catch { /* storage unavailable */ }
}

interface State {
  items: Item[]
  selected: string[]
  tool: Tool
  cam: Cam
  tab: Tab
  compare: boolean
  editingText: string | null
  styleClipboard: DitherSettings | null
  presets: Preset[]
  sound: boolean
  theme: Theme
  sidebarHidden: boolean
  job: ExportJob | null
  toast: string | null
  past: Item[][]
  future: Item[][]

  pushHistory: () => void
  undo: () => void
  redo: () => void
  addItems: (items: Item[]) => void
  updateItems: (ids: string[], fn: (it: Item) => Partial<Item>) => void
  patchDither: (ids: string[], patch: Partial<DitherSettings>) => void
  removeItems: (ids: string[]) => void
  duplicate: (ids: string[]) => void
  reorder: (ids: string[], dir: 'front' | 'back') => void
  select: (ids: string[]) => void
  setTool: (t: Tool) => void
  setCam: (c: Cam) => void
  setTab: (t: Tab) => void
  setCompare: (v: boolean) => void
  setEditingText: (id: string | null) => void
  copyStyle: () => void
  pasteStyle: () => void
  savePreset: (name: string, d: DitherSettings) => void
  applyPreset: (id: string) => void
  deletePreset: (id: string) => void
  setSound: (v: boolean) => void
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
  setJob: (j: ExportJob | null) => void
  showToast: (msg: string) => void
}

export const useStore = create<State>((set, get) => ({
  items: [],
  selected: [],
  tool: 'select',
  cam: { x: 0, y: 0, z: 1 },
  tab: 'dither',
  compare: false,
  editingText: null,
  styleClipboard: null,
  presets: loadPresets(),
  sound: true,
  theme: loadTheme(),
  sidebarHidden: (() => { try { return localStorage.getItem('dp.sidebarHidden') === '1' } catch { return false } })(),
  job: null,
  toast: null,
  past: [],
  future: [],

  pushHistory: () => set((s) => ({ past: [...s.past.slice(-99), s.items], future: [] })),
  undo: () => set((s) => {
    if (!s.past.length) return {}
    const prev = s.past[s.past.length - 1]
    const ids = new Set(prev.map((i) => i.id))
    return { items: prev, past: s.past.slice(0, -1), future: [s.items, ...s.future], selected: s.selected.filter((id) => ids.has(id)) }
  }),
  redo: () => set((s) => {
    if (!s.future.length) return {}
    const next = s.future[0]
    const ids = new Set(next.map((i) => i.id))
    return { items: next, future: s.future.slice(1), past: [...s.past, s.items], selected: s.selected.filter((id) => ids.has(id)) }
  }),

  addItems: (items) => {
    get().pushHistory()
    set((s) => ({ items: [...s.items, ...items], selected: items.map((i) => i.id) }))
  },
  updateItems: (ids, fn) => set((s) => ({
    items: s.items.map((it) => (ids.includes(it.id) ? { ...it, ...fn(it) } : it)),
  })),
  patchDither: (ids, patch) => set((s) => ({
    items: s.items.map((it) => (ids.includes(it.id) && isMedia(it) ? { ...it, dither: { ...it.dither, ...patch } } : it)),
  })),
  removeItems: (ids) => {
    if (!ids.length) return
    get().pushHistory()
    set((s) => ({ items: s.items.filter((it) => !ids.includes(it.id)), selected: s.selected.filter((id) => !ids.includes(id)) }))
  },
  duplicate: (ids) => {
    if (!ids.length) return
    get().pushHistory()
    const copies = get().items.filter((it) => ids.includes(it.id)).map((it) => ({
      ...it, id: uid(), x: it.x + 32, y: it.y + 32, name: it.name + ' cópia',
      dither: { ...it.dither }, crop: { ...it.crop }, text: it.text && { ...it.text },
    }))
    set((s) => ({ items: [...s.items, ...copies], selected: copies.map((c) => c.id) }))
  },
  reorder: (ids, dir) => {
    get().pushHistory()
    set((s) => {
      const moving = s.items.filter((it) => ids.includes(it.id))
      const rest = s.items.filter((it) => !ids.includes(it.id))
      return { items: dir === 'front' ? [...rest, ...moving] : [...moving, ...rest] }
    })
  },
  select: (ids) => set((s) => {
    const items = s.items.filter((it) => ids.includes(it.id))
    let tab = s.tab
    if (items.length && items.every((i) => i.kind === 'text') && tab !== 'object') tab = 'text'
    if (items.some(isMedia) && tab === 'text') tab = 'dither'
    return { selected: ids, tab, editingText: s.editingText && ids.includes(s.editingText) ? s.editingText : null }
  }),
  setTool: (tool) => set({ tool }),
  setCam: (cam) => set({ cam }),
  setTab: (tab) => set({ tab }),
  setCompare: (compare) => set({ compare }),
  setEditingText: (editingText) => set({ editingText }),
  copyStyle: () => {
    const it = get().items.find((i) => get().selected.includes(i.id) && isMedia(i))
    if (!it) return get().showToast('Selecione uma imagem ou vídeo para copiar o estilo')
    set({ styleClipboard: { ...it.dither } })
    get().showToast('Estilo copiado ✦ ' + it.name)
  },
  pasteStyle: () => {
    const { styleClipboard, selected } = get()
    if (!styleClipboard) return get().showToast('Nenhum estilo copiado ainda')
    if (!selected.length) return get().showToast('Selecione onde colar o estilo')
    get().pushHistory()
    get().patchDither(selected, { ...styleClipboard })
    get().showToast(`Estilo colado em ${selected.length} ${selected.length === 1 ? 'item' : 'itens'}`)
  },
  savePreset: (name, d) => {
    const presets = [...get().presets, { id: uid(), name, dither: { ...d } }]
    savePresets(presets)
    set({ presets })
  },
  applyPreset: (id) => {
    const p = get().presets.find((x) => x.id === id)
    if (!p || !get().selected.length) return
    get().pushHistory()
    get().patchDither(get().selected, { ...p.dither })
  },
  deletePreset: (id) => {
    const presets = get().presets.filter((p) => p.id !== id)
    savePresets(presets)
    set({ presets })
  },
  setSound: (sound) => set({ sound }),
  toggleSidebar: () => set((s) => {
    try { localStorage.setItem('dp.sidebarHidden', s.sidebarHidden ? '0' : '1') } catch { /* storage unavailable */ }
    return { sidebarHidden: !s.sidebarHidden }
  }),
  setTheme: (theme) => {
    try { localStorage.setItem('dp.theme', theme) } catch { /* storage unavailable */ }
    applyTheme(theme)
    set({ theme })
  },
  setJob: (job) => set({ job }),
  showToast: (toast) => {
    set({ toast })
    clearTimeout((window as any).__dpToast)
    ;(window as any).__dpToast = setTimeout(() => set({ toast: null }), 2200)
  },
}))

export function newMediaItem(src: string, kind: MediaKind, w: number, h: number, name: string, x: number, y: number): Item {
  const longest = Math.max(w, h)
  const fit = Math.min(1, 380 / longest)
  return {
    id: uid(), kind, name, src, natW: w, natH: h,
    x, y, w: w * fit, h: h * fit,
    crop: { l: 0, t: 0, r: 1, b: 1 },
    // Aim for a working resolution of ~480px so new items look chunky right away.
    dither: { ...DEFAULT_DITHER, pixelSize: Math.max(1, Math.round(longest / 480)), patternSize: Math.max(4, Math.round(longest / 90)) },
    exportScale: 1,
  }
}

const isDarkUI = () => {
  const t = document.documentElement.getAttribute('data-theme')
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function newTextItem(x: number, y: number): Item {
  return {
    id: uid(), kind: 'text', name: 'Texto', x, y, w: 260, h: 60, natW: 0, natH: 0,
    crop: { l: 0, t: 0, r: 1, b: 1 }, dither: { ...DEFAULT_DITHER }, exportScale: 1,
    text: { content: 'Olá!', font: 'M PLUS Rounded 1c', size: 40, color: isDarkUI() ? '#f4f1ea' : '#2b3340', weight: 800, align: 'left', outline: false },
  }
}
