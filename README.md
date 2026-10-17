# Taj Mahal · a world on the Metaverse Web

By **Ayush Rajpal** · made for MGT 409: AI Foundations for Managers (Yale SOM)

Walk through the Taj Mahal in your browser: in through the Great Gate, down the charbagh garden past the reflecting pool, up the plinth stairs, through the great arch and into the tomb chamber with the cenotaphs of Mumtaz Mahal and Shah Jahan. Change the time of day and watch the marble turn pink at sunrise, gold at sunset and blue by moonlight.

The whole complex was **built in Blender from code**, with dimensions taken from published figures, a public-domain site plan and measurements of a straight-on photo, and **textured with real images**: photo-scanned marble, sandstone and grass (CC0) and Wikimedia Commons photographs of the actual Taj, its calligraphy, inlay, jali screens and the Great Gate.

**Amanat**, a Labubu dressed as a Mughal calligrapher (named after Amanat Khan, who designed the Taj's inscriptions), answers your questions **offline**: from a guidebook of about 190 questions and answers written from Wikipedia and Wikivoyage, and, when the guidebook doesn't cover something, by quoting the most relevant lines from those saved articles. No AI, no server, no API key.

It's a world on the [Metaverse Web](https://github.com/zlisto/metaverse_web) (`mvw/0.1`): 3D worlds as websites, linked by portals you walk through. All six portals here lead to [Metaverse Square](https://zlisto.github.io/hub_world/), the plaza with a portal to every world.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5179/. That's all: everything, including the guide, runs in the browser.

`npm run build` makes a static site in `dist/` that you can host anywhere (GitHub Pages deploys it automatically with `.github/workflows/pages.yml`).

## Controls

| | |
| --- | --- |
| **W A S D** / arrows | walk (Shift runs) |
| **Mouse** | look (click to lock it) |
| **Space** | jump |
| **E** | talk to Amanat when you're looking at them |
| **G** | ask Amanat from anywhere |
| **T** | change the time of day (or use the buttons, top right) |
| **M** | show or hide the map (bottom right): you, Amanat, and the six exits (all to Metaverse Square) |
| **Esc** | pause |

On a phone: left thumb walks, right thumb drags to look. Amanat can also take you to the gate, the pool, the great arch, inside the tomb, the riverfront and the mosque.

## Arrival points and portals (mvw/0.1)

The manifest is at [`public/.well-known/metaverse.json`](public/.well-known/metaverse.json), generated from `src/wonder.js` by `node tools/make_manifest.mjs`.

| Spawn id | Where you arrive |
| --- | --- |
| `default` | On the plaza just inside the Great Gate, looking down the water channel to the tomb |
| `from_square` (also `hub_portal`) | In the forecourt in front of the pink portal back to Metaverse Square |
| `forecourt_west`, `forecourt_east` | In front of the other two forecourt portals |
| `gate_exit` | Just inside the Great Gate, in front of its portal |
| `north_exit`, `north_exit_west` | At the north end of the garden, in front of its two portals |
| `great_gate`, `lotus_pool`, `taj_terrace`, `inside_tomb`, `riverfront`, `mosque`, `jawab` | Landmarks |

There are six portals in three places, all to Metaverse Square and all marked EXIT on the map: the forecourt (three), just inside the Great Gate (one) and the north end of the garden (two). To link to this world from yours, use its address with `?spawn=default` or `?spawn=from_square`.

To list it in Metaverse Square, add this to `worlds.json` in [zlisto/metaverse_registry](https://github.com/zlisto/metaverse_registry) once the world is online:

```json
{ "id": "taj_mahal", "name": "Taj Mahal", "address": "https://<your-github-username>.github.io/<repo-name>/", "owner": "<your-github-username>" }
```

The square's portal then lands people at `from_square`, and its spawn in front of the portal here is `by_taj_mahal`.

## How it's built

```
tools/fetch_sources.py      downloads the real material: articles, CC0 textures, Commons photos (+ licences)
blender/make_textures.py    straightens photo crops and draws them into facade textures, in metres
blender/build_taj.py        builds the whole complex in Blender, exports public/models/taj_mahal.glb
src/site.json               every dimension, shared by the texture maker, the Blender build and the world
src/colliders.json          floors, ramps and walls, written by the Blender build
knowledge/faq.json          the guidebook (about 190 questions, each with several phrasings)
knowledge/lexicon.json      synonyms and ignored words for matching questions
public/guidebook/passages.json   the saved Wikipedia/Wikivoyage articles, cut into searchable passages
```

To rebuild the model after changing `src/site.json` or the build script (Blender 4.2+ and Python 3.11+ with Pillow and NumPy):

```bash
python tools/fetch_sources.py textures      # once: CC0 materials -> assets/textures/
python tools/fetch_sources.py photos        # once: Commons photos listed in assets/photos.json
python blender/make_textures.py             # photos + materials -> blender/textures/
blender -b --factory-startup -P blender/build_taj.py
```

The world is React + Vite + three.js (@react-three/fiber), following the [World Starter](https://github.com/zlisto/world_starter) template and the Seven Wonders worlds:

- `src/wonder.js`: the world's name, the guide's outfit and greeting, times of day, spawns, portals, photo boards
- `src/layout.js`: floors, walls (including the tomb's arches, corridor, chamber and screen), spawns, where you are
- `src/TajModel.jsx`: loads the Blender model; adds the mirror-like water in the long channel and the tomb's lamp
- `src/Atmosphere.jsx`: sky, sun, moon and stars; shadows fitted to the whole complex
- `src/Minimap.jsx`: the map in the corner, in the same style as Evans Hall's, with every exit marked
- `src/guide/`: Amanat (a Labubu, `Labubu.jsx` from evans-hall-3d), the chat, the guidebook matcher (`faq.js`) and the article search (`sources.js`)
- `src/mvw.js`, `src/Portal.jsx`: the Metaverse Web client and portal, unchanged from the template

Check the guide: `node tools/check_guidebook.mjs` asks it 90 questions offline and reports which answer each one gets.

Sizes follow the real ones closely; details (garden planting, inner rooms, the crypt, much of the carving) are simplified, and the surroundings beyond the walls are invented.

## Credits

Everything used is openly licensed; see [`assets/CREDITS.md`](assets/CREDITS.md) for each photograph (author and licence) and texture, and [`knowledge/sources.json`](knowledge/sources.json) for the articles. Photographs from Wikimedia Commons keep their own licences (mostly CC BY-SA and CC BY); the guide's text draws on Wikipedia and Wikivoyage (CC BY-SA 4.0). Textures from ambientCG are CC0. The portal, the protocol client and the Labubu come from [zlisto/world_starter](https://github.com/zlisto/world_starter).

Made by Ayush Rajpal for MGT 409: AI Foundations for Managers (Yale SOM).
