import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import W from './wonder.js'

// Sky, sun, moon and stars for each time of day in wonder.js. The sun casts one big shadow map
// fitted to the whole complex; it's only redrawn when the light changes (refreshShadows), not every
// frame, because nothing in the scene moves.

let glRef = null
export const refreshShadows = () => glRef && (glRef.shadowMap.needsUpdate = true)

const COMPLEX = [new THREE.Vector3(-160, -6, -60), new THREE.Vector3(160, 75, 475)] // what the shadows cover

function sunDir(el, az) {
  const e = THREE.MathUtils.degToRad(el)
  const a = THREE.MathUtils.degToRad(az)
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e))
}

function fitShadow(light, dir) {
  const center = COMPLEX[0].clone().add(COMPLEX[1]).multiplyScalar(0.5)
  light.position.copy(center).addScaledVector(dir, 900)
  light.target.position.copy(center)
  light.updateMatrixWorld()
  light.target.updateMatrixWorld()
  const cam = light.shadow.camera
  cam.position.copy(light.position)
  cam.lookAt(center)
  cam.updateMatrixWorld()
  const inv = cam.matrixWorld.clone().invert()
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity)
  const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? COMPLEX[1].x : COMPLEX[0].x, i & 2 ? COMPLEX[1].y : COMPLEX[0].y, i & 4 ? COMPLEX[1].z : COMPLEX[0].z)
    p.applyMatrix4(inv)
    lo.min(p)
    hi.max(p)
  }
  Object.assign(cam, { left: lo.x, right: hi.x, bottom: lo.y, top: hi.y, near: Math.max(1, -hi.z - 20), far: -lo.z + 20 })
  cam.updateProjectionMatrix()
}

function starField() {
  const n = 2500
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 * Math.PI
    const v = Math.random() * 0.95 + 0.04
    const r = 3000
    pos.set([r * Math.cos(u) * Math.sqrt(1 - v * v), r * v, r * Math.sin(u) * Math.sqrt(1 - v * v)], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }))
}

function moonSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const halo = g.createRadialGradient(128, 128, 30, 128, 128, 128)
  halo.addColorStop(0, 'rgba(255,250,235,0.9)')
  halo.addColorStop(0.35, 'rgba(220,230,255,0.25)')
  halo.addColorStop(1, 'rgba(200,210,255,0)')
  g.fillStyle = halo
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#f6f1e2'
  g.beginPath()
  g.arc(128, 128, 34, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(160,160,170,0.35)'
  for (const [x, y, r] of [[118, 120, 8], [140, 134, 6], [126, 142, 5], [136, 114, 4]]) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }))
  s.scale.setScalar(420)
  return s
}

export default function Atmosphere({ time }) {
  const { scene, gl } = useThree()
  const parts = useMemo(() => {
    const sky = new Sky()
    sky.scale.setScalar(4000)
    const envSky = new Sky()
    envSky.scale.setScalar(500)
    const envScene = new THREE.Scene()
    envScene.add(envSky)
    const nightEnv = new THREE.Scene()
    nightEnv.background = new THREE.Color('#1b2747')
    const sun = new THREE.DirectionalLight('#ffffff', 3)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.06
    const hemi = new THREE.HemisphereLight('#d4e4f7', '#8a775c', 1)
    return { sky, envSky, envScene, nightEnv, sun, hemi, stars: starField(), moon: moonSprite(), pmrem: new THREE.PMREMGenerator(gl), env: null }
  }, [gl])

  useEffect(() => {
    glRef = gl
    if (import.meta.env.DEV) Object.assign(window, { __scene: scene, __gl: gl, __sun: parts.sun }) // for poking at it in devtools
    gl.shadowMap.autoUpdate = false
    const { sky, sun, hemi, stars, moon } = parts
    scene.add(sky, sun, sun.target, hemi, stars, moon)
    scene.fog = new THREE.Fog('#cad8e6', 450, 2600)
    return () => {
      scene.remove(sky, sun, sun.target, hemi, stars, moon)
      scene.fog = null
      parts.env?.dispose()
    }
  }, [scene, gl, parts])

  useEffect(() => {
    const t = W.times[time] ?? W.times[W.defaultTime]
    const { sky, envSky, envScene, nightEnv, sun, hemi, stars, moon, pmrem } = parts
    const dir = sunDir(t.el, t.az)
    const night = !!t.moon
    for (const s of [sky, envSky]) {
      const u = s.material.uniforms
      u.turbidity.value = t.turbidity ?? 2
      u.rayleigh.value = t.rayleigh ?? 1
      u.mieCoefficient.value = t.mie ?? 0.005
      u.mieDirectionalG.value = 0.82
      u.sunPosition.value.copy(dir)
    }
    sky.visible = !night
    stars.visible = moon.visible = night
    moon.position.copy(dir).multiplyScalar(2800)
    scene.background = night ? new THREE.Color('#070d1e') : null
    sun.color.set(t.sun)
    sun.intensity = t.sunI
    hemi.color.set(t.sky)
    hemi.groundColor.set(t.ground)
    hemi.intensity = t.hemiI
    scene.fog.color.set(t.fog)
    gl.toneMappingExposure = t.exposure
    fitShadow(sun, dir)
    parts.env?.dispose()
    parts.env = pmrem.fromScene(night ? nightEnv : envScene, 0, 1, 2000)
    scene.environment = parts.env.texture
    scene.environmentIntensity = t.envI ?? 0.6
    refreshShadows()
  }, [time, parts, scene, gl])
  return null
}
