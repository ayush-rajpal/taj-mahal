import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import World from './World.jsx'
import Player from './Player.jsx'
import TouchControls from './TouchControls.jsx'
import TalkAim from './guide/TalkAim.jsx'
import GuidePanel from './guide/GuidePanel.jsx'
import Minimap from './Minimap.jsx'
import { EYE, SPAWN, floorAt } from './layout.js'
import { onIdentity, presence } from './mvw.js'
import W from './wonder.js'

const NAME = W.name
const BLURB = W.blurb

// loading progress for the model and photos (the overlay shows it until everything's in)
function useLoading() {
  const [p, setP] = useState({ loaded: 0, total: 1, done: false })
  useEffect(() => {
    const m = THREE.DefaultLoadingManager
    m.onProgress = (_, loaded, total) => setP((s) => ({ ...s, loaded, total }))
    m.onLoad = () => setP((s) => ({ ...s, done: true }))
    return () => {
      m.onProgress = m.onLoad = undefined
    }
  }, [])
  return p
}

export default function App() {
  const [locked, setLocked] = useState(false)
  const [where, setWhere] = useState('')
  const lockRef = useRef()
  const loading = useLoading()
  const [time, setTime] = useState(W.defaultTime)
  const [board, setBoard] = useState(null)
  const [showMap, setShowMap] = useState(true)
  const mapRef = useRef()
  const onLock = useCallback((v) => {
    setLocked(v)
    if (v) setFree(false) // the mouse is locked now; Esc brings back the menu as a pause screen
  }, [])
  // Every arrival starts on the menu: one clear click to walk in and lock the mouse. `free` is a
  // walking-without-the-mouse-locked state, used after closing the guide's chat.
  const [free, setFree] = useState(false)
  const freeRef = useRef(free)
  freeRef.current = free
  const onWhere = useCallback((w) => {
    setWhere(w)
    presence(w) // tell the Metaverse Browser where you are (mvw/0.1 `presence`)
  }, [])
  const [me, setMe] = useState(null)
  useEffect(() => onIdentity(setMe), [])

  // phones have no pointer lock, so they get a joystick + drag-to-look instead
  const [isTouch] = useState(() => matchMedia('(pointer: coarse)').matches)
  const [touchOn, setTouchOn] = useState(false)
  const touchRef = useRef({ active: false, move: [0, 0], look: [0, 0], jump: false })
  const setTouch = (on) => {
    touchRef.current.active = on
    touchRef.current.move = [0, 0]
    setTouchOn(on)
  }
  // talking to the guide: aim at them and click or press E, or press G (or the button) anywhere
  const [aim, setAim] = useState(null)
  const [talking, setTalking] = useState(false)
  const startTalk = useCallback(() => {
    setFree(false)
    setTalking(true)
    document.exitPointerLock?.()
  }, [])
  const endTalk = useCallback(() => {
    setTalking(false)
    if (touchOn) return
    setFree(true)
    lockRef.current?.()
  }, [touchOn])
  const teleport = useCallback(
    (s) => {
      if (!s) return
      dispatchEvent(new CustomEvent('teleport', { detail: s }))
      endTalk()
    },
    [endTalk],
  )

  useEffect(() => {
    document.body.classList.toggle('freelook', free)
  }, [free])
  const playing = locked || touchOn || free || talking
  useEffect(() => {
    if (!free || talking) return
    if (isTouch) {
      setTouch(true)
      setFree(false)
      return
    }
    const click = (e) => !e.target.closest('button, a, .guide, .hud') && lockRef.current?.()
    addEventListener('mousedown', click)
    return () => removeEventListener('mousedown', click)
  }, [free, talking]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!talking || touchOn) return
    const clickOut = (e) => {
      if (e.button !== 0 || e.target.closest('.guide, button, a, .hud')) return
      endTalk()
    }
    addEventListener('mousedown', clickOut)
    return () => removeEventListener('mousedown', clickOut)
  }, [talking, touchOn, endTalk])

  // keys: G asks the guide from anywhere, T steps through the times of day
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.('input, textarea') || !playing) return
      if (e.code === 'KeyG' && !talking) startTalk()
      if (e.code === 'KeyM') setShowMap((v) => !v)
      if (e.code === 'KeyT') {
        const ids = Object.keys(W.times)
        setTime((t) => ids[(ids.indexOf(t) + 1) % ids.length])
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [playing, talking, startTalk])

  const pct = Math.round((100 * loading.loaded) / Math.max(1, loading.total))
  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 70, near: 0.1, far: 4000, position: [SPAWN.x, floorAt(SPAWN.x, SPAWN.z) + EYE, SPAWN.z] }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
      >
        <World time={time} talking={talking} onTalk={startTalk} onBoard={setBoard} />
        <TalkAim enabled={playing && !talking} onAim={setAim} onTalk={startTalk} />
        <Player lockRef={lockRef} mapRef={mapRef} freeRef={freeRef} touchRef={touchRef} onLock={onLock} onWhere={onWhere} />
      </Canvas>

      <div className="where">
        <span className="dot" style={me?.color ? { background: me.color } : undefined} />
        {where}
      </div>
      {playing && (
        <div className="hud">
          <div className="hud-times">
            {Object.entries(W.times).map(([id, t]) => (
              <button key={id} className={id === time ? 'on' : ''} onClick={() => setTime(id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="hud-row">
            <button className="hud-ask" onClick={() => setShowMap((v) => !v)}>
              {showMap ? 'hide map' : 'map'} <kbd>M</kbd>
            </button>
            {!talking && (
              <button className="hud-ask" onClick={startTalk}>
                {W.guideIcon} Ask {W.guideName} <kbd>G</kbd>
              </button>
            )}
          </div>
        </div>
      )}
      {/* the map stays drawn even when hidden, so it's up to date the moment you open it */}
      <div className={`mapwrap${touchOn ? ' touch' : ''}${showMap && playing && !talking ? '' : ' hidden'}`}>
        <Minimap drawRef={mapRef} />
      </div>
      {playing && <div className="crosshair" />}
      {free && !talking && <div className="hint">Move the mouse to look · click to lock it · WASD to walk</div>}
      {aim && playing && !talking && (
        <div className="talkhint">
          {touchOn ? <button onClick={startTalk}>💬 Talk to {W.guideName}</button> : locked ? `Click or press E to talk to ${W.guideName}` : `Press E to talk to ${W.guideName}`}
        </div>
      )}
      {board && playing && !talking && (
        <div className="board-card">
          <p>{board.caption}</p>
          <span>{board.credit}</span>
        </div>
      )}
      {talking && <GuidePanel visitor={me?.name} onClose={endTalk} onTeleport={teleport} />}
      {touchOn && <TouchControls touchRef={touchRef} onPause={() => setTouch(false)} />}

      {!playing && (
        <div className="overlay" onClick={() => (isTouch ? setTouch(true) : lockRef.current?.())}>
          <div className="card">
            <div className="kicker">{me?.name ? `Welcome, ${me.name}` : 'Welcome'} · {W.place}</div>
            <h1>{NAME}</h1>
            <p className="sub">{BLURB}</p>
            <p className="by">A world by {W.author}</p>
            {!loading.done && (
              <div className="loading">
                <div className="loading-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
                {loading.total > 1 ? `Loading the marble… ${pct}%` : 'Loading the marble…'}
              </div>
            )}
            <button className="go">{isTouch ? 'Tap to walk in' : 'Click to walk in'}</button>
            {!isTouch && (
              <button
                className="go alt"
                onClick={(e) => {
                  e.stopPropagation()
                  setTouch(true)
                }}
              >
                Use on-screen joystick
              </button>
            )}
            <div className="keys">
              {isTouch ? (
                <>
                  <span><b>Left thumb</b> walk</span>
                  <span><b>Right thumb</b> drag to look</span>
                </>
              ) : (
                <>
                  <span><b>WASD</b> walk</span>
                  <span><b>Mouse</b> look</span>
                  <span><b>Shift</b> run</span>
                  <span><b>Space</b> jump</span>
                  <span><b>E</b> talk</span>
                  <span><b>G</b> ask the guide</span>
                  <span><b>T</b> time of day</span>
                  <span><b>M</b> map</span>
                  <span><b>Esc</b> pause</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
