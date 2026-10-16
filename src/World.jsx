import Portal from './Portal.jsx'
import { EVANS, GUIDE, H, PORTAL, ROOM } from './layout.js'
import Zaman from './guide/Zaman.jsx'

// Everything you can see. Replace the room with your own: more meshes, a loaded model
// (useLoader + GLTFLoader from three/examples), textures, more lights.
const W = ROOM.xMax - ROOM.xMin
const D = ROOM.zMax - ROOM.zMin
const CX = (ROOM.xMin + ROOM.xMax) / 2
const CZ = (ROOM.zMin + ROOM.zMax) / 2

// one wall: a thin box. [x, z] is its center, len its length, alongX whether it runs east-west
function Wall({ x, z, len, alongX, color = '#e9e4da' }) {
  return (
    <mesh position={[x, H / 2, z]}>
      <boxGeometry args={alongX ? [len, H, 0.1] : [0.1, H, len]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export default function World({ talking = false, onTalk }) {
  return (
    <>
      <color attach="background" args={['#101014']} />
      {/* lights: a soft fill everywhere, plus one lamp near the ceiling */}
      <ambientLight intensity={0.5} />
      <pointLight position={[CX, H - 0.3, CZ]} intensity={25} distance={14} />

      {/* floor and ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0, CZ]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#8a6b4a" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[CX, H, CZ]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f4f1ea" />
      </mesh>

      {/* four walls; the north one is a different color so you can tell where you are */}
      <Wall x={CX} z={ROOM.zMin} len={W} alongX color="#cfd8e6" />
      <Wall x={CX} z={ROOM.zMax} len={W} alongX />
      <Wall x={ROOM.xMin} z={CZ} len={D} />
      <Wall x={ROOM.xMax} z={CZ} len={D} />

      {/* something to look at: replace with your own things */}
      <mesh position={[3.5, 0.5, 3.5]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ff4fa3" />
      </mesh>

      {/* Tauhid, your guide: aim at him and click (or press E) to talk */}
      <Zaman position={[GUIDE.x, 0, GUIDE.z]} rotation={GUIDE.rot} talking={talking} onTalk={onTalk} />

      {/* portals (rot 0 = facing south, into the room). Add one <Portal> per link. */}
      <Portal x={PORTAL.x} z={PORTAL.z} href={PORTAL.href} spawn={PORTAL.spawn} back={PORTAL.back} label={PORTAL.label} />
      <Portal x={EVANS.x} z={EVANS.z} href={EVANS.href} spawn={EVANS.spawn} back={EVANS.back} label={EVANS.label} sub={EVANS.sub} color="#ffd166" />
    </>
  )
}
