import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import W from './wonder.js'
import { floorAt } from './layout.js'

// Photo boards: real photographs of the Taj Mahal from Wikimedia Commons, each on a little stand
// with a caption and the photographer's credit. Walk up to one and the HUD shows its caption too.
const BASE = import.meta.env.BASE_URL
let credits = null
const creditsReady = fetch(`${BASE}gallery/credits.json`)
  .then((r) => r.json())
  .then((list) => (credits = Object.fromEntries(list.map((c) => [c.key, c]))))
  .catch(() => (credits = {}))

export const creditLine = (c) => (c ? `Photo: ${c.author || 'unknown'} · ${c.license} · Wikimedia Commons` : '')

function captionTexture(caption, credit) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 220
  const g = c.getContext('2d')
  g.fillStyle = '#f6efe0'
  g.fillRect(0, 0, 1024, 220)
  g.strokeStyle = '#b08a46'
  g.lineWidth = 8
  g.strokeRect(6, 6, 1012, 208)
  g.fillStyle = '#2b2118'
  g.font = '34px Georgia, serif'
  const words = caption.split(' ')
  let line = ''
  let y = 62
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (g.measureText(test).width > 950 && line) {
      g.fillText(line, 36, y)
      line = w
      y += 44
    } else line = test
  }
  g.fillText(line, 36, y)
  g.fillStyle = '#7a6448'
  g.font = '24px system-ui, sans-serif'
  g.fillText(credit, 36, 196, 950)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const frameMat = new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 0.6 })
const postGeo = new THREE.BoxGeometry(0.08, 1, 0.08)

function Board({ b }) {
  const tex = useLoader(THREE.TextureLoader, `${BASE}gallery/${b.key}.jpg`)
  const [credit, setCredit] = useState(creditLine(credits?.[b.key]))
  useEffect(() => void creditsReady.then(() => setCredit(creditLine(credits[b.key]))), [b.key])
  const { photoMat, capMat, w, h } = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    const w = 2.4
    return {
      w,
      h: (w * tex.image.height) / tex.image.width,
      photoMat: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      capMat: new THREE.MeshStandardMaterial({ map: captionTexture(b.caption, credit), roughness: 0.9 }),
    }
  }, [tex, b.caption, credit])
  const y = floorAt(b.x, b.z)
  const bottom = 1.15
  return (
    <group position={[b.x, y, b.z]} rotation={[0, b.rot, 0]}>
      <mesh position={[0, bottom + h / 2, 0]} material={photoMat}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[0, bottom + h / 2, -0.04]} material={frameMat}>
        <boxGeometry args={[w + 0.14, h + 0.14, 0.06]} />
      </mesh>
      <mesh position={[0, bottom - 0.32, 0.01]} material={capMat}>
        <planeGeometry args={[w, w * (220 / 1024)]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={postGeo} material={frameMat} position={[s * (w / 2 - 0.1), (bottom + h) / 2, -0.08]} scale={[1, bottom + h, 1]} />
      ))}
    </group>
  )
}

// tells the HUD which board you're standing at (or null)
export default function Boards({ onNear }) {
  const near = useRef(null)
  useFrame(({ camera }) => {
    let best = null
    let bd = 6
    for (const b of W.boards) {
      const d = Math.hypot(camera.position.x - b.x, camera.position.z - b.z)
      if (d < bd && Math.abs(camera.position.y - floorAt(b.x, b.z) - 1.6) < 3) {
        bd = d
        best = b
      }
    }
    if (best !== near.current) {
      near.current = best
      onNear?.(best ? { ...best, credit: creditLine(credits?.[best.key]), title: credits?.[best.key]?.title } : null)
    }
  })
  return W.boards.map((b) => (
    <Suspense key={b.key} fallback={null}>
      <Board b={b} />
    </Suspense>
  ))
}
