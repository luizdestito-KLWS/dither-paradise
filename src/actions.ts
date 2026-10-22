import { zipSync } from 'fflate'
import { asciiText } from './dither/ascii'
import { outputSize, renderItem } from './dither/render'
import { getMedia, loadFile } from './media'
import { blip } from './sound'
import { Item, isMedia, newMediaItem, useStore } from './store'

/** Live display canvas of each item, so thumbnails elsewhere can copy from it. */
export const displayCanvases = new Map<string, HTMLCanvasElement>()

export function viewCenter() {
  const el = document.querySelector('.top-screen .viewport') as HTMLElement | null
  const { cam } = useStore.getState()
  const r = el?.getBoundingClientRect() ?? { width: 800, height: 400 }
  return { x: (r.width / 2 - cam.x) / cam.z, y: (r.height / 2 - cam.y) / cam.z }
}

export async function importFiles(files: File[], at?: { x: number; y: number }) {
  const media = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
  if (!media.length) return
  const store = useStore.getState()
  const center = at ?? viewCenter()
  const loaded: Item[] = []
  for (const f of media) {
    try {
      const m = await loadFile(f)
      loaded.push(newMediaItem(m.src, m.kind, m.w, m.h, f.name.replace(/\.[^.]+$/, ''), 0, 0))
    } catch (e) {
      store.showToast((e as Error).message)
    }
  }
  if (!loaded.length) return
  // Lay the new items out in a row centred on the drop point.
  const gap = 32
  const total = loaded.reduce((a, it) => a + it.w, 0) + gap * (loaded.length - 1)
  let x = center.x - total / 2
  for (const it of loaded) {
    it.x = x
    it.y = center.y - it.h / 2
    x += it.w + gap
  }
  store.addItems(loaded)
  store.setTool('select')
  blip('pop')
}

export function pickFiles() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'image/*,video/*,.gif'
  input.onchange = () => importFiles(Array.from(input.files ?? []))
  input.click()
}

export function fitView(ids?: string[]) {
  const { items, setCam } = useStore.getState()
  const list = ids?.length ? items.filter((i) => ids.includes(i.id)) : items
  const el = document.querySelector('.top-screen .viewport') as HTMLElement | null
  if (!el) return
  const r = el.getBoundingClientRect()
  if (!list.length) return setCam({ x: r.width / 2, y: r.height / 2, z: 1 })
  const x0 = Math.min(...list.map((i) => i.x)), y0 = Math.min(...list.map((i) => i.y))
  const x1 = Math.max(...list.map((i) => i.x + i.w)), y1 = Math.max(...list.map((i) => i.y + i.h))
  const pad = 56
  const z = Math.min(4, Math.max(0.05, Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0))))
  setCam({ z, x: r.width / 2 - ((x0 + x1) / 2) * z, y: r.height / 2 - ((y0 + y1) / 2) * z })
}

export function zoomBy(factor: number, sx?: number, sy?: number) {
  const { cam, setCam } = useStore.getState()
  const el = document.querySelector('.top-screen .viewport') as HTMLElement | null
  const r = el?.getBoundingClientRect()
  const px = sx ?? (r ? r.width / 2 : 0)
  const py = sy ?? (r ? r.height / 2 : 0)
  const z = Math.min(16, Math.max(0.05, cam.z * factor))
  setCam({ z, x: px - ((px - cam.x) / cam.z) * z, y: py - ((py - cam.y) / cam.z) * z })
}

// ---------- export ----------

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word } else line = test
    }
    out.push(line)
  }
  return out
}

/** Draws every text item whose centre sits on this artboard, so captions travel with their image. */
function drawTexts(ctx: CanvasRenderingContext2D, it: Item, w: number) {
  const k = w / it.w
  for (const t of useStore.getState().items) {
    if (t.kind !== 'text' || !t.text) continue
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2
    if (cx < it.x || cx > it.x + it.w || cy < it.y || cy > it.y + it.h) continue
    const p = t.text
    const size = p.size * k
    ctx.font = `${p.weight} ${size}px "${p.font}"`
    ctx.textBaseline = 'top'
    ctx.textAlign = p.align
    const boxX = (t.x - it.x) * k, boxW = t.w * k
    const x = p.align === 'left' ? boxX : p.align === 'center' ? boxX + boxW / 2 : boxX + boxW
    wrapLines(ctx, p.content, boxW).forEach((line, i) => {
      const y = (t.y - it.y) * k + i * size * 1.15 + size * 0.05
      if (p.outline) {
        ctx.lineWidth = size * 0.16
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#ffffff'
        ctx.strokeText(line, x, y)
      }
      ctx.fillStyle = p.color
      ctx.fillText(line, x, y)
    })
  }
}

let audioCtx: AudioContext | null = null
const audioSources = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>()

