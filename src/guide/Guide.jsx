import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { useTalker } from './avatar.js'
import W from '../wonder.js'
import { floorAt } from '../layout.js'

// Amanat, the guide: a Labubu in Mughal court dress (the same kind of guide as the Seven Wonders
// worlds), named after Amanat Khan, who designed the Taj's calligraphy. A long white jama robe, a
// gold patka sash, a turban with a jewelled sarpech and plume, and a reed pen (qalam) in hand.
// Accessories are in Labubu units (head centre y ≈ 0.7, face front z ≈ 0.25, hands x ≈ ±0.17, y ≈ 0.29).

const SPH = new THREE.SphereGeometry(1, 24, 16)
const CAP = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const TOR = new THREE.TorusGeometry(1, 0.18, 10, 32)
const ROBE = new THREE.CylinderGeometry(0.19, 0.33, 1, 32, 1, true)
const CONE = new THREE.ConeGeometry(1, 1, 16)

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide, ...o }))
  return mats.get(k)
}
const GOLD = { metalness: 0.85, roughness: 0.3 }
const Mesh = ({ g = SPH, c, o, p, s, r = [0, 0, 0] }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

export default function Guide({ talking = false, onTalk }) {
  const { x, z, rot } = W.guide
  const y = floorAt(x, z)
  const o = W.outfit
  const H = 1.5
  const { root, head, clickProps } = useTalker('guide', { position: [x, y, z], rotation: rot, talking, headY: 1.1 * H })
  return (
    <group ref={root} position={[x, y, z]} rotation={[0, rot, 0]} {...clickProps(onTalk)}>
      <group ref={head} />
      <group scale={H}>
        <Labubu fur={o.fur} expression={o.expression} shirt={o.robe} anim={talking ? 'wave' : 'idle'} height={1} />
        {/* jama: a long white robe flaring to the ankles, and the gold patka sash at the waist */}
        <mesh geometry={ROBE} material={m(o.robe)} position={[0, 0.24, 0]} scale={[1, 0.48, 0.92]} />
        <Mesh g={TOR} c={o.sash} o={GOLD} p={[0, 0.4, 0]} r={[Math.PI / 2, 0, 0]} s={[0.2, 0.19, 0.2]} />
        <Mesh g={CYL} c={o.sash} o={GOLD} p={[0.04, 0.3, 0.17]} r={[0.1, 0, 0]} s={[0.05, 0.2, 0.012]} />
        {/* turban, its jewelled sarpech and a plume */}
        <Mesh g={CAP} c={o.turban} p={[0, 0.8, -0.01]} s={[0.29, 0.21, 0.28]} />
        <Mesh g={TOR} c={o.turban} p={[0, 0.81, -0.01]} r={[Math.PI / 2, 0, 0]} s={[0.26, 0.25, 0.22]} />
        <Mesh g={SPH} c={o.jewel} o={{ metalness: 0.3, roughness: 0.2 }} p={[0, 0.86, 0.26]} s={[0.035, 0.035, 0.02]} />
        <Mesh g={CONE} c="#f6f2ea" p={[0.03, 0.97, 0.22]} r={[0.25, 0, -0.25]} s={[0.02, 0.16, 0.02]} />
        {/* the qalam (reed pen) in one hand, a rolled page in the other */}
        <group position={[-0.22, 0.3, 0.1]} rotation={[0, 0, 0.5]}>
          <Mesh g={CYL} c="#b8925a" s={[0.008, 0.16, 0.008]} />
          <Mesh g={CONE} c="#2a1d12" p={[0, -0.09, 0]} r={[Math.PI, 0, 0]} s={[0.008, 0.03, 0.008]} />
        </group>
        <group position={[0.23, 0.28, 0.1]} rotation={[0, 0, Math.PI / 2]}>
          <Mesh g={CYL} c="#efe3bd" s={[0.03, 0.2, 0.03]} />
        </group>
      </group>
    </group>
  )
}
