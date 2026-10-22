import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/m-plus-rounded-1c/500.css'
import '@fontsource/m-plus-rounded-1c/700.css'
import '@fontsource/m-plus-rounded-1c/800.css'
import '@fontsource/dotgothic16/400.css'
import './styles.css'
import { App } from './App'
import { applyTheme, useStore } from './store'

applyTheme(useStore.getState().theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The desktop webview's own menu (Reload, Inspect…) makes no sense in a packaged app.
if ('__TAURI_INTERNALS__' in window && !import.meta.env.DEV) {
  window.addEventListener('contextmenu', (e) => {
    const t = e.target as HTMLElement
    if (!t.closest('input, textarea, [contenteditable="true"]')) e.preventDefault()
  })
}

if (import.meta.env.DEV) {
  // Debug handle for poking at the app from the browser console during development.
  Promise.all([import('./store'), import('./dither/render'), import('./dither/types')]).then(([store, render, types]) => {
    ;(window as any).__dp = { ...store, ...render, ...types }
  })
}
