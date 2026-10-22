import type { ReactNode } from 'react'

const I = ({ children, size = 24, fill = false }: { children: ReactNode; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
    strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

type P = { size?: number }

export const IconCursor = (p: P) => <I {...p}><path d="M5 3.5l13 7.2-5.6 1.6 3.4 6.2-2.6 1.4-3.4-6.2L5.5 18z" fill="currentColor" /></I>
export const IconHand = (p: P) => <I {...p}><path d="M8 12V6.5a1.5 1.5 0 013 0V11m0-5.5V4.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0v6.5m0-3a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.2a6 6 0 01-4.6-2.2L4.6 15a1.6 1.6 0 012.4-2.1L8 14" /></I>
export const IconText = (p: P) => <I {...p}><path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6" /></I>
export const IconEyedrop = (p: P) => <I {...p}><path d="M14.5 5.5l4 4M17 3.5a2.1 2.1 0 013 3l-2.5 2.5-3-3zM14.5 7l-9 9-1 4 4-1 9-9" /></I>
export const IconPlus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>
export const IconCompare = (p: P) => <I {...p}><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="M12 3v18" /><path d="M12 5h5.5A3 3 0 0120.5 8v8a3 3 0 01-3 3H12z" fill="currentColor" /></I>
export const IconCopy = (p: P) => <I {...p}><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></I>
export const IconPaste = (p: P) => <I {...p}><rect x="5" y="5" width="14" height="16" rx="3" /><path d="M9 5V3.5h6V5M9 12l2 2 4-4" /></I>
export const IconUndo = (p: P) => <I {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></I>
export const IconRedo = (p: P) => <I {...p}><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></I>
export const IconExport = (p: P) => <I {...p}><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8" /><path d="M5 13v4.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V13" /></I>
export const IconDither = (p: P) => (
  <I {...p}>
    {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 === 0 || r > 1) && (
      <rect key={`${r}${c}`} x={4 + c * 4.3} y={4 + r * 4.3} width="3" height="3" rx="0.6" fill="currentColor" stroke="none" opacity={r > 1 && (r + c) % 2 ? 1 : r > 1 ? 1 : 0.9} />
    )))}
  </I>
)
export const IconPalette = (p: P) => <I {...p}><path d="M12 3.5a8.5 8.5 0 100 17c1.4 0 2-1 1.5-2.2-.6-1.4.2-2.8 1.8-2.8H17a3.5 3.5 0 003.5-3.5c0-4.7-3.8-8.5-8.5-8.5z" /><circle cx="7.8" cy="11" r="1.2" fill="currentColor" /><circle cx="10.5" cy="7.3" r="1.2" fill="currentColor" /><circle cx="15" cy="7.8" r="1.2" fill="currentColor" /></I>
export const IconSliders = (p: P) => <I {...p}><path d="M5 7h8M17 7h2M5 17h2M11 17h8" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="17" r="2.2" /></I>
export const IconBox = (p: P) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M4 9h16M9 4v16" /></I>
export const IconTrash = (p: P) => <I {...p}><path d="M4.5 7h15M10 4h4M6.5 7l1 12a2 2 0 002 1.8h5a2 2 0 002-1.8l1-12" /></I>
export const IconDuplicate = (p: P) => <I {...p}><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M14 11v6M11 14h6M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></I>
export const IconFront = (p: P) => <I {...p}><rect x="9" y="9" width="11" height="11" rx="2.5" fill="currentColor" /><path d="M15 5.5V5a1 1 0 00-1-1H5a1 1 0 00-1 1v9a1 1 0 001 1h.5" /></I>
export const IconBack = (p: P) => <I {...p}><rect x="4" y="4" width="11" height="11" rx="2.5" fill="currentColor" /><path d="M18.5 9h.5a1 1 0 011 1v9a1 1 0 01-1 1h-9a1 1 0 01-1-1v-.5" /></I>
export const IconPlay = (p: P) => <I {...p}><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></I>
export const IconPause = (p: P) => <I {...p}><path d="M8 5v14M16 5v14" /></I>
export const IconSound = (p: P) => <I {...p}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" /><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /></I>
export const IconMute = (p: P) => <I {...p}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></I>
export const IconMinus = (p: P) => <I {...p}><path d="M5 12h14" /></I>
export const IconFit = (p: P) => <I {...p}><path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5a1.5 1.5 0 01-1.5 1.5H15M9 20H5.5A1.5 1.5 0 014 18.5V15" /></I>
export const IconStar = (p: P) => <I {...p}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" /></I>
export const IconClose = (p: P) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>
export const IconImage = (p: P) => <I {...p}><rect x="3.5" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" fill="currentColor" /><path d="M20.5 15.5l-4.5-4.5-8 8" /></I>
export const IconVideo = (p: P) => <I {...p}><rect x="3" y="6" width="13" height="12" rx="3" /><path d="M16 10.5l5-3v9l-5-3z" fill="currentColor" /></I>
export const IconHome = (p: P) => <I {...p}><path d="M4 11l8-7 8 7M6.5 9v10.5h11V9" /><path d="M10 19.5v-5h4v5" /></I>
export const IconCrop = (p: P) => <I {...p}><path d="M6.5 3v13.5H21M3 6.5h13.5V21" /></I>
export const IconSparkle = (p: P) => <I {...p}><path d="M12 3c.8 4.6 3.4 7.2 8 8-4.6.8-7.2 3.4-8 8-.8-4.6-3.4-7.2-8-8 4.6-.8 7.2-3.4 8-8z" fill="currentColor" /><path d="M19 3v3M17.5 4.5h3" /></I>
export const IconSun = (p: P) => <I {...p}><circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></I>
export const IconMoon = (p: P) => <I {...p}><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="currentColor" /></I>
export const IconAuto = (p: P) => <I {...p}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 010 16z" fill="currentColor" /></I>
export const IconSidebar = (p: P) => <I {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9 4.5v15" /><path d="M5.8 8.5h1M5.8 11h1M5.8 13.5h1" /></I>
