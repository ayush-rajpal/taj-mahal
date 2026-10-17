import { useEffect, useRef } from 'react'
import SITE from './site.json'
import COL from './colliders.json'
import W from './wonder.js'
import { EXITS } from './layout.js'

// A map of the whole complex in the corner, in the same style as the one in Evans Hall
// (zlisto/evans-hall-3d): the plan is drawn once, then each frame adds you (white dot, pink view cone)
// and Amanat (lavender dot). Every portal out is marked EXIT; they all lead to Metaverse Square.

const S = 0.6 // px per metre
const R = 2 // drawn at twice the size for sharp text
const ZOOM = 1.6 // on-screen size relative to the plan scale
const X0 = -158
const X1 = 158
const Z0 = -78
const Z1 = SITE.site.forecourt_s + 8
const LEGEND = 58 // px under the plan for the key
const Wpx = Math.round((X1 - X0) * S)
const Hpx = Math.round((Z1 - Z0) * S) + LEGEND
const px = (x, z) => [(x - X0) * S * R, (z - Z0) * S * R]
const len = (m) => m * S * R

const PINK = '#ff4fa3'
const LABEL = '#ffd6ea'
const RED = '#5a2a26'
const WATER = '#2d5f9e'

// the portals, grouped where several stand together (the forecourt has three side by side)
const GROUPS = []
for (const e of EXITS) {
  const g = GROUPS.find((g) => Math.hypot(g.x - e.x, g.z - e.z) < 15)
  if (g) g.exits.push(e)
  else GROUPS.push({ x: e.x, z: e.z, exits: [e] })
}

