import { pickSpawn } from './mvw.js'

// The shape of your world, in one place. Units are meters.
// Axes: +x = east, -z = north, y = up. The camera looks toward -z when yaw = 0.
// Change the room here; World.jsx draws it and Player.jsx walks in it.

export const H = 3.2 // ceiling height
export const EYE = 1.65 // eye height when standing
export const R_PLAYER = 0.35 // how close you can get to a wall
export const ROOM = { xMin: -5, xMax: 5, zMin: -5, zMax: 5 }

// Arrival points (mvw/0.1, see ../PROTOCOL.md section 2). ?spawn=<id> picks one; unknown ids
// fall back to `default`. Other worlds link to these ids, so never rename one once it's shared.
// yaw: 0 faces north (-z), Math.PI faces south (+z).
export const SPAWNS = {
  default: { x: 0, z: 2, yaw: 0 }, // middle of the room, facing the portal
  hub_portal: { x: 0, z: -3.3, yaw: Math.PI }, // just in front of the portal, facing into the room
}
export const SPAWN = pickSpawn(SPAWNS)

// The portal on the north wall. `spawn` is a spawn id in THEIR world (from their manifest);
// `back` is the spawn id in THIS world that puts you next to this portal when you press Back.
export const PORTAL = {
  x: 0,
  z: ROOM.zMin + 0.1,
  href: import.meta.env.DEV ? 'http://localhost:5178/' : 'https://zlisto.github.io/hub_world/', // local copy while developing
  spawn: 'by_starter_world', // the square's spawn in front of ITS portal back to here
  back: 'hub_portal',
  label: 'Metaverse Square',
}

// Tauhid, your guide: standing near the portal, turned toward where you arrive. Talk to him to
// learn how the Metaverse Web works (src/guide/). Delete this and <Guide> in World.jsx to remove him.
export const GUIDE = { x: -1.7, z: -2.6, r: 0.45 }
GUIDE.rot = Math.atan2(SPAWNS.default.x - GUIDE.x, SPAWNS.default.z - GUIDE.z)

// Keep the player inside the room: clamp to the walls, minus the player's radius.
// For furniture, push the player out of boxes here too (see darul_kebab/src/layout.js).
export function collide(pos) {
  pos.x = Math.max(ROOM.xMin + R_PLAYER, Math.min(ROOM.xMax - R_PLAYER, pos.x))
  pos.z = Math.max(ROOM.zMin + R_PLAYER, Math.min(ROOM.zMax - R_PLAYER, pos.z))
  // and out of the guide
  const dx = pos.x - GUIDE.x
  const dz = pos.z - GUIDE.z
  const d = Math.hypot(dx, dz)
  const rr = R_PLAYER + GUIDE.r
  if (d < rr && d > 1e-6) {
    pos.x = GUIDE.x + (dx / d) * rr
    pos.z = GUIDE.z + (dz / d) * rr
  }
  return pos
}

// Where you are, in plain words. Sent to the Metaverse Browser with presence() whenever it changes.
export function locate(x, z) {
  if (Math.hypot(x - GUIDE.x, z - GUIDE.z) < 2.2) return 'Starter World · with Tauhid, your guide'
  if (z < PORTAL.z + 2) return 'Starter World · by the portal to Metaverse Square'
  return 'Starter World · in the room'
}
