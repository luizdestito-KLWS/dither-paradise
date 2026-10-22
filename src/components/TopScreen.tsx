import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { displayCanvases, importFiles, pickFiles, zoomBy } from '../actions'
import { renderItem } from '../dither/render'
import { getMedia, samplePixel } from '../media'
import { blip } from '../sound'
import { Item, isMedia, newTextItem, useStore } from '../store'
import { rgbToHex } from '../dither/types'
import { IconImage, IconPlus, IconSidebar, IconStar, IconVideo } from './Icons'
import { Brackets } from './ui'
import { StatusExtras, ZoomDock } from './Hinge'

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
  | { kind: 'move'; sx: number; sy: number; orig: Map<string, { x: number; y: number }>; moved: boolean; clicked: string; shift: boolean }
  | { kind: 'resize'; id: string; handle: string; ax: number; ay: number; w0: number; h0: number; size0: number; moved: boolean }
  | { kind: 'marquee'; sx: number; sy: number; x: number; y: number; base: string[] }

/** Re-renders each item's display canvas whenever its settings, zoom bucket or video frame change. */
function useRenderLoop() {
  useEffect(() => {
    const last = new Map<string, string>()
    let raf = 0
    const tick = () => {
      const { items, cam, compare, selected } = useStore.getState()
      const dpr = window.devicePixelRatio || 1
      for (const it of items) {
        if (!isMedia(it)) continue
        const c = displayCanvases.get(it.id)
        const m = getMedia(it.src)
        if (!c || !m) continue
        // Render at real resolution (capped) so the preview matches the export; zooming never re-renders.
        const maxDim = 2048
        // Upscale with hard pixels, but let the browser average when zoomed out, or fine patterns turn to moiré.
        const ratio = (Math.max(it.w, it.h) * cam.z * dpr) / Math.max(c.width, c.height, 1)
        const rendering = ratio >= 1 ? 'pixelated' : 'auto'
        if (c.style.imageRendering !== rendering) c.style.imageRendering = rendering
        const cmp = compare && selected.includes(it.id)
        const frame = m.kind === 'video' ? `${m.frame}:${(m.el as HTMLVideoElement).currentTime}`
          : m.kind === 'gif' ? Math.floor(performance.now() / 50) : 0
        const sig = JSON.stringify([it.dither, it.crop, it.exportScale, maxDim, cmp, frame])
        if (last.get(it.id) !== sig) {
          try { renderItem(it, c, { maxDim, compare: cmp }) } catch (e) { console.error(e) }
          last.set(it.id, sig)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
}

function MediaView({ it, selected }: { it: Item; selected: boolean }) {
  return (
    <div className={'item media-item' + (selected ? ' is-selected' : '')} data-id={it.id}
      style={{ left: it.x, top: it.y, width: it.w, height: it.h }}>
      <canvas ref={(c) => { if (c) displayCanvases.set(it.id, c); else displayCanvases.delete(it.id) }} />
    </div>
  )
}

function TextView({ it, editing }: { it: Item; editing: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const t = it.text!
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      const cur = useStore.getState().items.find((i) => i.id === it.id)
      if (cur && Math.abs(cur.h - h) > 0.5) useStore.getState().updateItems([it.id], () => ({ h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [it.id])
  useLayoutEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    el.innerText = t.content
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    // Content is only read back from the DOM while editing, so React never fights the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])
  return (
    <div ref={ref} data-id={it.id}
      className={'item text-item' + (editing ? ' editing' : '') + (t.outline ? ' outlined' : '')}
      contentEditable={editing}
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => useStore.getState().updateItems([it.id], (i) => ({ text: { ...i.text!, content: (e.target as HTMLElement).innerText } }))}
      onBlur={() => useStore.getState().setEditingText(null)}
      onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur() }}
      style={{
        left: it.x, top: it.y, width: it.w,
        fontFamily: `"${t.font}"`, fontSize: t.size, color: t.color, fontWeight: t.weight, textAlign: t.align,
      }}>
      {editing ? null : t.content}
    </div>
  )
}

function SelectionOverlay() {
  const items = useStore((s) => s.items)
  const selected = useStore((s) => s.selected)
  const cam = useStore((s) => s.cam)
  const compare = useStore((s) => s.compare)
  const editing = useStore((s) => s.editingText)
  const sel = items.filter((i) => selected.includes(i.id))
  return (
    <div className="overlay">
      {sel.map((it) => (
        <div key={it.id} className="sel-box" style={{
          left: it.x * cam.z + cam.x, top: it.y * cam.z + cam.y, width: it.w * cam.z, height: it.h * cam.z,
        }}>
          <Brackets />
          {compare && isMedia(it) && <span className="sel-ribbon">ORIGINAL</span>}
          {sel.length === 1 && editing !== it.id && ['nw', 'ne', 'sw', 'se'].map((h) => (
            <span key={h} className={'handle ' + h} data-handle={h} />
          ))}
          {sel.length === 1 && (
            <span className="sel-tag">
              {it.kind === 'video' ? <IconVideo size={12} /> : it.kind === 'text' ? 'T' : <IconImage size={12} />}
              {it.name}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-card">
        <div className="empty-icons">
          <span style={{ background: 'var(--orange)' }}><IconImage size={22} /></span>
          <span style={{ background: 'var(--wii)' }}><IconVideo size={22} /></span>
          <span style={{ background: 'var(--pink)' }}><IconStar size={22} /></span>
        </div>
        <h2>Solte suas imagens aqui</h2>
        <p>Imagens, vídeos e GIFs — quantos quiser. Cada um ganha seu próprio dither.</p>
        <button className="pill blue" onClick={() => { blip('select'); pickFiles() }}>
          <IconPlus size={16} /> Importar arquivos
        </button>
      </div>
    </div>
  )
}

export function TopScreen() {
  const items = useStore((s) => s.items)
  const selected = useStore((s) => s.selected)
  const cam = useStore((s) => s.cam)
  const tool = useStore((s) => s.tool)
  const editing = useStore((s) => s.editingText)
  const sidebarHidden = useStore((s) => s.sidebarHidden)
  const viewRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  useRenderLoop()

  useLayoutEffect(() => {
    const r = viewRef.current!.getBoundingClientRect()
    useStore.getState().setCam({ x: r.width / 2, y: r.height / 2, z: 1 })
  }, [])

  useEffect(() => {
    const el = viewRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      // The wheel always zooms; panning is space+drag, the hand tool or the middle button.
      // Pinch gestures arrive with ctrlKey and tiny deltas, so they get a stronger factor.
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      zoomBy(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping()) { setSpaceHeld(true); e.preventDefault() }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const local = (e: { clientX: number; clientY: number }) => {
    const r = viewRef.current!.getBoundingClientRect()
    return { sx: e.clientX - r.left, sy: e.clientY - r.top }
  }
  const toWorld = (sx: number, sy: number) => {
    const { cam } = useStore.getState()
    return { x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    // Only the primary button selects/moves and the middle button pans; a right click must not start a gesture.
    if (e.button !== 0 && e.button !== 1) return
    if ((e.target as HTMLElement).closest('.empty-card')) return
    const st = useStore.getState()
    const { sx, sy } = local(e)
    const target =(e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id
    const handle = (e.target as HTMLElement).dataset.handle
    if (st.editingText && target === st.editingText) return
    if (st.editingText) (document.activeElement as HTMLElement)?.blur()
    const start = () => viewRef.current!.setPointerCapture(e.pointerId)

    if (e.button === 1 || tool === 'hand' || spaceHeld) {
      gesture.current = { kind: 'pan', sx, sy, cx: st.cam.x, cy: st.cam.y }
      return start()
    }
    if (handle) {
      const it = st.items.find((i) => i.id === st.selected[0])!
      const ax = handle.includes('w') ? it.x + it.w : it.x
      const ay = handle.includes('n') ? it.y + it.h : it.y
      gesture.current = { kind: 'resize', id: it.id, handle, ax, ay, w0: it.w, h0: it.h, size0: it.text?.size ?? 0, moved: false }
      return start()
    }
    const w = toWorld(sx, sy)
    if (tool === 'text') {
      e.preventDefault()
      const hit = st.items.find((i) => i.id === target)
      let id: string
      if (hit?.kind === 'text') {
        st.select([hit.id])
        st.pushHistory()
        id = hit.id
      } else {
        const t = newTextItem(w.x, w.y - 24)
        st.addItems([t])
        st.setTab('text')
        id = t.id
      }
      // Start editing after the click finishes, or the mousedown's default focus change blurs the editor.
      setTimeout(() => useStore.getState().setEditingText(id), 0)
      st.setTool('select')
      blip('pop')
      return
    }
    if (tool === 'eyedrop') {
      const it = st.items.find((i) => i.id === target)
      if (!it || !isMedia(it)) return
      const u = it.crop.l + ((w.x - it.x) / it.w) * (it.crop.r - it.crop.l)
      const v = it.crop.t + ((w.y - it.y) / it.h) * (it.crop.b - it.crop.t)
      const px = samplePixel(it.src!, u, v)
      if (!px) return
      const hex = rgbToHex(...px)
      // Picked colours feed the palette of whatever is selected, or of the item clicked.
      const ids = st.selected.filter((id) => st.items.find((i) => i.id === id && isMedia(i)))
      const dest = ids.length ? ids : [it.id]
      const first = st.items.find((i) => i.id === dest[0])!
      st.pushHistory()
      const base = first.dither.paletteId === 'custom' ? first.dither.palette : []
      st.patchDither(dest, { colorMode: 'palette', paletteId: 'custom', palette: [...base, hex].slice(-32) })
      if (!st.selected.length) st.select([it.id])
      st.setTab('color')
      st.showToast('Cor adicionada à paleta ' + hex)
      blip('pop')
      return
    }

    if (target) {
      let sel = st.selected
      if (e.shiftKey) {
        sel = sel.includes(target) ? sel.filter((s) => s !== target) : [...sel, target]
        st.select(sel)
      } else if (!sel.includes(target)) {
        sel = [target]
        st.select(sel)
      }
      blip('tap')
      const orig = new Map(st.items.filter((i) => sel.includes(i.id)).map((i) => [i.id, { x: i.x, y: i.y }]))
      gesture.current = { kind: 'move', sx, sy, orig, moved: false, clicked: target, shift: e.shiftKey }
    } else {
      const base = e.shiftKey ? st.selected : []
      if (!e.shiftKey) st.select([])
      gesture.current = { kind: 'marquee', sx, sy, x: w.x, y: w.y, base }
    }
    start()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    // Safety net: if the release was swallowed (menu, alt-tab), no button is held any more.
    if (e.buttons === 0) return onPointerUp()
    const st = useStore.getState()
    const { sx, sy } = local(e)
    if (g.kind === 'pan') {
      st.setCam({ ...st.cam, x: g.cx + sx - g.sx, y: g.cy + sy - g.sy })
    } else if (g.kind === 'move') {
      const dx = (sx - g.sx) / st.cam.z, dy = (sy - g.sy) / st.cam.z
      if (!g.moved && Math.hypot(sx - g.sx, sy - g.sy) < 3) return
      if (!g.moved) { st.pushHistory(); g.moved = true }
      st.updateItems([...g.orig.keys()], (it) => ({ x: g.orig.get(it.id)!.x + dx, y: g.orig.get(it.id)!.y + dy }))
    } else if (g.kind === 'resize') {
      if (!g.moved) { st.pushHistory(); g.moved = true }
      const w = toWorld(sx, sy)
      const k = Math.max(16 / g.w0, Math.max(Math.abs(w.x - g.ax) / g.w0, Math.abs(w.y - g.ay) / g.h0))
      const nw = g.w0 * k, nh = g.h0 * k
      st.updateItems([g.id], (it) => ({
        w: nw, h: nh,
        x: g.handle.includes('w') ? g.ax - nw : g.ax,
        y: g.handle.includes('n') ? g.ay - nh : g.ay,
        ...(it.text ? { text: { ...it.text, size: Math.max(4, g.size0 * k) } } : {}),
      }))
    } else if (g.kind === 'marquee') {
      const w = toWorld(sx, sy)
      const x0 = Math.min(g.x, w.x), y0 = Math.min(g.y, w.y), x1 = Math.max(g.x, w.x), y1 = Math.max(g.y, w.y)
      setMarquee({ x: Math.min(g.sx, sx), y: Math.min(g.sy, sy), w: Math.abs(sx - g.sx), h: Math.abs(sy - g.sy) })
      const hits = st.items.filter((i) => i.x < x1 && i.x + i.w > x0 && i.y < y1 && i.y + i.h > y0).map((i) => i.id)
      st.select([...new Set([...g.base, ...hits])])
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    // A plain click on one member of a multi-selection narrows the selection to it.
    if (g?.kind === 'move' && !g.moved && !g.shift && useStore.getState().selected.length > 1) {
      useStore.getState().select([g.clicked])
    }
    gesture.current = null
    setMarquee(null)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id
    const st = useStore.getState()
    const it = st.items.find((i) => i.id === id)
    if (it?.kind === 'text') {
      st.pushHistory()
      st.select([it.id])
      setTimeout(() => useStore.getState().setEditingText(it.id), 0)
    }
  }

  // Grid spacing doubles/halves so lines stay 14–28px apart on screen at any zoom.
  let grid = 24 * cam.z
  while (grid < 14) grid *= 2
  while (grid > 28) grid /= 2

  const cursor = spaceHeld || tool === 'hand' ? (gesture.current?.kind === 'pan' ? 'grabbing' : 'grab')
    : tool === 'text' ? 'text' : tool === 'eyedrop' ? 'crosshair' : 'default'

  return (
    <section className="screen top-screen">
      <header className="statusbar">
        <span className="status-name">
          <button className={'status-btn' + (sidebarHidden ? ' on' : '')} onClick={() => useStore.getState().toggleSidebar()}
            title={(sidebarHidden ? 'Mostrar' : 'Esconder') + ' barra de ferramentas (⌘B)'}
            aria-label={(sidebarHidden ? 'Mostrar' : 'Esconder') + ' barra de ferramentas'} aria-pressed={!sidebarHidden}>
            <IconSidebar size={15} />
          </button>
          <IconStar size={12} /> Dither Paradise
        </span>
        <span className="status-mid">
          {items.length} {items.length === 1 ? 'item' : 'itens'}
          {selected.length > 0 && <> · <b>{selected.length} selecionado{selected.length > 1 ? 's' : ''}</b></>}
        </span>
        <span className="status-right">
          <StatusExtras />
        </span>
      </header>
      <div
        ref={viewRef}
        className={'viewport' + (dragOver ? ' drag-over' : '')}
        style={{
          cursor,
          backgroundSize: `${grid}px ${grid}px, ${grid * 5}px ${grid * 5}px, ${grid * 5}px ${grid * 5}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={onDoubleClick}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const { sx, sy } = local(e)
          importFiles(Array.from(e.dataTransfer.files), toWorld(sx, sy))
        }}
      >
        <div className="world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})` }}>
          {items.map((it) => it.kind === 'text'
            ? <TextView key={it.id} it={it} editing={editing === it.id} />
            : <MediaView key={it.id} it={it} selected={selected.includes(it.id)} />)}
        </div>
        <SelectionOverlay />
        {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
        {items.length === 0 && <EmptyState />}
        {dragOver && <div className="drop-hint">Solte para adicionar ✦</div>}
        <ZoomDock />
      </div>
    </section>
  )
}

export const isTyping = () => {
  const a = document.activeElement as HTMLElement | null
  return !!a && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')
}
