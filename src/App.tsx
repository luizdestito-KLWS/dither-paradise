import { useEffect } from 'react'
import { exportItems, fitView, importFiles, pickFiles, zoomBy } from './actions'
import { BottomScreen } from './components/BottomScreen'
import { Sidebar } from './components/Sidebar'
import { TopScreen, isTyping } from './components/TopScreen'
import { blip } from './sound'
import { useStore } from './store'

function useShortcuts() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return
      const st = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); return }
      if (mod && k === 'b') { e.preventDefault(); st.toggleSidebar(); return }
      if (mod && k === 'y') { e.preventDefault(); st.redo(); return }
      if (mod && e.altKey && e.code === 'KeyC') { e.preventDefault(); st.copyStyle(); return }
      if (mod && e.altKey && e.code === 'KeyV') { e.preventDefault(); st.pasteStyle(); return }
      if (mod && k === 'd') { e.preventDefault(); st.duplicate(st.selected); return }
      if (mod && k === 'a') { e.preventDefault(); st.select(st.items.map((i) => i.id)); return }
      if (mod && k === 'e') { e.preventDefault(); exportItems(e.shiftKey || !st.selected.length ? undefined : st.selected); return }
      if (mod && k === 'o') { e.preventDefault(); pickFiles(); return }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBy(1.25); return }
      if (mod && k === '-') { e.preventDefault(); zoomBy(0.8); return }
      if (mod) return
      if (e.key === 'Backspace' || e.key === 'Delete') { st.removeItems(st.selected); blip('back') }
      else if (e.key === 'Escape') { st.select([]); st.setTool('select') }
      else if (e.key === '\\') st.setCompare(true)
      else if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) fitView()
      else if (e.shiftKey && e.code === 'Digit2') fitView(st.selected)
      else if (k === 'v') st.setTool('select')
      else if (k === 'h') st.setTool('hand')
      else if (k === 't') st.setTool('text')
      else if (k === 'i') st.setTool('eyedrop')
      else if (k === 'o') pickFiles()
      else if (e.key.startsWith('Arrow') && st.selected.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        if (!e.repeat) st.pushHistory()
        st.updateItems(st.selected, (it) => ({ x: it.x + dx, y: it.y + dy }))
      }
    }
    const up = (e: KeyboardEvent) => { if (e.key === '\\') useStore.getState().setCompare(false) }
    const paste = (e: ClipboardEvent) => {
      if (isTyping()) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length) { e.preventDefault(); importFiles(files) }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('paste', paste)
    }
  }, [])
}

function ExportModal() {
  const job = useStore((s) => s.job)
  if (!job) return null
  return (
    <div className="modal-scrim">
      <div className="modal">
        <div className="saving-spinner" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>
        <h3>Salvando…</h3>
        <p>{job.label}</p>
        <div className="progress"><span style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
        <small>Vídeos são processados em tempo real. Não feche o app.</small>
      </div>
    </div>
  )
}

function Toast() {
  const toast = useStore((s) => s.toast)
  return <div className={'toast' + (toast ? ' show' : '')} role="status">{toast}</div>
}

export function App() {
  useShortcuts()
  const sidebarHidden = useStore((s) => s.sidebarHidden)
  return (
    <div className={'app' + (sidebarHidden ? ' sidebar-hidden' : '')}>
      <Sidebar />
      <main className="device">
        <TopScreen />
        <BottomScreen />
      </main>
      <ExportModal />
      <Toast />
    </div>
  )
}
