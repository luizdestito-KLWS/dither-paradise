import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { displayCanvases, exportItems, pickFiles } from '../actions'
import { outputSize, renderItem } from '../dither/render'
import { DEFAULT_DITHER, DitherSettings, FX_OFF, PALETTES, STYLES, StyleGroup, StyleId, styleDef } from '../dither/types'
import { getMedia } from '../media'
import { blip } from '../sound'
import { Item, Tab, isMedia, useStore } from '../store'
import {
  IconBack, IconBox, IconDither, IconDuplicate, IconExport, IconFront, IconHome, IconImage, IconPalette,
  IconPause, IconPlay, IconPlus, IconSliders, IconSparkle, IconStar, IconText, IconTrash, IconVideo,
} from './Icons'
import { Brackets, Diamond, Pill, Seg, Slider, Toggle } from './ui'

const pct = (v: number) => `${Math.round(v * 100)}%`
const signed = (v: number) => (v > 0 ? '+' : '') + Math.round(v * 100)

function useSelection() {
  const items = useStore((s) => s.items)
  const selected = useStore((s) => s.selected)
  return useMemo(() => items.filter((i) => selected.includes(i.id)), [items, selected])
}

/** Field-wise editing across the selection: each control only touches its own key on each item. */
function useDitherEdit(list: Item[]) {
  const media = list.filter(isMedia)
  const ids = media.map((i) => i.id)
  const d = media[0]?.dither ?? DEFAULT_DITHER
  const set = (patch: Partial<DitherSettings>) => useStore.getState().patchDither(ids, patch)
  const commit = (patch: Partial<DitherSettings>) => { useStore.getState().pushHistory(); set(patch) }
  const mixed = (k: keyof DitherSettings) => media.some((i) => JSON.stringify(i.dither[k]) !== JSON.stringify(d[k]))
  return { media, ids, d, set, commit, mixed }
}

// ---------- Dither tab ----------

const SAMPLE = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(36, 34, 4, 48, 48, 60)
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.35, '#7fd6f5'); grad.addColorStop(0.75, '#2a6fb0'); grad.addColorStop(1, '#141a33')
  g.fillStyle = grad
  g.fillRect(0, 0, 96, 96)
  return c
})()

