import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SITE from './site.json'

// Jets of water from the nozzles down the long channel and the lotus in the central pool.
// The nozzle positions match blender/build_taj.py.
const S = SITE.site
const JETS = []
for (let z = S.terrace_s + 12; z < S.garden_s - 24; z += 12) {
  if (Math.abs(z - S.pool_z) > SITE.garden.pool_half + 2) JETS.push([0, 0.38, z, 1.1])
}
JETS.push([0, 1.2, S.pool_z, 1.8])
const PER = 40

function dot() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

export default function Fountains({ time }) {
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(JETS.length * PER * 3), 3))
    const p = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: dot(), size: 0.22, transparent: true, opacity: 0.7, depthWrite: false, color: '#eaf4ff' }),
    )
    p.frustumCulled = false
    return p
  }, [])

  // the spray isn't lit by the scene, so after dark it would glow; dim it to catch only moonlight
  useEffect(() => {
    points.material.opacity = time === 'night' ? 0.18 : 0.7
    points.material.color.set(time === 'night' ? '#9fb2d8' : '#eaf4ff')
  }, [time, points])

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    // only animate when you're near the garden; far away they're too small to see
    if (camera.position.distanceTo(new THREE.Vector3(0, 0, S.pool_z)) > 320) return
    const pos = points.geometry.attributes.position
    let k = 0
    JETS.forEach(([x, y, z, h], j) => {
      const v0 = Math.sqrt(2 * 9.8 * h)
      const T = (2 * v0) / 9.8
      for (let i = 0; i < PER; i++) {
        const tt = ((t / T + i / PER + j * 0.37) % 1) * T
        const a = i * 2.399 + j
        const spread = 0.16 * tt
        pos.array[k++] = x + Math.cos(a) * spread
        pos.array[k++] = y + v0 * tt - 4.9 * tt * tt
        pos.array[k++] = z + Math.sin(a) * spread
      }
    })
    pos.needsUpdate = true
  })
  return <primitive object={points} />
}
