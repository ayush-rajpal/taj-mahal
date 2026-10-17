// The Taj Mahal: everything about this world in one place, in the same shape as the Seven Wonders
// worlds (zlisto/great-pyramid-of-giza). layout.js, World.jsx, the guide and the chat read from here;
// the monument itself is a Blender model (blender/build_taj.py -> public/models/taj_mahal.glb).
const HUB = 'https://zlisto.github.io/hub_world/'
const SQUARE = { label: 'Metaverse Square', sub: 'every world · portal', href: HUB, spawn: 'by_taj_mahal', color: '#ff4fa3' }

export default {
  id: 'taj_mahal',
  name: 'Taj Mahal',
  place: 'Agra, India · 1632–1653',
  author: 'Ayush Rajpal',
  blurb:
    "Walk Shah Jahan's white marble tomb for Mumtaz Mahal: through the Great Gate, down the paradise garden, up onto the plinth and inside to the cenotaphs. Built in Blender from real photographs. Amanat the calligrapher, your guide, answers your questions.",

  guideName: 'Amanat',
  guideRole: 'calligrapher of the Taj · your guide',
  guideIcon: '🖋️',
  greeting: (v) =>
    `Salaam${v ? `, ${v}` : ''}! I'm Amanat, named after Amanat Khan, the calligrapher who designed the Quranic inscriptions you see framing every arch here. Before you is the Taj Mahal, which Shah Jahan built for his wife Mumtaz Mahal.

Ask me anything about it: who built it and why, how it was made, the garden, the tomb inside, the legends, or visiting the real thing. My answers come from my guidebook and from Wikipedia's articles about the Taj.`,

  // the Labubu guide's Mughal court dress (see guide/Guide.jsx)
  outfit: { fur: '#7a5236', expression: 'happy', robe: '#f4efe4', sash: '#c9a13a', turban: '#e9dfc9', jewel: '#b8323c' },

  // sky, sun and light for each time of day (World.jsx). Elevation and azimuth in degrees, azimuth
  // clockwise from north. The marble really does change colour through the day.
  times: {
    sunrise: { label: 'Sunrise', el: 9, az: 118, turbidity: 8, rayleigh: 3, mie: 0.007, sun: '#ff9c78', sunI: 4.2, sky: '#f7c0ae', ground: '#7a5848', hemiI: 0.8, fog: '#efbfae', exposure: 0.6, envI: 0.35 },
    day: { label: 'Day', el: 52, az: 160, turbidity: 3.2, rayleigh: 1.0, mie: 0.004, sun: '#fff4e4', sunI: 3.6, sky: '#d4e4f7', ground: '#8a775c', hemiI: 1.0, fog: '#cad8e6', exposure: 0.5, envI: 0.75 },
    sunset: { label: 'Sunset', el: 7, az: 245, turbidity: 9, rayleigh: 3.2, mie: 0.009, sun: '#ffa04c', sunI: 4.4, sky: '#f3b88c', ground: '#5e4434', hemiI: 0.75, fog: '#e8ae88', exposure: 0.6, envI: 0.35 },
    night: { label: 'Moonlight', el: 40, az: 150, moon: true, sun: '#a9bfff', sunI: 0.9, sky: '#26365e', ground: '#0d0d16', hemiI: 0.6, fog: '#0f1832', exposure: 1.0, envI: 0.5 },
  },
  defaultTime: 'day',
  speed: { walk: 12, run: 20 },

  // where you arrive
  spawn: { x: 0, z: 331, yaw: 0 }, // on the plaza just inside the Great Gate, looking down the channel
  // portals out, in three places so you're never far from one; all six lead to Metaverse Square, the
  // plaza with a portal to every world. rot: the way a portal faces (0 = south). `back` is the spawn in
  // front of it, where the Metaverse Browser's Back button returns you; the square's own portal lands
  // you at from_square.
  exits: [
    { id: 'to_square', back: 'from_square', ...SQUARE, x: 0, z: 452, rot: Math.PI, where: 'In the forecourt, south of the Great Gate (the middle of three doorways)' },
    { id: 'to_square_forecourt_west', back: 'forecourt_west', ...SQUARE, x: -4.2, z: 452, rot: Math.PI, where: 'In the forecourt, the left of three doorways' },
    { id: 'to_square_forecourt_east', back: 'forecourt_east', ...SQUARE, x: 4.2, z: 452, rot: Math.PI, where: 'In the forecourt, the right of three doorways' },
    { id: 'to_square_gate', back: 'gate_exit', ...SQUARE, x: -14, z: 329, rot: Math.PI / 2, where: 'Just inside the Great Gate, on your left as you arrive' },
    { id: 'to_square_north', back: 'north_exit', ...SQUARE, x: -36, z: 56.5, rot: 0, where: 'At the north end of the garden, below the riverfront terrace' },
    { id: 'to_square_north_west', back: 'north_exit_west', ...SQUARE, x: -40.2, z: 56.5, rot: 0, where: 'Beside the north exit, at the north end of the garden' },
  ],
  // named arrival points other worlds can link to (?spawn=<id>). Never rename one once shared.
  landmarks: {
    great_gate: { x: 0, z: 405, yaw: 0, about: 'In the forecourt, facing the Great Gate' },
    lotus_pool: { x: 0, z: 213, yaw: 0, about: 'On the raised marble pool by its bench, facing the tomb' },
    taj_terrace: { x: 9, z: 41, yaw: 0, about: 'On the marble plinth in front of the great arch' },
    inside_tomb: { x: 0, z: 6.6, yaw: 0, about: 'Inside the tomb chamber, facing the cenotaphs' },
    riverfront: { x: 30, z: -50, yaw: 0, about: 'On the riverfront terrace, looking across the Yamuna to Mehtab Bagh' },
    mosque: { x: -68, z: 0, yaw: Math.PI / 2, about: 'On the terrace facing the mosque' },
    jawab: { x: 68, z: 0, yaw: -Math.PI / 2, about: 'On the terrace facing the jawab' },
  },
  guide: { x: 5.5, z: 324, rot: Math.atan2(-5.5, 7) },

  areas: [
    { test: (x, z) => Math.hypot(x, z) < 9, label: 'inside the tomb, by the cenotaphs' },
    { test: (x, z) => Math.abs(x) < 48 && Math.abs(z) < 48, label: 'on the marble plinth' },
    { test: (x, z) => x < -60 && Math.abs(z) < 52, label: 'by the mosque' },
    { test: (x, z) => x > 60 && Math.abs(z) < 52, label: 'by the jawab' },
    { test: (x, z) => Math.abs(z) < 52, label: 'on the riverfront terrace' },
    { test: (x, z) => Math.abs(x) < 16 && Math.abs(z - 200) < 16, label: 'at the lotus pool' },
    { test: (x, z) => z > 325 && z <= 333 && Math.abs(x) < 40, label: 'on the plaza inside the Great Gate' },
    { test: (x, z) => z > 333 && z < 366, label: 'in the Great Gate' },
    { test: (x, z) => z >= 366, label: 'in the forecourt' },
    { test: (x, z) => z > 52 && z < 348, label: 'in the charbagh garden' },
  ],
  elsewhere: 'in the gardens',

  // photo boards: real photographs of the Taj (Wikimedia Commons, credits on each board)
  boards: [
    { key: 'front_view', x: -8.2, z: 304, rot: Math.PI / 2, caption: 'The view you are standing in, photographed in 2013.' },
    { key: 'beato_1858', x: 8.2, z: 292, rot: -Math.PI / 2, caption: 'Felice Beato photographed the Taj in 1858, when the garden was still thickly planted.' },
    { key: 'sunrise', x: -8.2, z: 278, rot: Math.PI / 2, caption: 'At sunrise the marble turns pink; try the Sunrise button.' },
    { key: 'reflection', x: 8.2, z: 264, rot: -Math.PI / 2, caption: 'The long channel was designed to hold the reflection of the tomb.' },
    { key: 'aerial_wellcome', x: -8.2, z: 250, rot: Math.PI / 2, caption: 'An old aerial view: the four-part charbagh garden, the tomb at the river end.' },
    { key: 'side_view', x: 8.2, z: 236, rot: -Math.PI / 2, caption: 'From the west: the red sandstone mosque beside the white tomb.' },
    { key: 'great_gate', x: -12, z: 420, rot: Math.PI / 2, caption: 'The Great Gate (Darwaza-i-Rauza). Its photo is the texture on the gate in front of you.' },
    { key: 'inlay_panels', x: -15, z: 35.2, rot: 0, caption: 'Quranic calligraphy and pietra dura flowers on the great arch. These photos became the textures.' },
    { key: 'pietra_dura_1', x: -21, z: 35.2, rot: 0, caption: 'Pietra dura: jasper, jade, carnelian and other stones set into the marble.' },
    { key: 'relief_dado', x: 15, z: 35.2, rot: 0, caption: 'Flowers carved in relief on the lower walls, framed by inlay.' },
    { key: 'calligraphy_side', x: 21, z: 35.2, rot: 0, caption: 'The letters grow larger toward the top, so they read the same size from the ground.' },
    { key: 'jali_screen', x: -27, z: 35.2, rot: 0, caption: 'A jali: a marble screen pierced into a lattice, letting in light and air.' },
    { key: 'dome_finial', x: 27, z: 35.2, rot: 0, caption: 'The finial on the dome, topped by a crescent moon. It was gold until the 1800s.' },
    { key: 'screen_bourne', x: -6.4, z: 2.6, rot: Math.PI / 2 - 0.4, caption: 'Samuel Bourne, 1860s: the marble screen round the cenotaphs.' },
    { key: 'cenotaph_shah_jahan', x: 6.4, z: 2.6, rot: -Math.PI / 2 + 0.4, caption: "Shah Jahan's cenotaph, the one asymmetrical thing in the whole complex." },
    { key: 'mosque', x: -66, z: 14, rot: Math.PI / 2, caption: 'The mosque, still used for Friday prayers, which is why the Taj closes on Fridays.' },
    { key: 'mehtab_bagh', x: 18, z: -46, rot: 0, caption: 'The Taj from Mehtab Bagh, the Moonlight Garden across the river.' },
    { key: 'river_terrace', x: 42, z: -46, rot: 0, caption: 'The riverfront terrace seen from the Yamuna.' },
    { key: 'minaret', x: 36, z: 37, rot: 0, caption: 'One of the four minarets, each over 40 m tall.' },
  ],
}