function drawStatic(g) {
  const S_ = SITE.site
  const T = SITE.tomb
  const rect = (x0, z0, x1, z1, fill, stroke) => {
    const [a, b] = px(x0, z0)
    g.fillStyle = fill
    g.fillRect(a, b, len(x1 - x0), len(z1 - z0))
    if (stroke) {
      g.strokeStyle = stroke
      g.lineWidth = 2
      g.strokeRect(a, b, len(x1 - x0), len(z1 - z0))
    }
  }
  const poly = (pts, fill, stroke) => {
    g.beginPath()
    pts.forEach(([x, z], i) => (i ? g.lineTo(...px(x, z)) : g.moveTo(...px(x, z))))
    g.closePath()
    g.fillStyle = fill
    g.fill()
    if (stroke) {
      g.strokeStyle = stroke
      g.lineWidth = 2
      g.stroke()
    }
  }
  const circle = (x, z, r, fill) => {
    g.beginPath()
    g.arc(...px(x, z), len(r), 0, Math.PI * 2)
    g.fillStyle = fill
    g.fill()
  }
  const text = (t, x, z, size = 9, color = LABEL, align = 'center') => {
    g.fillStyle = color
    g.font = `${size * R}px system-ui, sans-serif`
    g.textAlign = align
    g.fillText(t, ...px(x, z))
  }

  g.fillStyle = '#0b0b0d'
  g.fillRect(0, 0, Wpx * R, Hpx * R)
  // the Yamuna along the north
  rect(X0, Z0, X1, S_.terrace_n, '#13233d')
  text('YAMUNA', 0, S_.terrace_n - 12, 9, '#8fb3e8')
  // riverfront terrace, garden, forecourt
  rect(-S_.half_width, S_.terrace_n, S_.half_width, S_.terrace_s, '#2a2622')
  rect(-S_.half_width, S_.terrace_s, S_.half_width, S_.garden_s, '#18321a')
  rect(-S_.forecourt_half, S_.garden_s, S_.forecourt_half, S_.forecourt_s, '#2a2622')
  // walkways and channels
  const gd = SITE.garden
  for (const x of [-gd.walk_half, 74, -82]) rect(x, S_.terrace_s, x + (x === -gd.walk_half ? 2 * gd.walk_half : 8), S_.garden_s, '#2c2c33')
  for (const z of [S_.pool_z - gd.walk_half, 125, 267]) rect(-S_.half_width, z, S_.half_width, z + (z === S_.pool_z - gd.walk_half ? 2 * gd.walk_half : 8), '#2c2c33')
  rect(-S_.half_width, S_.garden_s - 22, S_.half_width, S_.garden_s, '#2c2c33')
  for (const w of COL.water) rect(w.x0, w.z0, w.x1, w.z1, WATER)
  rect(-gd.pool_half, S_.pool_z - gd.pool_half, gd.pool_half, S_.pool_z + gd.pool_half, '#d8d2c6')
  rect(-gd.pool_inner, S_.pool_z - gd.pool_inner, gd.pool_inner, S_.pool_z + gd.pool_inner, WATER)
  // the plinth, the tomb, its dome and minarets
  const P = SITE.plinth.half
  rect(-P, -P, P, P, '#3a3a44', PINK)
  const H = T.half
  const C = T.chamfer
  poly([[H - C, -H], [H, -H + C], [H, H - C], [H - C, H], [-H + C, H], [-H, H - C], [-H, -H + C], [-H + C, -H]], '#efe9df')
  circle(0, 0, T.drum.r, '#cfc8ba')
  const m = SITE.minaret.at
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) circle(sx * m, sz * m, 4.5, '#efe9df')
  text('TOMB', 0, 4, 10, '#0b0b0d')
  // mosque and jawab, the gate, the walls
  const M = SITE.mosque
  for (const sx of [-1, 1]) rect(sx * M.x - M.half_x, -M.half_z, sx * M.x + M.half_x, M.half_z, RED, PINK)
  text('MOSQUE', -M.x, 3, 8)
  text('JAWAB', M.x, 3, 8)
  const G = SITE.gate
  rect(-G.half_x, G.z - G.half_z, G.half_x, G.z + G.half_z, RED, PINK)
  text('GATE', 0, G.z + 3, 8)
  g.strokeStyle = PINK
  g.lineWidth = 2
  g.beginPath()
  ;[[-S_.half_width, S_.terrace_n], [-S_.half_width, S_.garden_s], [-S_.forecourt_half, S_.garden_s], [-S_.forecourt_half, S_.forecourt_s],
    [S_.forecourt_half, S_.forecourt_s], [S_.forecourt_half, S_.garden_s], [S_.half_width, S_.garden_s], [S_.half_width, S_.terrace_n]].forEach(([x, z], i) =>
    i ? g.lineTo(...px(x, z)) : g.moveTo(...px(x, z)),
  )
  g.stroke()
  text('LOTUS POOL', 0, S_.pool_z + gd.pool_half + 12, 8)
  text('GARDEN', 110, 160, 8, '#8fc79a')
  text('FORECOURT', 0, S_.forecourt_s - 40, 8)
  text('N ↑', X1 - 14, Z0 + 14, 9, LABEL)
  // the portals out: one marker per place (every portal here goes to Metaverse Square)
  // a pink dot at each portal, its label beside it (away from the middle, so it hides nothing)
  for (const grp of GROUPS) {
    const [cx, cy] = px(grp.x, grp.z)
    const label = grp.exits.length > 1 ? `EXIT → SQUARE ×${grp.exits.length}` : 'EXIT → SQUARE'
    g.font = `bold ${7 * R}px system-ui, sans-serif`
    const w = g.measureText(label).width + 12 * R
    const fitsLeft = cx - 7 * R - w > 4 * R
    if (Math.abs(grp.x) < 5) pill(g, cx, cy - 15 * R, label)
    else if (grp.x < 0 && fitsLeft) pill(g, cx - 7 * R, cy, label, 'right')
    else pill(g, cx + 7 * R, cy, label, 'left')
    g.beginPath()
    g.arc(cx, cy, 4 * R, 0, Math.PI * 2)
    g.fillStyle = PINK
    g.fill()
    g.strokeStyle = '#ffffff'
    g.lineWidth = 1.2 * R
    g.stroke()
  }
  // the key
  const top = (Z1 - Z0) * S * R
  g.fillStyle = '#141418'
  g.fillRect(0, top, Wpx * R, LEGEND * R)
  g.fillStyle = PINK
  g.fillRect(0, top, Wpx * R, 1.5 * R)
  g.font = `${8.5 * R}px system-ui, sans-serif`
  g.textAlign = 'left'
  const w = pill(g, 8 * R, top + 14 * R, 'EXIT', 'left')
  g.fillStyle = LABEL
  g.fillText('portal to Metaverse Square', 8 * R + w + 6 * R, top + 17 * R)
  ;[['#b48cff', `${W.guideName}, your guide`], ['#ffffff', 'You']].forEach(([color, label], i) => {
    const x = (8 + i * (Wpx / 2)) * R
    const y = top + 42 * R
    g.beginPath()
    g.arc(x + 3 * R, y - 3 * R, 3.2 * R, 0, Math.PI * 2)
    g.fillStyle = color
    g.fill()
    g.fillStyle = LABEL
    g.fillText(label, x + 10 * R, y)
  })
}

