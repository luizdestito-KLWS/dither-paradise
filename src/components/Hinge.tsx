import { fitView, zoomBy } from '../actions'
import { useStore } from '../store'
import { IconAuto, IconFit, IconMinus, IconMoon, IconMute, IconPlus, IconSound, IconSun } from './Icons'
import { RoundBtn } from './ui'

/** Floating zoom capsule in the corner of the canvas. */
export function ZoomDock() {
  const z = useStore((s) => s.cam.z)
  return (
    <div className="zoom-dock" onPointerDown={(e) => e.stopPropagation()}>
      <RoundBtn title="Diminuir zoom (⌘−)" onClick={() => zoomBy(1 / 1.25)}><IconMinus size={14} /></RoundBtn>
      <button className="zoom-val" onClick={() => {
        const { cam, setCam } = useStore.getState()
        const el = document.querySelector('.top-screen .viewport')!.getBoundingClientRect()
        const cx = el.width / 2, cy = el.height / 2
        setCam({ z: 1, x: cx - (cx - cam.x) / cam.z, y: cy - (cy - cam.y) / cam.z })
      }} title="Voltar para 100%">{Math.round(z * 100)}%</button>
      <RoundBtn title="Aumentar zoom (⌘+)" onClick={() => zoomBy(1.25)}><IconPlus size={14} /></RoundBtn>
      <RoundBtn title="Enquadrar tudo (⇧1)" onClick={() => fitView()}><IconFit size={14} /></RoundBtn>
    </div>
  )
}

/** Status lights and sound toggle that live in the top screen's status bar. */
export function StatusExtras() {
  const sound = useStore((s) => s.sound)
  const busy = useStore((s) => !!s.job)
  const theme = useStore((s) => s.theme)
  const next = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto'
  const label = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: escuro' }[theme]
  return (
    <>
      <button className="status-btn" title={label + ' (clique para trocar)'} aria-label={label}
        onClick={() => useStore.getState().setTheme(next)}>
        {theme === 'auto' ? <IconAuto size={14} /> : theme === 'light' ? <IconSun size={14} /> : <IconMoon size={14} />}
      </button>
      <span className="leds" aria-hidden>
        <span className="led blue" />
        <span className={'led amber' + (busy ? ' blink' : '')} />
      </span>
      <button className="status-btn" title={sound ? 'Desligar sons' : 'Ligar sons'} aria-label={sound ? 'Desligar sons' : 'Ligar sons'}
        onClick={() => useStore.getState().setSound(!sound)}>
        {sound ? <IconSound size={14} /> : <IconMute size={14} />}
      </button>
    </>
  )
}
