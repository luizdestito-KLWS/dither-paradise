import { exportItems, pickFiles } from '../actions'
import { useStore } from '../store'
import {
  IconCompare, IconCopy, IconCursor, IconEyedrop, IconExport, IconHand, IconPaste, IconPlus, IconRedo, IconText, IconUndo,
} from './Icons'
import { RoundBtn, Tile } from './ui'
import { blip } from '../sound'

function Logo() {
  return (
    <div className="logo" aria-label="Dither Paradise">
      <img className="logo-mark" src="/icon.svg" alt="" width={56} height={56} />
      <span className="logo-text">DITHER<br />PARADISE</span>
    </div>
  )
}

export function Sidebar() {
  const tool = useStore((s) => s.tool)
  const compare = useStore((s) => s.compare)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const count = useStore((s) => s.items.length)
  const st = useStore.getState()
  return (
    <aside className="sidebar">
      <Logo />
      <div className="tools">
        <Tile label="Selecionar" hint="V" color="var(--wii)" icon={<IconCursor />} active={tool === 'select'} onClick={() => st.setTool('select')} />
        <Tile label="Mover tela" hint="H" color="#5aa7ff" icon={<IconHand />} active={tool === 'hand'} onClick={() => st.setTool('hand')} />
        <Tile label="Texto" hint="T" color="var(--green)" icon={<IconText />} active={tool === 'text'} onClick={() => st.setTool('text')} />
        <Tile label="Conta-gotas" hint="I" color="var(--pink)" icon={<IconEyedrop />} active={tool === 'eyedrop'} onClick={() => st.setTool('eyedrop')} />
        <span className="tools-sep" />
        <Tile label="Importar" hint="O" color="var(--orange)" icon={<IconPlus />} onClick={pickFiles} />
        <Tile label="Comparar" hint="\" color="var(--purple)" icon={<IconCompare />} active={compare} onClick={() => st.setCompare(!compare)} />
        <Tile label="Copiar estilo" hint="⌥⌘C" color="var(--yellow)" icon={<IconCopy />} onClick={st.copyStyle} />
        <Tile label="Colar estilo" hint="⌥⌘V" color="var(--teal)" icon={<IconPaste />} onClick={st.pasteStyle} />
      </div>
      <div className="side-bottom">
        <div className="undo-row">
          <RoundBtn title="Desfazer (⌘Z)" disabled={!canUndo} onClick={st.undo}><IconUndo size={18} /></RoundBtn>
          <RoundBtn title="Refazer (⇧⌘Z)" disabled={!canRedo} onClick={st.redo}><IconRedo size={18} /></RoundBtn>
        </div>
        <button className="export-big" disabled={!count} onClick={() => { blip('select'); exportItems() }} title="Exportar tudo (⇧⌘E)">
          <IconExport size={22} />
          <span>Exportar<br />tudo</span>
        </button>
      </div>
    </aside>
  )
}
