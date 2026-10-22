import type { CSSProperties, ReactNode } from 'react'
import { blip } from '../sound'
import { useStore } from '../store'

export const Brackets = ({ tight = false }: { tight?: boolean }) => (
  <span className={'brackets' + (tight ? ' tight' : '')} aria-hidden>
    <i /><i /><i /><i />
  </span>
)

export function Tile(props: {
  label: string
  color: string
  icon: ReactNode
  active?: boolean
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      className={'tile' + (props.active ? ' active' : '')}
      style={{ '--c': props.color } as CSSProperties}
      onClick={() => { blip(props.active ? 'tap' : 'select'); props.onClick() }}
      title={props.hint ? `${props.label} (${props.hint})` : props.label}
    >
      <span className="tile-face">{props.icon}</span>
      <span className="tile-label">{props.label}</span>
      {props.hint && <kbd className="tile-key">{props.hint}</kbd>}
      {props.active && <Brackets />}
    </button>
  )
}

export function Pill(props: {
  children: ReactNode
  onClick: () => void
  badge?: string
  tone?: 'blue' | 'plain' | 'danger'
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      className={'pill ' + (props.tone ?? 'plain')}
      disabled={props.disabled}
      title={props.title}
      onClick={() => { blip(props.tone === 'blue' ? 'select' : 'tap'); props.onClick() }}
    >
      {props.badge && <span className="pill-badge">{props.badge}</span>}
      {props.children}
    </button>
  )
}

export function RoundBtn(props: { children: ReactNode; onClick: () => void; title: string; disabled?: boolean; on?: boolean }) {
  return (
    <button className={'round' + (props.on ? ' on' : '')} title={props.title} aria-label={props.title} disabled={props.disabled}
      onClick={() => { blip('tap'); props.onClick() }}>
      {props.children}
    </button>
  )
}

export function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  def?: number
  mixed?: boolean
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100
  return (
    <label className="slider" onDoubleClick={() => {
      if (props.def === undefined) return
      useStore.getState().pushHistory()
      props.onChange(props.def)
    }} title={props.def !== undefined ? 'Duplo clique para resetar' : undefined}>
      <span className="slider-head">
        <span className="slider-label">{props.label}{props.mixed && <em className="mixed" title="Valores diferentes entre os selecionados">≠</em>}</span>
        <span className="slider-value">{props.format ? props.format(props.value) : props.value}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        style={{ '--p': `${pct}%` } as CSSProperties}
        onPointerDown={() => useStore.getState().pushHistory()}
        onKeyDown={() => useStore.getState().pushHistory()}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
    </label>
  )
}

export function Seg<T extends string>(props: {
  value: T | null
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="radiogroup">
      {props.options.map((o) => (
        <button key={o.value} role="radio" aria-checked={props.value === o.value}
          className={props.value === o.value ? 'on' : ''}
          onClick={() => { blip('tap'); props.onChange(o.value) }}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

export function Diamond(props: { color: string; onChange?: (c: string) => void; onRemove?: () => void; size?: number; title?: string }) {
  const size = props.size ?? 30
  return (
    <span className="diamond-wrap" style={{ width: size + 8, height: size + 8 }} title={props.title}>
      <label className="diamond" style={{ background: props.color, width: size, height: size }}>
        {props.onChange && (
          <input type="color" value={props.color}
            onClick={() => useStore.getState().pushHistory()}
            onChange={(e) => props.onChange!(e.target.value)} />
        )}
      </label>
      {props.onRemove && <button className="diamond-x" onClick={props.onRemove} aria-label="Remover cor">×</button>}
    </span>
  )
}

export function Toggle(props: { label: string; on: boolean; mixed?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={'toggle' + (props.on ? ' on' : '')} role="switch" aria-checked={props.on}
      onClick={() => { blip(props.on ? 'back' : 'select'); useStore.getState().pushHistory(); props.onChange(!props.on) }}>
      <span className="toggle-track"><span className="toggle-knob" /></span>
      {props.label}{props.mixed && <em className="mixed">≠</em>}
    </button>
  )
}
