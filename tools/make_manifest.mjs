// Write public/.well-known/metaverse.json (the mvw/0.1 manifest) from src/wonder.js, so the spawns
// and portals other worlds see always match the ones in the world.
//   node tools/make_manifest.mjs
import { writeFileSync } from 'node:fs'
import W from '../src/wonder.js'

const exitSpawn = {
  from_square: 'In the forecourt in front of the middle portal back to Metaverse Square, facing the Great Gate',
  forecourt_west: 'In the forecourt in front of the left portal to Metaverse Square',
  forecourt_east: 'In the forecourt in front of the right portal to Metaverse Square',
  gate_exit: 'Just inside the Great Gate, in front of the portal to Metaverse Square',
  north_exit: 'At the north end of the garden, in front of the portal to Metaverse Square',
  north_exit_west: 'At the north end of the garden, in front of the second portal to Metaverse Square',
}
const spawns = {
  default: 'On the plaza just inside the Great Gate, looking down the water channel to the tomb',
  ...Object.fromEntries(W.exits.map((e) => [e.back, exitSpawn[e.back] ?? `In front of the portal to ${e.label}`])),
  hub_portal: 'Same as from_square',
  ...Object.fromEntries(Object.entries(W.landmarks).map(([id, l]) => [id, l.about])),
}
const manifest = {
  protocol: 'mvw/0.1',
  name: W.name,
  description:
    `Shah Jahan's white marble tomb for Mumtaz Mahal in Agra, built in Blender from real photographs: the Great Gate, the charbagh garden and reflecting pools, the plinth and minarets, and the tomb chamber with its cenotaphs. Amanat the calligrapher, a Labubu guide, answers questions offline from a guidebook. Made by ${W.author}.`,
  spawns,
  portals: W.exits.map((e) => ({ id: e.id, label: e.label, href: e.href, spawn: e.spawn, where: e.where })),
}
writeFileSync(new URL('../public/.well-known/metaverse.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest: ${Object.keys(spawns).length} spawns, ${manifest.portals.length} portals`)
