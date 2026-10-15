// What Tauhid says. Fixed text, no AI: the greeting, then one answer per question button.
// Formatting: **bold**, `code`, lines starting with "- " become bullets, and https:// links are clickable.

export const GREETING = `Yo! I'm Tauhid Zaman, and this whole thing is my idea. Welcome to the **Metaverse Web**: the regular web, except every website is a 3D world you can walk around in, and the links between them are portals you walk through.

Pick a question below and I'll walk you through it.`

export const LESSONS = [
  {
    q: 'What is the Metaverse Web?',
    a: `Think of the web in 1991. Every page was its own site, anyone could make one, and links connected them without asking anyone's permission. Same idea here, with 3D worlds instead of pages:
- A **world** is a website you walk around in.
- A **portal** is a link you walk through.
- The **Metaverse Browser** carries your name and history from world to world.
No central server, no accounts, nobody in charge. You own your world.`,
  },
  {
    q: 'How do portals work?',
    a: `A portal is just three things:
- **where it goes:** another world's address
- **where you land there:** one of that world's spawn points
- **where Back returns you:** a spawn point here, right in front of the portal
Walk through and the world sends you to \`address?spawn=thatspot\`. The pink doorway behind me goes to Metaverse Square, the hub with a portal to every world.`,
  },
  {
    q: "What's a spawn point?",
    a: `A named spot where you appear, plus which way you're facing. The \`?spawn=\` at the end of an address picks one. For example \`https://zlisto.github.io/darul_kebab/?spawn=front_door\` puts you just inside Darul Kebab's door.

No \`?spawn=\` means you land at \`default\`. That's how a portal drops you at the right door instead of a random corner.`,
  },
  {
    q: "What's the manifest?",
    a: `Your world's business card: a small JSON file at \`.well-known/metaverse.json\` with its name, a one-line description, its spawn points and its portals.

The browser reads it to show your world's name, Metaverse Square reads it to label your portal, and search engines or AI agents can read it to know what's inside without walking around. Here's this room's: https://zlisto.github.io/world_starter/.well-known/metaverse.json`,
  },
  {
    q: 'How do I add my world?',
    a: `Five steps:
- **Spawn points:** read \`?spawn=\` when your page loads. Have \`default\`, and \`from_square\` in front of your portal back to the square.
- **mvw.js:** copy this one file into your project, unchanged.
- **A portal** back to Metaverse Square.
- **A manifest** at \`.well-known/metaverse.json\`.
- **Get listed:** add one entry to \`worlds.json\` in the registry by pull request. If your world is on your own GitHub Pages site, it merges automatically and your portal shows up in the square within minutes: https://github.com/zlisto/metaverse_registry`,
  },
  {
    q: "What's the easiest way to start?",
    a: `Click **Use this template** on https://github.com/zlisto/world_starter. That's this exact room, already wired up, me included. Build your stuff, publish it on GitHub Pages, and add it to the registry.

Already have a 3D site? Paste the prompt from https://github.com/zlisto/metaverse_web into your coding agent and it'll do the steps for you.`,
  },
  {
    q: 'Where can I go from here?',
    a: `Walk through the portal behind me to Metaverse Square. From there:
- **Yale SOM, Evans Hall:** AI avatars of real professors teaching. I'm in room 2200.
- **Darul Kebab:** a Cambridge restaurant. Say hi to Monir.
- every world anyone adds to the registry.
The full spec is here: https://github.com/zlisto/metaverse_web/blob/main/PROTOCOL.md`,
  },
]
