// From zlisto/evans-hall-3d (src/Zaman.jsx), with a new face (shaved head, short beard, closed smile)
// and a more muscular build: thicker legs and arms.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { B, BOX, CAP, CYL, SPH, TORUS, m, useTalker } from './avatar.js'

// Prof. Tauhid Zaman: muscular build, shaved head, short dark beard and a warm closed-mouth smile,
// black-and-pink BLACKPINK hoodie, a pink Labubu clipped to his belt loop. While you chat he turns
// to face you and talks with his hands.

export const ZAMAN = { slug: 'tauhid-zaman', name: 'Tauhid Zaman' }

const SKIN = '#b07a56'
const SKIN_SHADE = '#a46f4e' // the shaved scalp, a touch darker than the face
const HAIR = '#15110f'
const HOODIE = '#121214'
const PINK = '#ff4fa3'
const JEANS = '#26324d'

const TORSO = new THREE.CylinderGeometry(0.25, 0.2, 0.62, 28) // broad chest and shoulders, narrower waist

function chestTex() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')
  g.fillStyle = HOODIE
  g.fillRect(0, 0, 512, 160)
  g.fillStyle = PINK
  g.font = '900 86px "Arial Black", Impact, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('BLACKPINK', 256, 84)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Zaman({ position = [0, 0, 0], rotation = 0, talking = false, onTalk }) {
  const { root, head, gesture, clickProps } = useTalker(ZAMAN.slug, { position, rotation, talking })
  const armR = useRef()
  const armL = useRef()
  const charm = useRef()
  const chest = useMemo(() => new THREE.MeshBasicMaterial({ map: chestTex() }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // talking with his hands vs. arms relaxed
    const g = gesture.current
    armR.current.rotation.x = -0.15 - g * (0.9 + Math.sin(t * 3.1) * 0.35)
    armR.current.rotation.z = -0.12 - g * 0.25
    armL.current.rotation.x = -0.25 - g * (0.5 + Math.sin(t * 2.3 + 1) * 0.3)
    armL.current.rotation.z = 0.12 + g * 0.2

    charm.current.rotation.z = Math.sin(t * 2.4) * 0.22 // the Labubu swings from his belt loop
    charm.current.rotation.x = Math.sin(t * 1.7) * 0.12
  })

  const hood = m(HOODIE)
  const skin = m(SKIN)
  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]} {...clickProps(onTalk)}>
      {/* sneakers: white with a pink stripe */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[0.11 * sx, 0, 0.03]}>
          <B g={BOX} c="#f4f4f6" p={[0, 0.045, 0]} s={[0.125, 0.09, 0.28]} />
          <B g={BOX} c={PINK} p={[0.064 * sx, 0.05, 0]} s={[0.004, 0.03, 0.17]} />
          <B g={BOX} c="#d9d9de" p={[0, 0.006, 0]} s={[0.13, 0.012, 0.29]} />
        </group>
      ))}
      {/* jeans */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={CAP} material={m(JEANS)} position={[0.11 * sx, 0.5, 0]} scale={[0.095, 0.33, 0.1]} />
      ))}
      <B g={BOX} c={JEANS} p={[0, 0.87, 0]} s={[0.39, 0.13, 0.22]} />
      <B g={BOX} c="#1a1a1a" p={[0, 0.915, 0]} s={[0.395, 0.03, 0.225]} />
      {/* belt loop + chain + Labubu charm on his right hip */}
      <group ref={charm} position={[-0.165, 0.9, 0.07]}>
        <B g={TORUS} c="#c9c9d1" o={{ metalness: 0.9, roughness: 0.25 }} p={[0, -0.02, 0]} r={[0, Math.PI / 2, 0]} s={[0.018, 0.018, 0.018]} />
        {[0, 1, 2].map((i) => (
          <B key={i} g={TORUS} c="#c9c9d1" o={{ metalness: 0.9, roughness: 0.25 }} p={[0, -0.05 - i * 0.028, 0]} r={[0, (i % 2) * (Math.PI / 2), 0]} s={[0.012, 0.016, 0.012]} />
        ))}
        <Labubu fur="#ff8fc7" expression="mischief" height={0.2} position={[0, -0.33, 0]} />
      </group>

      {/* hoodie body, pink hem and cuffs, kangaroo pocket, chest print */}
      <mesh geometry={TORSO} material={hood} position={[0, 1.18, 0]} />
      <B g={CYL} c={PINK} p={[0, 0.885, 0]} s={[0.203, 0.04, 0.203]} />
      <B g={BOX} c="#1c1c20" p={[0, 1.0, 0.205]} s={[0.24, 0.13, 0.03]} />
      <mesh material={chest} position={[0, 1.3, 0.238]}>
        <planeGeometry args={[0.27, 0.085]} />
      </mesh>
      <B c={HOODIE} p={[0, 1.47, 0]} s={[0.31, 0.1, 0.18]} />
      {/* hood resting behind the neck, pink lining */}
      <B c={HOODIE} p={[0, 1.5, -0.12]} s={[0.17, 0.12, 0.1]} />
      <B c={PINK} p={[0, 1.53, -0.075]} s={[0.12, 0.08, 0.05]} />
      {/* drawstrings */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={CYL} c="#f4f4f6" p={[0.045 * sx, 1.4, 0.245]} s={[0.006, 0.17, 0.006]} />
          <B g={CYL} c={PINK} p={[0.045 * sx, 1.31, 0.245]} s={[0.009, 0.025, 0.009]} />
        </group>
      ))}
      <B g={CYL} c={SKIN} p={[0, 1.54, 0]} s={[0.065, 0.1, 0.065]} />

      {/* arms: hoodie sleeves with pink cuffs. His right hand is at -x. */}
      {[
        [armR, -1],
        [armL, 1],
      ].map(([ref, sx]) => (
        <group key={sx} ref={ref} position={[0.31 * sx, 1.43, 0]}>
          <mesh geometry={CAP} material={hood} position={[0, -0.24, 0]} scale={[0.1, 0.2, 0.1]} />
          <B g={CYL} c={PINK} p={[0, -0.46, 0]} s={[0.088, 0.035, 0.088]} />
          <mesh geometry={SPH} material={skin} position={[0, -0.52, 0.01]} scale={[0.055, 0.062, 0.05]} />
        </group>
      ))}

      {/* head: shaved, slightly oval, with a short dark beard and a warm closed-mouth smile */}
      <group ref={head} position={[0, 1.625, 0]}>
        <B c={SKIN} p={[0, 0.06, 0]} s={[0.108, 0.135, 0.12]} />
        {/* jaw, a little squarer and fuller than the dome */}
        <B c={SKIN} p={[0, 0.0, 0.012]} s={[0.1, 0.085, 0.105]} />
        {/* shaved scalp: a shade darker over the top and back of the head */}
        <B c={SKIN_SHADE} p={[0, 0.098, -0.012]} s={[0.109, 0.1, 0.118]} />
        {[-1, 1].map((sx) => (
          <B key={sx} c={SKIN} p={[0.108 * sx, 0.055, -0.005]} s={[0.02, 0.034, 0.022]} />
        ))}
        {/* eyes: dark brown, a relaxed squint from the smile */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B c="#f5efe6" p={[0.04 * sx, 0.078, 0.105]} s={[0.019, 0.012, 0.01]} />
            <B c="#2a1a12" p={[0.04 * sx, 0.078, 0.113]} s={[0.01, 0.01, 0.005]} />
            {/* eyebrows: dark, fairly straight, slightly heavier at the inner end */}
            <B g={BOX} c={HAIR} p={[0.043 * sx, 0.104, 0.109]} r={[0, 0, -0.04 * sx]} s={[0.038, 0.008, 0.009]} />
          </group>
        ))}
        {/* nose: broad at the base */}
        <B c={SKIN} p={[0, 0.048, 0.121]} s={[0.016, 0.03, 0.02]} />
        <B c={SKIN} p={[0, 0.03, 0.118]} s={[0.026, 0.014, 0.018]} />
        {/* short beard: mustache, goatee and a stubble shadow along the jaw */}
        <B g={BOX} c="#2e211a" p={[0, 0.014, 0.116]} s={[0.042, 0.006, 0.006]} />
        <B c="#2e211a" p={[0, -0.058, 0.088]} s={[0.034, 0.022, 0.03]} />
        <B c="#4a3528" p={[0, -0.03, 0.02]} s={[0.099, 0.06, 0.092]} />
        {/* the smile: closed lips that turn up at the corners */}
        <B g={BOX} c="#7a4436" p={[0, -0.012, 0.114]} s={[0.03, 0.007, 0.006]} />
        {[-1, 1].map((sx) => (
          <B key={sx} g={BOX} c="#7a4436" p={[0.02 * sx, -0.006, 0.112]} r={[0, 0, 0.7 * sx]} s={[0.016, 0.006, 0.006]} />
        ))}
        {/* cheeks lifted by the smile */}
        {[-1, 1].map((sx) => (
          <B key={sx} c={SKIN} p={[0.05 * sx, 0.032, 0.09]} s={[0.022, 0.016, 0.018]} />
        ))}
      </group>
    </group>
  )
}
