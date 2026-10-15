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
  darul_kebab_portal: { x: 0, z: -3.3, yaw: Math.PI }, // just in front of the portal, facing into the room
}
export const SPAWN = pickSpawn(SPAWNS)

// The portal on the north wall. `spawn` is a spawn id in THEIR world (from their manifest);
// `back` is the spawn id in THIS world that puts you next to this portal when you press Back.
export const PORTAL = {
  x: 0,
  z: ROOM.zMin + 0.1,
  href: import.meta.env.DEV ? 'http://localhost:5174/' : 'https://zlisto.github.io/darul_kebab/', // local copy while developing
  spawn: 'front_door',
  back: 'darul_kebab_portal',
  label: 'Darul Kebab',
}

// Keep the player inside the room: clamp to the walls, minus the player's radius.
// For furniture, push the player out of boxes here too (see darul_kebab/src/layout.js).
export function collide(pos) {
  pos.x = Math.max(ROOM.xMin + R_PLAYER, Math.min(ROOM.xMax - R_PLAYER, pos.x))
  pos.z = Math.max(ROOM.zMin + R_PLAYER, Math.min(ROOM.zMax - R_PLAYER, pos.z))
  return pos
}

// Where you are, in plain words. Sent to the Metaverse Browser with presence() whenever it changes.
export function locate(x, z) {
  if (z < PORTAL.z + 2) return 'Starter World · by the portal to Darul Kebab'
  return 'Starter World · in the room'
}