function StyleTile({ item, style, active, onPick }: { item: Item; style: StyleId; active: boolean; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sig = JSON.stringify([item.src, item.crop, { ...item.dither, style: undefined }])
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const raf = requestAnimationFrame(() => {
      const ok = getMedia(item.src) && renderItem(item, c, { maxDim: 112, pxMin: 2, noFx: true, override: { style, enabled: true } })
      if (!ok) { c.width = 96; c.height = 96; c.getContext('2d')!.drawImage(SAMPLE, 0, 0) }
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, style])
  return (
    <button className={'style-tile' + (active ? ' active' : '')} onClick={() => { blip('select'); onPick() }}>
      <span className="style-thumb"><canvas ref={ref} /></span>
      <span className="style-name">{styleDef(style).label}</span>
      {active && <Brackets tight />}
    </button>
  )
}

function DitherTab({ list }: { list: Item[] }) {
  const { media, d, set, commit, mixed } = useDitherEdit(list)
  const presets = useStore((s) => s.presets)
  const groups: StyleGroup[] = ['Ordenado', 'Padrão', 'Ruído', 'Difusão', 'Especial']
  const isPattern = ['halftone', 'lines', 'cross'].includes(d.style)
  const sameStyle = !mixed('style')
  const scroller = useRef<HTMLDivElement>(null)
  const jump = (g: StyleGroup) => {
    blip('tap')
    const el = scroller.current?.querySelector<HTMLElement>(`[data-group="${g}"]`)
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' })
  }
  return (
    <div className="panel two-col">
      <div className="col style-col">
        <nav className="group-chips">
          {groups.map((g) => (
            <button key={g} onClick={() => jump(g)}
              className={sameStyle && styleDef(d.style).group === g ? 'on' : ''}>
              {g} <small>{STYLES.filter((s) => s.group === g).length}</small>
            </button>
          ))}
        </nav>
        <div className="scroll" ref={scroller}>
          {groups.map((g) => (
            <div key={g} className="style-group" data-group={g}>
              <h4 className="group-title">{g}{(g === 'Difusão' || g === 'Especial') && <small> · mais lento em vídeo</small>}</h4>
              <div className="style-grid">
                {STYLES.filter((s) => s.group === g).map((s) => (
                  <StyleTile key={s.id} item={media[0]} style={s.id} active={sameStyle && d.style === s.id}
                    onPick={() => commit({ style: s.id, enabled: true })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="col controls">
        <Toggle label="Dither ligado" on={d.enabled} mixed={mixed('enabled')} onChange={(v) => set({ enabled: v })} />
        {isPattern ? (
          <>
            <Slider label="Tamanho do padrão" value={d.patternSize} min={3} max={64} def={8} mixed={mixed('patternSize')} format={(v) => v + 'px'} onChange={(v) => set({ patternSize: v })} />
            <Slider label="Ângulo" value={d.angle} min={0} max={90} def={45} mixed={mixed('angle')} format={(v) => v + '°'} onChange={(v) => set({ angle: v })} />
          </>
        ) : (
          <Slider label="Tamanho do pixel" value={d.pixelSize} min={1} max={32} def={2} mixed={mixed('pixelSize')} format={(v) => v + 'px'} onChange={(v) => set({ pixelSize: v })} />
        )}
        <Slider label="Intensidade" value={d.intensity} min={0} max={1} step={0.01} def={1} mixed={mixed('intensity')} format={pct} onChange={(v) => set({ intensity: v })} />
        <Slider label="Mistura com original" value={d.mix} min={0} max={1} step={0.01} def={1} mixed={mixed('mix')} format={pct} onChange={(v) => set({ mix: v })} />
        <div className="presets">
          <h4 className="group-title">Meus estilos</h4>
          <div className="preset-row">
            {presets.map((p) => (
              <span key={p.id} className="preset-chip">
                <button onClick={() => { blip('select'); useStore.getState().applyPreset(p.id) }} title="Aplicar aos selecionados">
                  <IconStar size={12} />{p.name}
                </button>
                <button className="x" onClick={() => useStore.getState().deletePreset(p.id)} aria-label={'Apagar ' + p.name}>×</button>
              </span>
            ))}
            <button className="preset-add" onClick={() => {
              const name = prompt('Nome do estilo', `${styleDef(d.style).label} ${presets.length + 1}`)
              if (name) { useStore.getState().savePreset(name, d); blip('pop') }
            }}><IconPlus size={12} /> Salvar atual</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Color tab ----------

const DUOS: [string, string, string][] = [
  ['Tinta', '#1b1b2f', '#f4f1ea'], ['Game Boy', '#0f380f', '#9bbc0f'], ['Céu', '#0b2a45', '#bfe9f7'],
  ['Chiclete', '#4a1942', '#ffc4e5'], ['Âmbar', '#2b1600', '#ffb000'], ['P&B', '#000000', '#ffffff'],
  ['Fósforo', '#000000', '#33ff66'], ['Ciano', '#00060f', '#5ff3ff'], ['Lava', '#0a0000', '#ff7a1a'],
]

function ColorTab({ list }: { list: Item[] }) {
  const { d, set, commit, mixed } = useDitherEdit(list)
  return (
    <div className="panel two-col">
      <div className="col controls">
        <Seg value={mixed('colorMode') ? null : d.colorMode} onChange={(v) => commit({ colorMode: v, levels: v === 'mono' ? 2 : v === 'original' ? 3 : d.levels })} options={[
          { value: 'mono', label: 'Mono' }, { value: 'original', label: 'Cores originais' }, { value: 'palette', label: 'Paleta' },
        ]} />
        {d.colorMode === 'mono' && (
          <>
            <div className="duo-edit">
              <span className="duo-pick"><Diamond color={d.dark} size={34} onChange={(c) => set({ dark: c })} />Escuro</span>
              <button className="swap" onClick={() => { blip('tap'); commit({ dark: d.light, light: d.dark }) }} title="Inverter cores">⇄</button>
              <span className="duo-pick"><Diamond color={d.light} size={34} onChange={(c) => set({ light: c })} />Claro</span>
            </div>
            <Slider label="Tons" value={d.levels} min={2} max={8} def={2} mixed={mixed('levels')} onChange={(v) => set({ levels: v })} />
          </>
        )}
        {d.colorMode === 'original' && (
          <>
            <Slider label="Níveis por canal" value={d.levels} min={2} max={16} def={3} mixed={mixed('levels')} onChange={(v) => set({ levels: v })} />
            <p className="hint">Mantém as cores da imagem, reduzindo cada canal a poucos níveis. 2 níveis = 8 cores.</p>
          </>
        )}
        {d.colorMode === 'palette' && (
          <>
            <h4 className="group-title">Paleta atual {d.paletteId === 'custom' && <small>· personalizada</small>}</h4>
            <div className="palette-edit">
              {d.palette.map((c, i) => (
                <Diamond key={i + c} color={c}
                  onChange={(nc) => set({ paletteId: 'custom', palette: d.palette.map((x, j) => (j === i ? nc : x)) })}
                  onRemove={d.palette.length > 2 ? () => commit({ paletteId: 'custom', palette: d.palette.filter((_, j) => j !== i) }) : undefined} />
              ))}
              {d.palette.length < 32 && (
                <button className="add-color" onClick={() => { blip('pop'); commit({ paletteId: 'custom', palette: [...d.palette, '#ffffff'] }) }} aria-label="Adicionar cor"><IconPlus size={14} /></button>
              )}
            </div>
            <p className="hint">Dica: use o Conta-gotas na barra lateral para puxar cores direto da imagem.</p>
          </>
        )}
      </div>
      <div className="col scroll">
        {d.colorMode === 'mono' && (
          <div className="card-grid">
            {DUOS.map(([name, a, b]) => (
              <button key={name} className={'pal-card' + (d.dark === a && d.light === b ? ' active' : '')} onClick={() => { blip('select'); commit({ dark: a, light: b }) }}>
                <span className="pal-swatches duo" style={{ background: `linear-gradient(90deg, ${a} 50%, ${b} 50%)` }} />
                <span>{name}</span>
                {d.dark === a && d.light === b && <Brackets tight />}
              </button>
            ))}
          </div>
        )}
        {d.colorMode !== 'mono' && (
          <div className="card-grid">
            {PALETTES.map((p) => {
              const on = d.colorMode === 'palette' && d.paletteId === p.id
              return (
                <button key={p.id} className={'pal-card' + (on ? ' active' : '')}
                  onClick={() => { blip('select'); commit({ colorMode: 'palette', paletteId: p.id, palette: p.colors }) }}>
                  <span className="pal-swatches">{p.colors.slice(0, 16).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                  <span>{p.name}</span>
                  {on && <Brackets tight />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Adjust tab ----------

function AdjustTab({ list }: { list: Item[] }) {
  const { d, set, commit, mixed, media } = useDitherEdit(list)
  const st = useStore.getState()
  const crop = media[0].crop
  const cropMixed = media.some((i) => JSON.stringify(i.crop) !== JSON.stringify(crop))
  const setCrop = (patch: Partial<typeof crop>) => {
    st.updateItems(media.map((i) => i.id), (it) => {
      const c = { ...it.crop, ...patch }
      if (c.r - c.l < 0.05 || c.b - c.t < 0.05) return {}
      // Keep the on-canvas width; height follows the new aspect ratio.
      const h = it.w * ((c.b - c.t) * it.natH) / ((c.r - c.l) * it.natW)
      return { crop: c, h }
    })
  }
  return (
    <div className="panel two-col">
      <div className="col controls">
        <h4 className="group-title">Tom</h4>
        <Slider label="Brilho" value={d.brightness} min={-0.5} max={0.5} step={0.01} def={0} mixed={mixed('brightness')} format={signed} onChange={(v) => set({ brightness: v })} />
        <Slider label="Contraste" value={d.contrast} min={-0.8} max={1.5} step={0.01} def={0} mixed={mixed('contrast')} format={signed} onChange={(v) => set({ contrast: v })} />
        <Slider label="Gama" value={d.gamma} min={0.3} max={3} step={0.01} def={1} mixed={mixed('gamma')} format={(v) => v.toFixed(2)} onChange={(v) => set({ gamma: v })} />
        <Slider label="Saturação" value={d.saturation} min={0} max={2} step={0.01} def={1} mixed={mixed('saturation')} format={pct} onChange={(v) => set({ saturation: v })} />
        <div className="row">
          <Toggle label="Inverter" on={d.invert} mixed={mixed('invert')} onChange={(v) => set({ invert: v })} />
          <Pill onClick={() => commit({ brightness: 0, contrast: 0, gamma: 1, saturation: 1, invert: false })}>Resetar tom</Pill>
        </div>
      </div>
      <div className="col controls">
        <h4 className="group-title">Recorte{cropMixed && <em className="mixed">≠</em>}</h4>
        <Slider label="Esquerda" value={crop.l} min={0} max={0.9} step={0.005} def={0} format={pct} onChange={(v) => setCrop({ l: Math.min(v, crop.r - 0.05) })} />
        <Slider label="Direita" value={1 - crop.r} min={0} max={0.9} step={0.005} def={0} format={pct} onChange={(v) => setCrop({ r: Math.max(1 - v, crop.l + 0.05) })} />
        <Slider label="Topo" value={crop.t} min={0} max={0.9} step={0.005} def={0} format={pct} onChange={(v) => setCrop({ t: Math.min(v, crop.b - 0.05) })} />
        <Slider label="Base" value={1 - crop.b} min={0} max={0.9} step={0.005} def={0} format={pct} onChange={(v) => setCrop({ b: Math.max(1 - v, crop.t + 0.05) })} />
        <Pill onClick={() => { st.pushHistory(); setCrop({ l: 0, t: 0, r: 1, b: 1 }) }}>Sem recorte</Pill>
      </div>
    </div>
  )
}

// ---------- Effects tab ----------

const FX_PRESETS: { name: string; fx: Partial<DitherSettings> }[] = [
  { name: 'Limpo', fx: FX_OFF },
  { name: 'Neon', fx: { ...FX_OFF, glow: 1.4, glowRadius: 16, glowThreshold: 0.3, blur: 0.6, chroma: 1.5, vignette: 0.35 } },
  { name: 'CRT', fx: { ...FX_OFF, glow: 0.6, glowRadius: 8, glowThreshold: 0.5, blur: 0.5, chroma: 1.2, scanlines: 0.55, scanlineSize: 4, mask: 0.35, vignette: 0.45, grain: 0.12 } },
  { name: 'Holograma', fx: { ...FX_OFF, glow: 1.1, glowRadius: 14, glowThreshold: 0.35, chroma: 2.5, scanlines: 0.35, scanlineSize: 3, wave: 2, wavePeriod: 26, grain: 0.18 } },
  { name: 'VHS', fx: { ...FX_OFF, glow: 0.4, glowRadius: 10, blur: 1.2, chroma: 4, scanlines: 0.25, scanlineSize: 3, wave: 3.5, wavePeriod: 60, vignette: 0.3, grain: 0.35 } },
  { name: 'Brasa', fx: { ...FX_OFF, glow: 2, glowRadius: 28, glowThreshold: 0.2, blur: 0.3, vignette: 0.5 } },
]

function FxTab({ list }: { list: Item[] }) {
  const { d, set, commit, mixed } = useDitherEdit(list)
  const v = (k: keyof typeof FX_OFF) => (d[k] as number | undefined) ?? FX_OFF[k]
  const on = (p: Partial<DitherSettings>) => Object.entries(p).every(([k, val]) => v(k as keyof typeof FX_OFF) === val)
  return (
    <div className="panel two-col">
      <div className="col controls">
        <div className="fx-presets">
          {FX_PRESETS.map((p) => (
            <button key={p.name} className={'fx-chip' + (on(p.fx) ? ' on' : '')} onClick={() => { blip('select'); commit(p.fx) }}>
              <IconSparkle size={12} />{p.name}
            </button>
          ))}
        </div>
        <h4 className="group-title">Luminância</h4>
        <Slider label="Brilho (glow)" value={v('glow')} min={0} max={3} step={0.01} def={0} mixed={mixed('glow')} format={pct} onChange={(x) => set({ glow: x })} />
        <Slider label="Raio do brilho" value={v('glowRadius')} min={1} max={80} step={0.5} def={12} mixed={mixed('glowRadius')} format={(x) => x.toFixed(0)} onChange={(x) => set({ glowRadius: x })} />
        <Slider label="Limiar do brilho" value={v('glowThreshold')} min={0} max={0.95} step={0.01} def={0.45} mixed={mixed('glowThreshold')} format={pct} onChange={(x) => set({ glowThreshold: x })} />
        <Slider label="Desfoque" value={v('blur')} min={0} max={12} step={0.1} def={0} mixed={mixed('blur')} format={(x) => x.toFixed(1)} onChange={(x) => set({ blur: x })} />
      </div>
      <div className="col controls">
        <h4 className="group-title">Monitor antigo</h4>
        <Slider label="Scanlines" value={v('scanlines')} min={0} max={1} step={0.01} def={0} mixed={mixed('scanlines')} format={pct} onChange={(x) => set({ scanlines: x })} />
        <Slider label="Espaço das linhas" value={v('scanlineSize')} min={2} max={16} step={0.5} def={4} mixed={mixed('scanlineSize')} format={(x) => x.toFixed(1)} onChange={(x) => set({ scanlineSize: x })} />
        <Slider label="Máscara RGB" value={v('mask')} min={0} max={1} step={0.01} def={0} mixed={mixed('mask')} format={pct} onChange={(x) => set({ mask: x })} />
        <Slider label="Aberração cromática" value={v('chroma')} min={0} max={12} step={0.1} def={0} mixed={mixed('chroma')} format={(x) => x.toFixed(1)} onChange={(x) => set({ chroma: x })} />
        <Slider label="Vinheta" value={v('vignette')} min={0} max={1} step={0.01} def={0} mixed={mixed('vignette')} format={pct} onChange={(x) => set({ vignette: x })} />
        <Slider label="Grão" value={v('grain')} min={0} max={1} step={0.01} def={0} mixed={mixed('grain')} format={pct} onChange={(x) => set({ grain: x })} />
        <h4 className="group-title">Distorção</h4>
        <Slider label="Ondulação" value={v('wave')} min={0} max={20} step={0.1} def={0} mixed={mixed('wave')} format={(x) => x.toFixed(1)} onChange={(x) => set({ wave: x })} />
        <Slider label="Comprimento da onda" value={v('wavePeriod')} min={4} max={200} step={1} def={40} mixed={mixed('wavePeriod')} onChange={(x) => set({ wavePeriod: x })} />
      </div>
    </div>
  )
}

// ---------- Object tab ----------

function VideoControls({ list }: { list: Item[] }) {
  const videos = list.filter((i) => i.kind === 'video').map((i) => getMedia(i.src)!.el as HTMLVideoElement)
  const [, force] = useState(0)
  if (!videos.length) return null
  const playing = videos.some((v) => !v.paused)
  return (
    <div className="row">
      <Pill tone="blue" onClick={() => { videos.forEach((v) => (playing ? v.pause() : v.play())); force((n) => n + 1) }}>
        {playing ? <><IconPause size={14} /> Pausar</> : <><IconPlay size={14} /> Tocar</>}
      </Pill>
      <Pill onClick={() => { videos.forEach((v) => (v.currentTime = 0)); force((n) => n + 1) }}>⏮ Início</Pill>
    </div>
  )
}

function ObjectTab({ list }: { list: Item[] }) {
  const st = useStore.getState()
  const ids = list.map((i) => i.id)
  const media = list.filter(isMedia)
  const first = list[0]
  return (
    <div className="panel two-col">
      <div className="col controls">
        {list.length === 1 ? (
          <label className="field">
            <span>Nome</span>
            <input value={first.name} onFocus={() => st.pushHistory()}
              onChange={(e) => st.updateItems([first.id], () => ({ name: e.target.value }))} />
          </label>
        ) : <p className="hint big">{list.length} objetos selecionados. Cada um mantém sua própria edição; o que você mudar aqui vale só para o campo alterado.</p>}
        {media.length > 0 && (
          <>
            <h4 className="group-title">Tamanho de exportação</h4>
            <Seg value={media.every((m) => m.exportScale === media[0].exportScale) ? String(media[0].exportScale) : null}
              onChange={(v) => { st.pushHistory(); st.updateItems(media.map((m) => m.id), () => ({ exportScale: parseFloat(v) })) }}
              options={['0.5', '1', '2', '4'].map((v) => ({ value: v, label: v + '×' }))} />
            <p className="hint">{media.slice(0, 3).map((m) => { const s = outputSize(m); return `${m.name}: ${s.w}×${s.h}px` }).join(' · ')}{media.length > 3 && ' …'}</p>
          </>
        )}
        <VideoControls list={list} />
      </div>
      <div className="col controls">
        <h4 className="group-title">Arranjar</h4>
        <div className="action-grid">
          <ActionBtn color="var(--wii)" icon={<IconFront size={20} />} label="Para frente" onClick={() => st.reorder(ids, 'front')} />
          <ActionBtn color="var(--purple)" icon={<IconBack size={20} />} label="Para trás" onClick={() => st.reorder(ids, 'back')} />
          <ActionBtn color="var(--green)" icon={<IconDuplicate size={20} />} label="Duplicar" onClick={() => st.duplicate(ids)} />
          <ActionBtn color="var(--red)" icon={<IconTrash size={20} />} label="Apagar" onClick={() => st.removeItems(ids)} />
        </div>
      </div>
    </div>
  )
}

function ActionBtn(p: { color: string; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="action-btn" style={{ '--c': p.color } as React.CSSProperties} onClick={() => { blip('select'); p.onClick() }}>
      <span className="tile-face small">{p.icon}</span>{p.label}
    </button>
  )
}

// ---------- Text tab ----------

const FONTS = [
  { value: 'M PLUS Rounded 1c', label: 'Redonda' },
  { value: 'DotGothic16', label: 'Pixel' },
  { value: 'Georgia', label: 'Serifa' },
  { value: 'Menlo', label: 'Mono' },
]
const TEXT_COLORS = ['#2b3340', '#ffffff', '#33bdee', '#ff7eb6', '#ffd23f', '#5ccf4a', '#ff5d5d', '#9b7bff']

function TextTab({ list }: { list: Item[] }) {
  const st = useStore.getState()
  const texts = list.filter((i) => i.kind === 'text')
  const t = texts[0].text!
  const ids = texts.map((i) => i.id)
  const setT = (patch: Partial<typeof t>) => st.updateItems(ids, (it) => ({ text: { ...it.text!, ...patch } }))
  const commitT = (patch: Partial<typeof t>) => { st.pushHistory(); setT(patch) }
  return (
    <div className="panel two-col">
      <div className="col controls">
        {texts.length === 1 && (
          <textarea className="text-input" value={t.content} rows={2} onFocus={() => st.pushHistory()}
            onChange={(e) => setT({ content: e.target.value })} />
        )}
        <Seg value={t.font} onChange={(v) => commitT({ font: v })} options={FONTS} />
        <Slider label="Tamanho" value={Math.round(t.size)} min={8} max={240} def={40} format={(v) => v + 'px'}
          onChange={(v) => st.updateItems(ids, (it) => ({ w: it.w * (v / it.text!.size), text: { ...it.text!, size: v } }))} />
        <div className="row">
          <Seg value={t.align} onChange={(v) => commitT({ align: v })} options={[
            { value: 'left', label: 'Esq.' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Dir.' },
          ]} />
          <Seg value={String(t.weight)} onChange={(v) => commitT({ weight: Number(v) })} options={[
            { value: '500', label: 'Normal' }, { value: '800', label: 'Negrito' },
          ]} />
        </div>
      </div>
      <div className="col controls">
        <h4 className="group-title">Cor</h4>
        <div className="palette-edit">
          {TEXT_COLORS.map((c) => (
            <button key={c} className={'diamond-btn' + (t.color === c ? ' on' : '')} onClick={() => { blip('tap'); commitT({ color: c }) }}>
              <Diamond color={c} size={26} />
            </button>
          ))}
          <Diamond color={t.color} size={26} title="Cor personalizada" onChange={(c) => setT({ color: c })} />
        </div>
        <Toggle label="Contorno branco" on={t.outline} onChange={(v) => setT({ outline: v })} />
        <p className="hint">O texto é exportado junto com a imagem ou vídeo onde ele estiver por cima.</p>
      </div>
    </div>
  )
}

// ---------- Home (nothing selected) ----------

function HomeThumb({ it }: { it: Item }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const copy = () => {
      const src = displayCanvases.get(it.id), c = ref.current
      if (!src || !c || !src.width) return
      const s = Math.min(1, 160 / Math.max(src.width, src.height))
      c.width = Math.max(1, src.width * s); c.height = Math.max(1, src.height * s)
      const g = c.getContext('2d')!
      g.imageSmoothingEnabled = false
      g.drawImage(src, 0, 0, c.width, c.height)
    }
    copy()
    const t = setInterval(copy, it.kind === 'image' ? 900 : 120)
    return () => clearInterval(t)
  }, [it.id, it.kind])
  return <canvas ref={ref} />
}

function Home() {
  const items = useStore((s) => s.items)
  const st = useStore.getState()
  return (
    <div className="panel home scroll">
      <div className="channel-grid">
        {items.map((it) => (
          <button key={it.id} className="channel" onClick={() => { blip('select'); st.select([it.id]) }} title={it.name}>
            <span className="channel-screen">
              {it.kind === 'text' ? <span className="channel-text" style={{ fontFamily: `"${it.text!.font}"` }}>{it.text!.content}</span> : <HomeThumb it={it} />}
              {it.kind === 'video' && <span className="channel-kind"><IconVideo size={12} /></span>}
              {it.kind === 'gif' && <span className="channel-kind">GIF</span>}
            </span>
            <span className="channel-name">{it.name}</span>
          </button>
        ))}
        <button className="channel add" onClick={() => { blip('select'); pickFiles() }}>
          <span className="channel-screen"><span className="tile-face" style={{ '--c': 'var(--orange)' } as React.CSSProperties}><IconPlus size={22} /></span></span>
          <span className="channel-name">Importar</span>
        </button>
      </div>
      {items.length === 0 && <p className="hint big center">Seus arquivos aparecem aqui como canais. Arraste para a tela de cima ou toque em Importar.</p>}
    </div>
  )
}

// ---------- Shell ----------

const TABS: { id: Tab; label: string; icon: ReactNode; color: string; media?: boolean; text?: boolean }[] = [
  { id: 'dither', label: 'Dither', icon: <IconDither size={18} />, color: 'var(--wii)', media: true },
  { id: 'color', label: 'Cor', icon: <IconPalette size={18} />, color: 'var(--pink)', media: true },
  { id: 'adjust', label: 'Ajustes', icon: <IconSliders size={18} />, color: 'var(--yellow)', media: true },
  { id: 'fx', label: 'Efeitos', icon: <IconSparkle size={18} />, color: 'var(--orange)', media: true },
  { id: 'text', label: 'Texto', icon: <IconText size={18} />, color: 'var(--green)', text: true },
  { id: 'object', label: 'Objeto', icon: <IconBox size={18} />, color: 'var(--purple)' },
]

export function BottomScreen() {
  const list = useSelection()
  const tab = useStore((s) => s.tab)
  const items = useStore((s) => s.items)
  const st = useStore.getState()
  const hasMedia = list.some(isMedia)
  const hasText = list.some((i) => i.kind === 'text')
  const tabs = TABS.filter((t) => (t.media ? hasMedia : t.text ? hasText : true))
  const current = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id
  const kinds = { image: 0, video: 0, gif: 0, text: 0 }
  list.forEach((i) => kinds[i.kind]++)

  return (
    <section className="screen bottom-screen">
      <header className="tabbar">
        <button className={'tab home-tab' + (list.length === 0 ? ' on' : '')} onClick={() => { blip('back'); st.select([]) }} title="Início (Esc)">
          <IconHome size={18} />
        </button>
        {list.length > 0 && tabs.map((t) => (
          <button key={t.id} className={'tab' + (current === t.id ? ' on' : '')} style={{ '--c': t.color } as React.CSSProperties}
            onClick={() => { blip('tap'); st.setTab(t.id) }}>
            <span className="tab-icon">{t.icon}</span>{t.label}
          </button>
        ))}
        {list.length === 0 && <span className="tab-title">Início</span>}
        <span className="sel-chip">
          {list.length === 0 ? `${items.length} no canvas` : (
            <>
              {kinds.image > 0 && <span><IconImage size={13} />{kinds.image}</span>}
              {kinds.video > 0 && <span><IconVideo size={13} />{kinds.video}</span>}
              {kinds.gif > 0 && <span>GIF {kinds.gif}</span>}
              {kinds.text > 0 && <span><IconText size={13} />{kinds.text}</span>}
            </>
          )}
        </span>
      </header>
      <div className="panel-wrap" key={list.length === 0 ? 'home' : current}>
        {list.length === 0 && <Home />}
        {list.length > 0 && current === 'dither' && <DitherTab list={list} />}
        {list.length > 0 && current === 'color' && <ColorTab list={list} />}
        {list.length > 0 && current === 'adjust' && <AdjustTab list={list} />}
        {list.length > 0 && current === 'fx' && <FxTab list={list} />}
        {list.length > 0 && current === 'text' && <TextTab list={list} />}
        {list.length > 0 && current === 'object' && <ObjectTab list={list} />}
      </div>
      <footer className="footbar">
        <Pill badge="B" onClick={() => st.select([])} disabled={!list.length}>Desmarcar</Pill>
        <span className="foot-hint">
          {list.length > 1 ? 'Editando vários: cada controle só muda o próprio campo' : list.length === 1 ? 'Shift+clique para selecionar mais' : 'Arraste no canvas para selecionar vários'}
        </span>
        <Pill tone="blue" badge="A" onClick={() => exportItems(list.some(isMedia) ? list.map((i) => i.id) : undefined)}>
          <IconExport size={15} /> {list.filter(isMedia).length ? `Exportar ${list.filter(isMedia).length}` : 'Exportar tudo'}
        </Pill>
      </footer>
    </section>
  )
}