function pickMime() {
  const opts = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  return opts.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

async function exportVideo(it: Item, onProgress: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
  const v = getMedia(it.src)!.el as HTMLVideoElement
  const size = outputSize(it)
  const canvas = document.createElement('canvas')
  canvas.width = size.w - (size.w % 2)
  canvas.height = size.h - (size.h % 2)
  const ctx = canvas.getContext('2d')!
  const stream = canvas.captureStream(30)

  try {
    audioCtx ??= new AudioContext()
    let node = audioSources.get(v)
    if (!node) { node = audioCtx.createMediaElementSource(v); audioSources.set(v, node) }
    const dest = audioCtx.createMediaStreamDestination()
    node.connect(dest)
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
    v.muted = false
  } catch { /* export without audio */ }

  const mimeType = pickMime()
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()))

  v.pause()
  v.loop = false
  v.currentTime = 0
  await new Promise((res) => v.addEventListener('seeked', res, { once: true }))
  const frameCanvas = document.createElement('canvas')
  let running = true
  const draw = () => {
    if (!running) return
    renderItem(it, frameCanvas)
    ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height)
    drawTexts(ctx, it, canvas.width)
    onProgress(v.duration ? v.currentTime / v.duration : 0)
    if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(draw)
    else requestAnimationFrame(draw)
  }
  draw()
  rec.start(250)
  await v.play()
  await new Promise((res) => v.addEventListener('ended', res, { once: true }))
  running = false
  rec.stop()
  await stopped
  v.muted = true
  v.loop = true
  v.play().catch(() => {})
  return { blob: new Blob(chunks, { type: mimeType || 'video/webm' }), ext: mimeType.includes('mp4') ? 'mp4' : 'webm' }
}

async function exportImage(it: Item): Promise<Blob> {
  const c = document.createElement('canvas')
  renderItem(it, c)
  drawTexts(c.getContext('2d')!, it, c.width)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar PNG'))), 'image/png'))
}

export const isDesktop = () => '__TAURI_INTERNALS__' in window

async function writeNative(path: string, blob: Blob) {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('save_file', new Uint8Array(await blob.arrayBuffer()), { headers: { path: encodeURIComponent(path) } })
}

/** Desktop: native Save dialog for one file, folder picker for several. Returns false if the user cancelled. */
async function deliverNative(files: { name: string; blob: Blob }[]) {
  const { save, open } = await import('@tauri-apps/plugin-dialog')
  if (files.length === 1) {
    const ext = files[0].name.split('.').pop()!
    const path = await save({ defaultPath: files[0].name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
    if (!path) return false
    await writeNative(path, files[0].blob)
    return true
  }
  const dir = await open({ directory: true, title: `Escolha a pasta para os ${files.length} arquivos` })
  if (!dir || Array.isArray(dir)) return false
  const { join } = await import('@tauri-apps/api/path')
  for (const f of files) await writeNative(await join(dir, f.name), f.blob)
  return true
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export async function exportItems(ids?: string[]) {
  const store = useStore.getState()
  if (store.job) return
  const list = store.items.filter((i) => isMedia(i) && (!ids || ids.includes(i.id)))
  if (!list.length) return store.showToast('Nada para exportar ainda')
  const files: { name: string; blob: Blob }[] = []
  const used = new Set<string>()
  const nameFor = (base: string, ext: string) => {
    let n = `${base}-dither.${ext}`, i = 2
    while (used.has(n)) n = `${base}-dither-${i++}.${ext}`
    used.add(n)
    return n
  }
  try {
    for (let i = 0; i < list.length; i++) {
      const it = list[i]
      const base = (p: number) => store.setJob({ label: `${it.name}`, progress: (i + p) / list.length })
      base(0)
      await new Promise((r) => setTimeout(r, 30))
      if (it.kind === 'video') {
        const { blob, ext } = await exportVideo(it, base)
        files.push({ name: nameFor(it.name, ext), blob })
      } else {
        files.push({ name: nameFor(it.name, 'png'), blob: await exportImage(it) })
      }
    }
    if (isDesktop()) {
      store.setJob({ label: 'Escolha onde salvar', progress: 1 })
      if (!(await deliverNative(files))) return store.showToast('Exportação cancelada')
    } else if (files.length === 1) {
      download(files[0].blob, files[0].name)
    } else {
      store.setJob({ label: 'Empacotando .zip', progress: 1 })
      const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
      for (const f of files) entries[f.name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }]
      download(new Blob([zipSync(entries)], { type: 'application/zip' }), 'dither-paradise.zip')
    }
    blip('done')
    store.showToast(`${files.length} ${files.length === 1 ? 'arquivo salvo' : 'arquivos salvos'} ✦`)
  } catch (e) {
    store.showToast('Erro ao exportar: ' + (e as Error).message)
  } finally {
    store.setJob(null)
  }
}

/** Saves the ASCII render of each item as a plain-text file (one character per cell). */
export async function exportAsciiText(ids: string[]) {
  const store = useStore.getState()
  const list = store.items.filter((i) => isMedia(i) && ids.includes(i.id))
  const used = new Set<string>()
  const files = list.flatMap((it) => {
    const m = getMedia(it.src)
    if (!m) return []
    const text = asciiText(m.el, it.crop.l * m.w, it.crop.t * m.h, (it.crop.r - it.crop.l) * m.w, (it.crop.b - it.crop.t) * m.h, it.dither)
    let name = `${it.name}-ascii.txt`, n = 2
    while (used.has(name)) name = `${it.name}-ascii-${n++}.txt`
    used.add(name)
    return [{ name, blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) }]
  })
  if (!files.length) return
  try {
    if (isDesktop()) {
      if (!(await deliverNative(files))) return store.showToast('Exportação cancelada')
    } else if (files.length === 1) {
      download(files[0].blob, files[0].name)
    } else {
      const entries: Record<string, Uint8Array> = {}
      for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer())
      download(new Blob([zipSync(entries)], { type: 'application/zip' }), 'dither-paradise-ascii.zip')
    }
    blip('done')
    store.showToast(`${files.length} ${files.length === 1 ? 'texto salvo' : 'textos salvos'} ✦`)
  } catch (e) {
    store.showToast('Erro ao exportar: ' + (e as Error).message)
  }
}
