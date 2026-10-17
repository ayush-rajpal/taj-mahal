import { useEffect, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import SITE from './site.json'
import { refreshShadows } from './Atmosphere.jsx'

// The monument: one Blender-built model (blender/build_taj.py) with every texture inside it.
// A few materials get web-only touches here: the jali screen cuts out its holes, the water reflects
// the sky, and the long channel becomes a real mirror so the tomb reflects in it.
const BASE = import.meta.env.BASE_URL
const draco = new DRACOLoader().setDecoderPath(`${BASE}draco/`)
export const MODEL_URL = `${BASE}models/taj_mahal.glb`

export default function TajModel() {
  const { gl } = useThree()
  const gltf = useLoader(GLTFLoader, MODEL_URL, (l) => l.setDRACOLoader(draco))

  useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    const water = new THREE.MeshStandardMaterial({ color: '#2a4b4f', roughness: 0.04, metalness: 0.15, envMapIntensity: 1.3 })
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return
      const isWater = o.name.startsWith('WATER')
      o.castShadow = !isWater && o.name !== 'Grounds'
      o.receiveShadow = true
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach((m) => {
        if (m.map) m.map.anisotropy = aniso
        if (m.name === 'jali') Object.assign(m, { alphaTest: 0.5, transparent: false, side: THREE.DoubleSide })
        if (m.name === 'marble' || m.name.startsWith('tomb_') || m.name === 'dome') m.envMapIntensity = 0.55
        if (m.name === 'gold') m.envMapIntensity = 1.4
        // the chamber is lit only by the lamp and what filters through the screens, so it reads dimmer
        // than the sunlit outside (the sky light can't be blocked per room, so its surfaces are darkened)
        if (/^(chamber_|inner_dome|cenotaph|jali)/.test(m.name) && !m.userData.dimmed) {
          m.color.multiplyScalar(0.55)
          m.envMapIntensity = 0.25
          m.userData.dimmed = true // the loader caches the model, so only ever do this once
        }
      })
      if (isWater) o.material = water
    })
  }, [gltf, gl])

  // the long channel: a real planar mirror, a hair above the water surface
  const mirror = useMemo(() => {
    const g = SITE.garden
    const z0 = SITE.site.terrace_s + 6
    const z1 = SITE.site.garden_s - 22
    const r = new Reflector(new THREE.PlaneGeometry(2 * g.channel_half, z1 - z0), {
      clipBias: 0.003,
      textureWidth: Math.round(window.innerWidth * Math.min(window.devicePixelRatio, 1.5) * 0.6),
      textureHeight: Math.round(window.innerHeight * Math.min(window.devicePixelRatio, 1.5) * 0.6),
      color: 0x8a9c9c,
    })
    r.rotation.x = -Math.PI / 2
    r.position.set(0, -0.2, (z0 + z1) / 2)
    return r
  }, [])

  useEffect(() => {
    refreshShadows()
    const t = setTimeout(refreshShadows, 500) // once more after textures have uploaded
    return () => clearTimeout(t)
  }, [gltf])

  const lampY = SITE.levels.plinth + 6.1
  return (
    <>
      <primitive object={gltf.scene} />
      <primitive object={mirror} />
      {/* the lamp over the cenotaphs: the chamber's only light besides what comes through the screens */}
      <pointLight position={[0, lampY, 0]} color="#ffbf73" intensity={70} distance={16} decay={2} />
    </>
  )
}
