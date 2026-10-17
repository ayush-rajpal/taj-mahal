import { pickSpawn } from './mvw.js'
import W from './wonder.js'
import SITE from './site.json'
import COL from './colliders.json'

// The walkable shape of this world. Units are meters; +x = east, -z = north (the Yamuna), y = up.
// The Blender build (blender/build_taj.py) writes colliders.json: floors (platforms and ramps), solid
// boxes, round posts (minarets, towers, trees) and water. The tomb's own outline, with its great arch,
// corridor and chamber, is worked out here from site.json.

export const EYE = 1.65
export const R_PLAYER = 0.35
export const MAX_STEP = 0.7 // you can step up this much at once; taller edges work like walls
export const SPEED = W.speed

// ---- arrival points (mvw/0.1): ?spawn=<id> picks one ------------------------------------------------
export const EXITS = W.exits
const ahead = (p, d) => ({ x: p.x + Math.sin(p.rot) * d, z: p.z + Math.cos(p.rot) * d })
export const SPAWNS = { default: W.spawn, ...W.landmarks }
// one spawn in front of every portal, facing away from it (from_square is the forecourt's pink portal)
for (const e of EXITS) SPAWNS[e.back] = { ...ahead(e, 2.4), yaw: e.rot + Math.PI }
SPAWNS.hub_portal = SPAWNS.from_square // the World Starter's name for the spot by the portal to the square
export const SPAWN = pickSpawn(SPAWNS)
export const GUIDE = W.guide

// ---- floors ----------------------------------------------------------------------------------------
// flat platforms { x0, x1, z0, z1, h } and ramps { ..., h0, h1 } rising from h0 at the south end (z1)
// to h1 at the north end (z0). The highest one under you is the floor.
export function floorAt(x, z) {
  let y = 0
  for (const p of COL.platforms) {
    if (!(x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1)) continue
    const h = p.h ?? p.h0 + ((p.z1 - z) / (p.z1 - p.z0)) * (p.h1 - p.h0)
    if (h > y) y = h
  }
  return y
}

// ---- walls -----------------------------------------------------------------------------------------
const T = SITE.tomb
const TAN8 = Math.tan(Math.PI / 8)
const inOct = (ax, az, h, c) => ax < h && az < h && ax + az < 2 * h - c
const PLINTH_TOP = SITE.levels.plinth

// The tomb: an octagon with a pishtaq on each side. You can walk into each great arch, down the
// corridor and into the chamber, but not through the marble screen round the cenotaphs.
function inTomb(x, z, r) {
  const ax = Math.abs(x)
  const az = Math.abs(z)
  const big = Math.max(ax, az) // fold the four sides onto one
  const small = Math.min(ax, az)
  const p = T.pishtaq
  const solid = inOct(ax, az, T.half + r, T.chamfer) || (small < p.half + r && big < T.half + p.proj + r)
  if (!solid) return false
  const core = T.half - T.depth
  if (small < p.arch.w / 2 - r && big > core - 0.05) return false // inside the great arch
  const c = T.chamber
  if (small < c.corridor_half - r && big > c.ri - 1) return false // the corridor to the chamber
  const ri = c.ri - r
  if (inOct(ax, az, ri, ri * (1 - TAN8))) {
    const rj = c.jali_ri + r
    return inOct(ax, az, rj, rj * (1 - TAN8)) // the screen round the cenotaphs
  }
  return true
}

const CIRCLES = [...COL.circles, { x: GUIDE.x, z: GUIDE.z, r: 0.45 }]

export function blocked(x, z, footY) {
  const r = R_PLAYER
  if (footY > PLINTH_TOP - 1 && inTomb(x, z, r)) return true
  for (const b of COL.boxes) {
    if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true
  }
  for (const w of COL.water) {
    if (footY < 0.3 && x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return true
  }
  for (const c of CIRCLES) {
    const rr = c.r + r
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < rr * rr) return true
  }
  // the walls already close the garden; this keeps you inside the complex and forecourt
  const S = SITE.site
  if (z > S.garden_s + 0.8) return Math.abs(x) > S.forecourt_half - 1 || z > S.forecourt_s - 1
  return Math.abs(x) > S.half_width - 1.2 || z < S.terrace_n + 1
}

// Try to move from (x, z) by (dx, dz): whole step, else slide along one axis. Returns the new spot.
export function move(x, z, dx, dz, footY) {
  const stuck = blocked(x, z, footY) // arrived inside something (a spawn or teleport): let them walk out
  const ok = (nx, nz) => floorAt(nx, nz) - footY <= MAX_STEP && (stuck || !blocked(nx, nz, Math.max(footY, floorAt(nx, nz))))
  if (ok(x + dx, z + dz)) return [x + dx, z + dz]
  if (dx && ok(x + dx, z)) return [x + dx, z]
  if (dz && ok(x, z + dz)) return [x, z + dz]
  return [x, z]
}

// ---- where you are, in plain words (sent to the Metaverse Browser with presence()) -----------------
export function locate(x, z) {
  if (Math.hypot(x - GUIDE.x, z - GUIDE.z) < 2.6) return `${W.name} · with ${W.guideName}, your guide`
  for (const e of EXITS) if (Math.hypot(x - e.x, z - e.z) < 3) return `${W.name} · by the portal to ${e.label}`
  for (const a of W.areas) if (a.test(x, z)) return `${W.name} · ${a.label}`
  return `${W.name} · ${W.elsewhere}`
}
