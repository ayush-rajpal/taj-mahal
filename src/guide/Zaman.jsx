// From zlisto/evans-hall-3d (src/Zaman.jsx), unchanged apart from this line.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { B, BOX, CAP, CYL, SPH, TORUS, m, useTalker } from './avatar.js'

// Prof. Tauhid Zaman: muscular build, close-cropped buzz cut, black-and-pink BLACKPINK hoodie, a pink
// Labubu clipped to his belt loop. While you chat he turns to face you and talks with his hands.

export const ZAMAN = { slug: 'tauhid-zaman', name: 'Tauhid Zaman' }

const SKIN = '#c58f63'
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
        <group key={sx} position={[0.1 * sx, 0, 0.03]}>
          <B g={BOX} c="#f4f4f6" p={[0, 0.045, 0]} s={[0.11, 0.09, 0.27]} />
          <B g={BOX} c={PINK} p={[0.056 * sx, 0.05, 0]} s={[0.004, 0.03, 0.17]} />
          <B g={BOX} c="#d9d9de" p={[0, 0.006, 0]} s={[0.115, 0.012, 0.28]} />
        </group>
      ))}
      {/* jeans */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={CAP} material={m(JEANS)} position={[0.1 * sx, 0.5, 0]} scale={[0.075, 0.34, 0.08]} />
      ))}
      <B g={BOX} c={JEANS} p={[0, 0.87, 0]} s={[0.34, 0.12, 0.2]} />
      <B g={BOX} c="#1a1a1a" p={[0, 0.915, 0]} s={[0.345, 0.03, 0.205]} />
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
      <B g={CYL} c={SKIN} p={[0, 1.52, 0]} s={[0.065, 0.07, 0.065]} />

      {/* arms: hoodie sleeves with pink cuffs. His right hand is at -x. */}
      {[
        [armR, -1],
        [armL, 1],
      ].map(([ref, sx]) => (
        <group key={sx} ref={ref} position={[0.3 * sx, 1.43, 0]}>
          <mesh geometry={CAP} material={hood} position={[0, -0.24, 0]} scale={[0.085, 0.2, 0.085]} />
          <B g={CYL} c={PINK} p={[0, -0.46, 0]} s={[0.078, 0.035, 0.078]} />
          <mesh geometry={SPH} material={skin} position={[0, -0.52, 0.01]} scale={[0.05, 0.058, 0.045]} />
        </group>
      ))}

      {/* head */}
      <group ref={head} position={[0, 1.58, 0]}>
        <B c={SKIN} p={[0, 0.06, 0]} s={[0.112, 0.132, 0.122]} />
        {[-1, 1].map((sx) => (
          <B key={sx} c={SKIN} p={[0.113 * sx, 0.055, -0.005]} s={[0.02, 0.034, 0.02]} />
        ))}
        {/* close-cropped buzz cut: a thin layer hugging the scalp, sharp line-up at the temples */}
        <B c={HAIR} p={[0, 0.105, -0.012]} s={[0.116, 0.088, 0.12]} />
        {[-1, 1].map((sx) => (
          <B key={sx} g={BOX} c={HAIR} p={[0.105 * sx, 0.085, 0.02]} s={[0.01, 0.045, 0.055]} />
        ))}
        {/* eyes */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B c="#ffffff" p={[0.042 * sx, 0.075, 0.106]} s={[0.02, 0.016, 0.01]} />
            <B c="#1d1410" p={[0.042 * sx, 0.075, 0.114]} s={[0.011, 0.012, 0.006]} />
            <B g={BOX} c={HAIR} p={[0.044 * sx, 0.106, 0.11]} r={[0, 0, -0.08 * sx]} s={[0.042, 0.011, 0.01]} />
          </group>
        ))}
        {/* nose + big grin */}
        <B c={SKIN} p={[0, 0.04, 0.122]} s={[0.018, 0.026, 0.02]} />
        <B g={BOX} c="#5a2620" p={[0, 0.0, 0.112]} s={[0.05, 0.014, 0.008]} />
        <B g={BOX} c="#ffffff" p={[0, 0.003, 0.115]} s={[0.04, 0.006, 0.006]} />
      </group>
    </group>
  )
}
