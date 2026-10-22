export type MediaKind = 'image' | 'video' | 'gif'

export interface Media {
  el: HTMLImageElement | HTMLVideoElement
  kind: MediaKind
  w: number
  h: number
  /** Bumped by requestVideoFrameCallback so the canvas only re-renders on new frames. */
  frame: number
}

const registry = new Map<string, Media>()
let stash: HTMLDivElement | null = null

/** Videos and GIFs only keep animating while attached to the document, so they live in a hidden stash. */
function attach(el: HTMLElement) {
  if (!stash) {
    stash = document.createElement('div')
    stash.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden'
    document.body.appendChild(stash)
  }
  stash.appendChild(el)
}

export const getMedia = (src?: string) => (src ? registry.get(src) : undefined)

export async function loadFile(file: File): Promise<{ src: string; kind: MediaKind; w: number; h: number }> {
  const src = URL.createObjectURL(file)
  if (file.type.startsWith('video/')) {
    const v = document.createElement('video')
    v.src = src
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    attach(v)
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res()
      v.onerror = () => rej(new Error('Não foi possível abrir o vídeo ' + file.name))
    })
    const m: Media = { el: v, kind: 'video', w: v.videoWidth, h: v.videoHeight, frame: 0 }
    registry.set(src, m)
    if ('requestVideoFrameCallback' in v) {
      const tick = () => { m.frame++; v.requestVideoFrameCallback(tick) }
      v.requestVideoFrameCallback(tick)
    }
    v.play().catch(() => {})
    return { src, kind: 'video', w: m.w, h: m.h }
  }
  const img = new Image()
  img.src = src
  await img.decode().catch(() => {
    throw new Error('Não foi possível abrir a imagem ' + file.name)
  })
  const kind: MediaKind = file.type === 'image/gif' ? 'gif' : 'image'
  if (kind === 'gif') attach(img)
  registry.set(src, { el: img, kind, w: img.naturalWidth, h: img.naturalHeight, frame: 0 })
  return { src, kind, w: img.naturalWidth, h: img.naturalHeight }
}

const probe = document.createElement('canvas')
probe.width = probe.height = 1
const probeCtx = probe.getContext('2d', { willReadFrequently: true })!

/** Reads one source pixel at UV (0..1) of the full media frame. */
export function samplePixel(src: string, u: number, v: number) {
  const m = registry.get(src)
  if (!m) return null
  probeCtx.clearRect(0, 0, 1, 1)
  probeCtx.drawImage(m.el, Math.floor(u * m.w), Math.floor(v * m.h), 1, 1, 0, 0, 1, 1)
  const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data
  return [r, g, b] as const
}
