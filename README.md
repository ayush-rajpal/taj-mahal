# World Starter

**See it live:** https://zlisto.github.io/world_starter/ · Click **Use this template** on GitHub to start your own world.

A tiny 3D world that already speaks the Metaverse Web protocol (`mvw/0.1`, see [`https://github.com/zlisto/metaverse_web/blob/main/PROTOCOL.md`](https://github.com/zlisto/metaverse_web/blob/main/PROTOCOL.md)). Copy this folder, change the room, and link your world to everyone else's.

It has one room, first-person walking (keyboard + mouse, or an on-screen joystick on phones), two spawn points, and a portal to [Metaverse Square](https://zlisto.github.io/hub_world/), the plaza with a portal to every world in the registry.

```bash
npm install
npm run dev
```

Then open http://localhost:5176/. To see it inside the Metaverse Browser, start `https://github.com/zlisto/metaverse_browser` (`npm run dev`, port 5175) and type `localhost:5176` in its address bar.

## Meet your guide

Tauhid Zaman stands by the portal. Look at him and click (or press **E**; on a phone, tap **Talk to Tauhid**) and a chat opens where he explains the Metaverse Web: what it is, portals, spawn points, manifests, and how to add your own world. His lines are fixed text in `src/guide/lessons.js`, so there's no AI and no server.

His avatar comes from [evans-hall-3d](https://github.com/zlisto/evans-hall-3d), where he teaches in room 2200. Everything for him lives in `src/guide/`. To remove him from your copy, delete that folder, the `GUIDE` block in `src/layout.js`, the `<Zaman>` line in `src/World.jsx`, and the talk lines in `src/App.jsx`.

## What's where

| File | What it does | Change it? |
| --- | --- | --- |
| `src/layout.js` | Room size, spawn points, the portal's destination, walls, area names | **Yes**, start here |
| `src/World.jsx` | Everything you see: floor, walls, light, the portal | **Yes** |
| `src/App.jsx` | Your world's name and blurb, the start screen and greeting | Name and blurb |
| `public/.well-known/metaverse.json` | The manifest: name, description, spawns, portals | **Yes**, keep it in sync |
| `vite.config.js` | Dev server port (5176) | Pick a free port if you run several worlds |
| `src/Player.jsx`, `src/TouchControls.jsx` | Walking, looking, jumping | Optional |
| `src/mvw.js`, `src/Portal.jsx` | The protocol client and the portal | **No**, these are the same file in every world |
| `src/audio.js` | The portal whoosh | Optional |

## Make it your own

1. **Copy the folder** and rename it (e.g. `cp -r world_starter my_world`). Delete `node_modules` and `dist` from the copy if they came along.
2. **Name it.** Set `NAME` and `BLURB` in `src/App.jsx`, the `<title>` in `index.html`, and `name` and `description` in `public/.well-known/metaverse.json`.
3. **Build your room.** Change `ROOM` and `H` in `src/layout.js`, then add meshes, lights and models in `src/World.jsx`. If you add furniture you shouldn't walk through, push the player out of it in `collide()` (`https://github.com/zlisto/darul_kebab/blob/main/src/layout.js` has a box version).
4. **Name your areas.** `locate()` in `src/layout.js` turns your position into words like `"My World · by the fireplace"`. The world sends it to the browser with `presence()` whenever it changes.
5. **Spawn points.** Edit `SPAWNS` in `src/layout.js`. Keep `default`. Every id you add should also be listed under `spawns` in the manifest. Once someone links to a spawn id, don't rename it.

## Link both ways

**Your world → theirs.** In `src/layout.js`, `PORTAL` says where the portal goes:

```js
href: 'https://zlisto.github.io/hub_world/',  // their world's address
spawn: 'by_starter_world',                    // a spawn id from THEIR manifest
back: 'hub_portal',                           // a spawn id in YOUR world, right in front of this portal
```

To add more portals, add more `<Portal>` elements in `src/World.jsx` (each with its own `x`, `z`, `rot`, `href`, `spawn`, `back`, `label`), a matching spawn in front of each one, and a matching entry in the manifest's `portals` list. Read the other world's `.well-known/metaverse.json` to find its spawn ids.

**Their world → yours.** Send the other world's owner:

- your world's address (e.g. `http://localhost:5176/`, or your hosted URL), and
- the spawn id they should land at (here, `hub_portal` is the one in front of your portal to them).

They add a portal with `href` = your address and `spawn` = that id, plus a manifest entry. That's the whole handshake; no one has to approve anything.

**Get a portal in Metaverse Square.** Add your world to the [registry](https://github.com/zlisto/metaverse_registry#add-your-world) by pull request. The square rebuilds daily and puts a portal to every registered world in its ring. Its spawn in front of your portal is `by_<your id>`, so change `spawn: 'by_starter_world'` above to match your id.

The full checklist, including hosting on GitHub Pages (dot-folders like `.well-known` need a `.nojekyll` file or a GitHub Actions deploy), is in [`https://github.com/zlisto/metaverse_web/blob/main/PROTOCOL.md` section 7](https://github.com/zlisto/metaverse_web/blob/main/PROTOCOL.md#7-make-your-own-world-and-link-it-in).

## Check it works

- Open it on its own: walk into the portal and you land in Metaverse Square, in front of the portal back here.
- Open it in the Metaverse Browser: the world info panel shows its name, the status bar shows where you are as you walk, the greeting says your name, and the portal still takes you to Metaverse Square (and Back brings you to the spawn in front of the portal).
- `npm run build` makes a static site in `dist/` that you can host anywhere.
