import { Suspense } from 'react'
import Portal from './Portal.jsx'
import Atmosphere from './Atmosphere.jsx'
import TajModel from './TajModel.jsx'
import Fountains from './Fountains.jsx'
import Boards from './Boards.jsx'
import Guide from './guide/Guide.jsx'
import { EXITS } from './layout.js'

// Everything you can see: the sky for the chosen time of day, the Blender model of the complex,
// fountains, photo boards, the guide, and the portals to other worlds.
export default function World({ time, talking = false, onTalk, onBoard }) {
  return (
    <>
      <Atmosphere time={time} />
      <Suspense fallback={null}>
        <TajModel />
      </Suspense>
      <Fountains time={time} />
      <Boards onNear={onBoard} />
      <Guide talking={talking} onTalk={onTalk} />

      {/* portals out (rot 0 = facing south): the forecourt, inside the Great Gate, and the north garden */}
      {EXITS.map((e) => (
        <Portal key={e.id} x={e.x} z={e.z} rot={e.rot} href={e.href} spawn={e.spawn} back={e.back} label={e.label} sub={e.sub} color={e.color} />
      ))}
    </>
  )
}
