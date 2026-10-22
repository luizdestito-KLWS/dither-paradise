// Generates the app icon: a Bayer-dithered sphere wearing a halo, on a glossy console-style tile.
// Run: node scripts/make-icon.mjs
import { writeFileSync } from 'node:fs'

const N = 32
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
const SPHERE = ['#0b2a45', '#1b6fae', '#33bdee', '#a6e6fb', '#ffffff']
const grid = Array.from({ length: N }, () => new Array(N).fill(null))

const dither = (v, x, y, pal) => {
  const p = Math.min(pal.length - 1, Math.max(0, Math.floor(v * (pal.length - 1) + BAYER4[(y % 4) * 4 + (x % 4)])))
  return pal[p]
}

// Shadow under the sphere, 50% checkerboard.
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = (x + 0.5 - 16) / 9.5, dy = (y + 0.5 - 29.2) / 1.5
  if (dx * dx + dy * dy < 1 && (x + y) % 2 === 0) grid[y][x] = '#a9b8c6'
}

// Sphere, lit from the top-left.
const L = (() => { const v = [-0.55, -0.62, 0.56]; const m = Math.hypot(...v); return v.map((c) => c / m) })()
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const nx = (x + 0.5 - 16) / 10.5, ny = (y + 0.5 - 18) / 10.5
  const r2 = nx * nx + ny * ny
  if (r2 >= 1) continue
  const nz = Math.sqrt(1 - r2)
  const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
  const spec = Math.pow(diff, 22)
  const rim = Math.pow(1 - nz, 3) * 0.25
  const v = Math.min(1, 0.08 + 0.72 * diff + 0.55 * spec + rim)
  grid[y][x] = dither(v, x, y, SPHERE)
}

// Halo ring floating above.
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = (x + 0.5 - 16) / 8, dy = (y + 0.5 - 4.4) / 2.6
  const d = dx * dx + dy * dy
  if (d > 0.42 && d < 1.2) grid[y][x] = dy < 0 ? '#ffe27a' : '#ffb21e'
}

// Sparkles.
const star = (cx, cy, c, big) => {
  const pts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
  if (big) pts.push([2, 0], [-2, 0], [0, 2], [0, -2])
  for (const [dx, dy] of pts) grid[cy + dy][cx + dx] = c
}
star(4, 10, '#ff78b4', true)
star(28, 12, '#ffc93a', false)
star(26, 25, '#ff78b4', false)

// Merge each row into colour runs.
const CELL = 3, OFF = 16
let rects = ''
for (let y = 0; y < N; y++) {
  let x = 0
  while (x < N) {
    const c = grid[y][x]
    let e = x
    while (e + 1 < N && grid[y][e + 1] === c) e++
    if (c) rects += `<rect x="${OFF + x * CELL}" y="${OFF + y * CELL}" width="${(e - x + 1) * CELL}" height="${CELL}" fill="${c}"/>`
    x = e + 1
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6ec"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbfe"/><stop offset="1" stop-color="#d9f1fb"/></linearGradient>
<pattern id="paper" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.55" fill="#bfe3f2"/></pattern>
<clipPath id="clip"><rect x="11" y="11" width="106" height="106" rx="22"/></clipPath>
</defs>
<rect x="4" y="6" width="120" height="120" rx="30" fill="#b8c3cd"/>
<rect x="4" y="3" width="120" height="120" rx="30" fill="url(#tile)"/>
<rect x="5" y="4" width="118" height="118" rx="29" fill="none" stroke="#fff" stroke-width="2"/>
<rect x="11" y="11" width="106" height="106" rx="22" fill="url(#screen)"/>
<g clip-path="url(#clip)"><rect x="11" y="11" width="106" height="106" fill="url(#paper)"/>
<g shape-rendering="crispEdges">${rects}</g></g>
<rect x="11" y="11" width="106" height="106" rx="22" fill="none" stroke="#9fd8ee" stroke-width="2"/>
<path d="M22 14h84a17 17 0 0 1 9 3c-30-3-62-3-102 6a17 17 0 0 1 9-9z" fill="#fff" opacity="0.55"/>
</svg>
`
writeFileSync(new URL('../public/icon.svg', import.meta.url), svg)
// App-bundle variant: same art with the macOS icon-grid margin (tile ≈ 824 of 1024 px).
writeFileSync(new URL('../src-tauri/app-icon.svg', import.meta.url), svg.replace('viewBox="0 0 128 128"', 'viewBox="-10.5 -10 149 149" width="1024" height="1024"'))
console.log('icon.svg', svg.length, 'bytes')