// a dark pill with a pink edge and white text; returns its width
function pill(g, x, cy, label, align = 'center') {
  g.font = `bold ${7 * R}px system-ui, sans-serif`
  const w = g.measureText(label).width + 12 * R
  const want = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  const x0 = Math.max(4 * R, Math.min(Wpx * R - w - 4 * R, want)) // never off the edge of the map
  g.fillStyle = 'rgba(11,11,13,0.92)'
  g.strokeStyle = PINK
  g.lineWidth = 1.5 * R
  g.beginPath()
  g.roundRect(x0, cy - 7 * R, w, 14 * R, 7 * R)
  g.fill()
  g.stroke()
  g.fillStyle = '#ffffff'
  g.textAlign = 'left'
  g.fillText(label, x0 + 6 * R, cy + 2.5 * R)
  return w
}

export default function Minimap({ drawRef }) {
  const ref = useRef()
  useEffect(() => {
    const bg = document.createElement('canvas')
    bg.width = Wpx * R
    bg.height = Hpx * R
    drawStatic(bg.getContext('2d'))
    const g = ref.current.getContext('2d')
    const [gx, gy] = px(W.guide.x, W.guide.z)
    drawRef.current = (x, z, fx, fz) => {
      g.drawImage(bg, 0, 0)
      g.fillStyle = '#b48cff' // Amanat
      g.strokeStyle = '#0b0b0d'
      g.lineWidth = 1.5 * R
      g.beginPath()
      g.arc(gx, gy, 3.5 * R, 0, Math.PI * 2)
      g.fill()
      g.stroke()
      const [cx, cy] = px(x, z)
      const a = Math.atan2(fz, fx)
      g.fillStyle = 'rgba(255,79,163,0.35)'
      g.beginPath()
      g.moveTo(cx, cy)
      g.arc(cx, cy, 22 * R, a - 0.5, a + 0.5)
      g.closePath()
      g.fill()
      g.fillStyle = '#ffffff'
      g.strokeStyle = '#0b0b0d'
      g.beginPath()
      g.arc(cx, cy, 4 * R, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }
    drawRef.current(W.spawn.x, W.spawn.z, 0, -1)
  }, [drawRef])
  // shown at 1.6x its plan size (still sharp: it's drawn at 2x), shrinking to fit short screens
  // (phones size it in styles.css, using --map-aspect to keep it on screen)
  const aspect = (Wpx / Hpx).toFixed(4)
  const width = `min(${Math.round(Wpx * ZOOM)}px, calc((100vh - 150px) * ${aspect}))`
  return <canvas ref={ref} className="minimap" width={Wpx * R} height={Hpx * R} style={{ width, '--map-aspect': aspect }} />
}
