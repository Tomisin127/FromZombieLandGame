'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { JoystickVector } from './Joystick'

interface Zombie {
  id: number
  position: THREE.Vector3
  health: number
  speed: number
  mesh?: THREE.Group
  isDying?: boolean
  deathStartTime?: number
}

interface Tracer {
  mesh: THREE.Mesh
  startTime: number
  duration: number
}

interface Particle {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
  maxLife: number
}

interface GameState {
  kills: number
  difficulty: number
  gameOver: boolean
  isPaused: boolean
}

const PLAYER_SPEED = 4.2
const PLAYER_COLLISION_RADIUS = 1.2
const SHOULDER_OFFSET = 0.9 // how far camera is shifted right for over-the-shoulder view

export default function GameContainer({
  gameState,
  onKill,
  onGameOver,
  movementRef,
}: {
  gameState: GameState
  onKill: (count: number) => void
  onGameOver: () => void
  movementRef: React.MutableRefObject<JoystickVector>
}) {
  const [screenFlash, setScreenFlash] = useState(false)

  return (
    <div className="w-full h-full relative bg-black">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 3, 6], fov: 70 }}
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none',
          display: 'block',
        }}
      >
        <GameScene
          gameState={gameState}
          onKill={onKill}
          onGameOver={onGameOver}
          movementRef={movementRef}
          onShoot={() => {
            setScreenFlash(true)
            setTimeout(() => setScreenFlash(false), 70)
          }}
        />
      </Canvas>

      {screenFlash && (
        <div className="absolute inset-0 bg-orange-400/15 pointer-events-none" />
      )}
    </div>
  )
}

function GameScene({
  gameState,
  onKill,
  onGameOver,
  onShoot,
  movementRef,
}: {
  gameState: GameState
  onKill: (count: number) => void
  onGameOver: () => void
  onShoot: () => void
  movementRef: React.MutableRefObject<JoystickVector>
}) {
  const { camera, gl } = useThree()
  const zombieGroupRef = useRef<THREE.Group>(null!)
  const effectsGroupRef = useRef<THREE.Group>(null!)
  const playerRef = useRef<THREE.Group>(null!)
  const muzzleRef = useRef<THREE.Mesh>(null!)
  const raycasterRef = useRef(new THREE.Raycaster())

  const stateRef = useRef({
    zombies: [] as Zombie[],
    tracers: [] as Tracer[],
    particles: [] as Particle[],
    muzzleVisibleUntil: 0,
    kills: 0,
    difficulty: 0,
    zombieSpeed: 1.5,
    spawnTimer: -2,
    difficultyTimer: 0,
    zombieCounter: 0,
    isGameRunning: true,
    cameraAngle: 0,
    cameraPitch: 0.35,
    cameraDistance: 6,
    lastTouchX: 0,
    lastTouchY: 0,
    isDragging: false,
    touchStartTime: 0,
    dragDistance: 0,
    playerPos: new THREE.Vector3(0, 0, 0),
  })

  const prevGameOverRef = useRef(gameState.gameOver)

  // Handle restart: wipe zombies, tracers, particles, reset state
  useEffect(() => {
    if (prevGameOverRef.current && !gameState.gameOver) {
      const s = stateRef.current
      if (zombieGroupRef.current) {
        while (zombieGroupRef.current.children.length > 0) {
          zombieGroupRef.current.remove(zombieGroupRef.current.children[0])
        }
      }
      if (effectsGroupRef.current) {
        while (effectsGroupRef.current.children.length > 0) {
          effectsGroupRef.current.remove(effectsGroupRef.current.children[0])
        }
      }
      s.zombies = []
      s.tracers = []
      s.particles = []
      s.muzzleVisibleUntil = 0
      s.kills = 0
      s.difficulty = 0
      s.zombieSpeed = 1.5
      s.spawnTimer = -2
      s.difficultyTimer = 0
      s.zombieCounter = 0
      s.playerPos.set(0, 0, 0)
      // Reset movement
      movementRef.current = { x: 0, y: 0 }
    }
    prevGameOverRef.current = gameState.gameOver
    stateRef.current.isGameRunning = !gameState.gameOver && !gameState.isPaused
  }, [gameState.gameOver, gameState.isPaused, movementRef])

  // Input: pointer events so joystick (separate pointer) + camera drag work simultaneously
  useEffect(() => {
    const canvas = gl.domElement
    const state = stateRef.current
    // Track one camera-drag pointer at a time; the joystick captures its own pointer
    // on a separate element so those events never reach the canvas.
    let activePointerId: number | null = null
    canvas.style.touchAction = 'none'

    const handleDown = (e: PointerEvent) => {
      if (!state.isGameRunning) return
      if (activePointerId !== null) return // already tracking one pointer for camera
      activePointerId = e.pointerId
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {}
      state.lastTouchX = e.clientX
      state.lastTouchY = e.clientY
      state.isDragging = true
      state.touchStartTime = Date.now()
      state.dragDistance = 0
    }

    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return
      if (!state.isDragging || !state.isGameRunning) return
      e.preventDefault()
      const dx = e.clientX - state.lastTouchX
      const dy = e.clientY - state.lastTouchY
      state.dragDistance += Math.abs(dx) + Math.abs(dy)

      state.cameraAngle -= dx * 0.008
      state.cameraPitch = Math.max(
        0.15,
        Math.min(1.2, state.cameraPitch + dy * 0.005),
      )

      state.lastTouchX = e.clientX
      state.lastTouchY = e.clientY
    }

    const handleEnd = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {}
      activePointerId = null

      if (!state.isGameRunning) {
        state.isDragging = false
        return
      }

      const duration = Date.now() - state.touchStartTime
      const wasTap = duration < 300 && state.dragDistance < 15

      if (wasTap) {
        onShoot()
        shoot(
          state,
          camera,
          raycasterRef.current,
          zombieGroupRef.current,
          effectsGroupRef.current,
          muzzleRef.current,
          onKill,
        )
      }

      state.isDragging = false
    }

    canvas.addEventListener('pointerdown', handleDown)
    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerup', handleEnd)
    canvas.addEventListener('pointercancel', handleEnd)

    return () => {
      canvas.removeEventListener('pointerdown', handleDown)
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerup', handleEnd)
      canvas.removeEventListener('pointercancel', handleEnd)
    }
  }, [camera, gl, onKill, onShoot])

  useFrame((threeState, delta) => {
    const state = stateRef.current
    const dt = Math.min(delta, 0.1)
    const elapsed = threeState.clock.elapsedTime

    // Direction vectors relative to camera angle
    const forwardX = -Math.sin(state.cameraAngle)
    const forwardZ = -Math.cos(state.cameraAngle)
    const rightX = Math.cos(state.cameraAngle)
    const rightZ = -Math.sin(state.cameraAngle)

    if (state.isGameRunning) {
      // --- Player movement from joystick ---
      const mv = movementRef.current
      const mag = Math.hypot(mv.x, mv.y)
      if (mag > 0.08) {
        const nx = mv.x
        const ny = mv.y
        const moveX = forwardX * ny + rightX * nx
        const moveZ = forwardZ * ny + rightZ * nx
        state.playerPos.x += moveX * PLAYER_SPEED * dt
        state.playerPos.z += moveZ * PLAYER_SPEED * dt
        // Clamp to arena
        state.playerPos.x = Math.max(-22, Math.min(22, state.playerPos.x))
        state.playerPos.z = Math.max(-22, Math.min(22, state.playerPos.z))
      }

      // --- Difficulty + spawn ---
      state.difficultyTimer += dt
      if (state.difficultyTimer > 15) {
        state.difficulty++
        state.zombieSpeed = Math.min(5, 1.5 + state.difficulty * 0.3)
        state.difficultyTimer = 0
      }

      state.spawnTimer += dt
      const spawnInterval = Math.max(0.7, 2.5 - state.difficulty * 0.15)
      const aliveCount = state.zombies.filter((z) => !z.isDying).length
      if (state.spawnTimer > spawnInterval && aliveCount < 15) {
        const angle = Math.random() * Math.PI * 2
        const MIN_SAFE_DISTANCE = 15
        const distance = MIN_SAFE_DISTANCE + Math.random() * 5
        spawnZombie(state, zombieGroupRef.current, angle, distance)
        state.spawnTimer = 0
      }
    }

    // --- Update zombies (both alive & dying) ---
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const zombie = state.zombies[i]
      if (!zombie.mesh) continue

      if (zombie.isDying) {
        // Death animation: fall backward + fade
        const age = (performance.now() - (zombie.deathStartTime || 0)) / 1000
        const fallProgress = Math.min(1, age / 0.6)
        zombie.mesh.rotation.x = (Math.PI / 2) * fallProgress
        zombie.mesh.position.y = -fallProgress * 0.15

        // Fade out
        const opacity = Math.max(0, 1 - age / 1.4)
        zombie.mesh.traverse((c) => {
          const m = c as THREE.Mesh
          if ((m as any).isMesh && m.material) {
            const mat = m.material as THREE.Material & { opacity?: number; transparent?: boolean }
            mat.transparent = true
            mat.opacity = opacity
          }
        })

        if (age > 1.4) {
          zombieGroupRef.current.remove(zombie.mesh)
          state.zombies.splice(i, 1)
        }
        continue
      }

      if (!state.isGameRunning) continue

      // Chase player
      const direction = new THREE.Vector3()
        .subVectors(state.playerPos, zombie.position)
        .normalize()
      zombie.position.add(direction.multiplyScalar(dt * zombie.speed))
      zombie.mesh.position.copy(zombie.position)
      zombie.mesh.lookAt(state.playerPos.x, zombie.position.y, state.playerPos.z)

      // Walking bob
      const bobOffset = Math.sin(elapsed * 8 + zombie.id) * 0.08
      zombie.mesh.position.y = bobOffset

      // Collision
      const dist = zombie.position.distanceTo(state.playerPos)
      if (dist < PLAYER_COLLISION_RADIUS) {
        state.isGameRunning = false
        onGameOver()
        return
      }
    }

    // --- Update tracers (fade + cleanup) ---
    const now = performance.now()
    for (let i = state.tracers.length - 1; i >= 0; i--) {
      const tr = state.tracers[i]
      const age = (now - tr.startTime) / 1000
      const t = age / tr.duration
      if (t >= 1) {
        effectsGroupRef.current?.remove(tr.mesh)
        tr.mesh.geometry.dispose()
        ;(tr.mesh.material as THREE.Material).dispose()
        state.tracers.splice(i, 1)
      } else {
        const mat = tr.mesh.material as THREE.MeshBasicMaterial
        mat.opacity = 1 - t
      }
    }

    // --- Update blood / debris particles ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        effectsGroupRef.current?.remove(p.mesh)
        p.mesh.geometry.dispose()
        ;(p.mesh.material as THREE.Material).dispose()
        state.particles.splice(i, 1)
        continue
      }
      // Gravity
      p.vel.y -= 14 * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      // Stop at ground
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02
        p.vel.set(0, 0, 0)
      }
      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, p.life / p.maxLife)
    }

    // --- Muzzle flash toggle ---
    if (muzzleRef.current) {
      muzzleRef.current.visible = now < state.muzzleVisibleUntil
      if (muzzleRef.current.visible) {
        // Jitter scale for that pop feel
        const s = 0.9 + Math.random() * 0.5
        muzzleRef.current.scale.set(s, s, s)
      }
    }

    // --- Camera: over-the-shoulder orbit ---
    const cx = Math.sin(state.cameraAngle) * state.cameraDistance * Math.cos(state.cameraPitch)
    const cz = Math.cos(state.cameraAngle) * state.cameraDistance * Math.cos(state.cameraPitch)
    const cy = state.cameraDistance * Math.sin(state.cameraPitch) + 1.6

    // Shift camera & lookAt by the shoulder offset so the crosshair sits past the player, not on him
    const shoulderX = rightX * SHOULDER_OFFSET
    const shoulderZ = rightZ * SHOULDER_OFFSET

    camera.position.set(
      state.playerPos.x + cx + shoulderX,
      state.playerPos.y + cy,
      state.playerPos.z + cz + shoulderZ
    )

    // Look ahead of the player so center-of-screen aims at the world, not the character
    const aimAhead = 6
    camera.lookAt(
      state.playerPos.x + forwardX * aimAhead + shoulderX,
      state.playerPos.y + 1.1,
      state.playerPos.z + forwardZ * aimAhead + shoulderZ
    )

    // Player position & rotation
    if (playerRef.current) {
      playerRef.current.position.copy(state.playerPos)
      playerRef.current.rotation.y = state.cameraAngle + Math.PI
    }
  })

  return (
    <>
      <color attach="background" args={['#1a1a2e']} />
      <fog attach="fog" args={['#1a1a2e', 15, 40]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 5, 0]} intensity={0.8} color="#ff6b00" distance={15} />
      <hemisphereLight args={['#4a6fa5', '#2d2d4d', 0.4]} />

      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3d3d5c" roughness={0.9} />
      </mesh>

      <gridHelper args={[50, 50, '#5a5a8a', '#2a2a4a']} position={[0, 0.01, 0]} />

      <EnvironmentProps />

      <group ref={playerRef} position={[0, 0, 0]}>
        <PlayerCharacter muzzleRef={muzzleRef} />
      </group>

      <group ref={zombieGroupRef} />
      <group ref={effectsGroupRef} />
    </>
  )
}

function PlayerCharacter({ muzzleRef }: { muzzleRef: React.MutableRefObject<THREE.Mesh> }) {
  return (
    <group>
      <mesh position={[-0.15, 0.35, 0]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.2]} />
        <meshStandardMaterial color="#2d4a7a" />
      </mesh>
      <mesh position={[0.15, 0.35, 0]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.2]} />
        <meshStandardMaterial color="#2d4a7a" />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.55, 0.6, 0.35]} />
        <meshStandardMaterial color="#ff6b00" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#f4c58e" />
      </mesh>
      <mesh position={[0, 1.7, -0.02]} castShadow>
        <sphereGeometry args={[0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1a3a5a" />
      </mesh>
      <mesh position={[-0.38, 1.0, 0]} castShadow>
        <boxGeometry args={[0.18, 0.55, 0.18]} />
        <meshStandardMaterial color="#ff6b00" />
      </mesh>
      <mesh position={[0.38, 1.0, 0.15]} castShadow rotation={[Math.PI / 3, 0, 0]}>
        <boxGeometry args={[0.18, 0.55, 0.18]} />
        <meshStandardMaterial color="#ff6b00" />
      </mesh>
      <group position={[0.38, 1.1, 0.5]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.12, 0.6]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[0, -0.12, -0.15]} castShadow>
          <boxGeometry args={[0.1, 0.18, 0.2]} />
          <meshStandardMaterial color="#4a3a2a" />
        </mesh>
        <mesh position={[0, 0.08, 0.2]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.2]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Muzzle flash — hidden by default, shown briefly on shoot */}
        <mesh ref={muzzleRef} position={[0, 0, 0.38]} visible={false}>
          <sphereGeometry args={[0.18, 10, 10]} />
          <meshBasicMaterial color="#fff2a8" transparent opacity={0.95} />
        </mesh>
        {/* Muzzle light point source */}
        <MuzzleLight muzzleRef={muzzleRef} />
      </group>
    </group>
  )
}

function MuzzleLight({ muzzleRef }: { muzzleRef: React.MutableRefObject<THREE.Mesh> }) {
  const lightRef = useRef<THREE.PointLight>(null!)
  useFrame(() => {
    if (lightRef.current && muzzleRef.current) {
      lightRef.current.intensity = muzzleRef.current.visible ? 3.5 : 0
    }
  })
  return <pointLight ref={lightRef} color="#ffaa33" intensity={0} distance={6} />
}

function EnvironmentProps() {
  const obstacles: Array<{ pos: [number, number, number]; size: [number, number, number]; color: string }> = [
    { pos: [-8, 0.5, -5], size: [1.5, 1, 1.5], color: '#5a4a3a' },
    { pos: [7, 0.5, -8], size: [1.2, 1, 1.2], color: '#4a3a2a' },
    { pos: [10, 0.75, 4], size: [1, 1.5, 1], color: '#6a5a4a' },
    { pos: [-6, 0.5, 8], size: [2, 1, 1], color: '#5a4a3a' },
    { pos: [3, 1, -11], size: [1, 2, 1], color: '#4a3a2a' },
    { pos: [-11, 0.5, 2], size: [1.5, 1, 1.5], color: '#6a5a4a' },
    { pos: [12, 0.5, -2], size: [1.3, 1, 1.3], color: '#5a4a3a' },
    { pos: [-3, 0.5, -10], size: [1.8, 1, 1.2], color: '#4a3a2a' },
  ]

  return (
    <>
      {obstacles.map((obs, i) => (
        <mesh key={i} position={obs.pos} castShadow receiveShadow>
          <boxGeometry args={obs.size} />
          <meshStandardMaterial color={obs.color} roughness={0.8} />
        </mesh>
      ))}
    </>
  )
}

function shoot(
  state: any,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  zombieGroup: THREE.Group,
  effectsGroup: THREE.Group,
  muzzleMesh: THREE.Mesh | null,
  onKill: (count: number) => void
) {
  if (!zombieGroup || !effectsGroup) return

  // Muzzle flash timer
  state.muzzleVisibleUntil = performance.now() + 70

  // Cast ray from camera through screen center
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)

  // Only test against ALIVE zombies
  const aliveZombies = (state.zombies as Zombie[]).filter((z) => !z.isDying && z.mesh)
  const testTargets = aliveZombies.map((z) => z.mesh!) as THREE.Object3D[]
  const intersects =
    testTargets.length > 0 ? raycaster.intersectObjects(testTargets, true) : []

  // Compute tracer endpoints
  const gunTip = new THREE.Vector3()
  if (muzzleMesh) {
    muzzleMesh.getWorldPosition(gunTip)
  } else {
    gunTip.copy(camera.position)
  }

  let endPoint: THREE.Vector3
  let hitZombie: Zombie | undefined

  if (intersects.length > 0) {
    endPoint = intersects[0].point.clone()
    const hitObject = intersects[0].object
    hitZombie = aliveZombies.find((z) => {
      let found = false
      z.mesh!.traverse((c) => {
        if (c === hitObject) found = true
      })
      return found
    })
  } else {
    // Miss: extend tracer forward
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    endPoint = camera.position.clone().add(dir.multiplyScalar(50))
  }

  // Spawn tracer
  spawnTracer(state, effectsGroup, gunTip, endPoint)

  if (hitZombie) {
    killZombie(state, hitZombie, effectsGroup, endPoint)
    onKill(++state.kills)
  } else {
    // Small dust puff at miss point (if reasonably close)
    if (endPoint.distanceTo(camera.position) < 40) {
      spawnImpactPuff(state, effectsGroup, endPoint)
    }
  }
}

function spawnTracer(
  state: any,
  effectsGroup: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3
) {
  const dir = new THREE.Vector3().subVectors(to, from)
  const len = dir.length()
  if (len < 0.1) return
  const geo = new THREE.CylinderGeometry(0.025, 0.025, len, 6)
  const mat = new THREE.MeshBasicMaterial({
    color: '#fff2a8',
    transparent: true,
    opacity: 1,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.copy(from).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  )
  effectsGroup.add(mesh)
  state.tracers.push({
    mesh,
    startTime: performance.now(),
    duration: 0.09,
  })
}

function killZombie(
  state: any,
  zombie: Zombie,
  effectsGroup: THREE.Group,
  hitPoint: THREE.Vector3
) {
  zombie.isDying = true
  zombie.deathStartTime = performance.now()

  // Blood burst at hit point
  const count = 14
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.07 + Math.random() * 0.05, 6, 6)
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? '#8b0000' : '#b71c1c',
      transparent: true,
      opacity: 1,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(hitPoint)
    effectsGroup.add(mesh)

    const theta = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 4
    const vy = 2 + Math.random() * 3
    const vel = new THREE.Vector3(
      Math.cos(theta) * speed,
      vy,
      Math.sin(theta) * speed
    )

    state.particles.push({
      mesh,
      vel,
      life: 0.7 + Math.random() * 0.3,
      maxLife: 1.0,
    })
  }
}

function spawnImpactPuff(
  state: any,
  effectsGroup: THREE.Group,
  hitPoint: THREE.Vector3
) {
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.SphereGeometry(0.05, 5, 5)
    const mat = new THREE.MeshBasicMaterial({
      color: '#aaaaaa',
      transparent: true,
      opacity: 0.8,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(hitPoint)
    effectsGroup.add(mesh)
    const theta = Math.random() * Math.PI * 2
    const vel = new THREE.Vector3(
      Math.cos(theta) * 1.5,
      1 + Math.random(),
      Math.sin(theta) * 1.5
    )
    state.particles.push({
      mesh,
      vel,
      life: 0.4,
      maxLife: 0.4,
    })
  }
}

function spawnZombie(state: any, group: THREE.Group | null, angle: number, distance: number) {
  if (!group) return

  const position = new THREE.Vector3(
    state.playerPos.x + Math.cos(angle) * distance,
    0,
    state.playerPos.z + Math.sin(angle) * distance
  )

  const zombie: Zombie = {
    id: ++state.zombieCounter,
    position: position.clone(),
    health: 1,
    speed: state.zombieSpeed * (0.8 + Math.random() * 0.4),
  }

  const zombieGroup = new THREE.Group()

  const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2)
  const legMat = new THREE.MeshStandardMaterial({ color: '#3a5a3a', roughness: 0.8 })
  const leftLeg = new THREE.Mesh(legGeo, legMat)
  leftLeg.position.set(-0.15, 0.3, 0)
  leftLeg.castShadow = true
  zombieGroup.add(leftLeg)
  const rightLeg = new THREE.Mesh(legGeo, legMat)
  rightLeg.position.set(0.15, 0.3, 0)
  rightLeg.castShadow = true
  zombieGroup.add(rightLeg)

  const bodyGeo = new THREE.BoxGeometry(0.55, 0.6, 0.35)
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#5a7c4a', roughness: 0.8 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 0.9
  body.castShadow = true
  zombieGroup.add(body)

  const headGeo = new THREE.SphereGeometry(0.3, 16, 16)
  const headMat = new THREE.MeshStandardMaterial({ color: '#7a9c6a', roughness: 0.8 })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 1.45
  head.castShadow = true
  head.userData.isHead = true
  zombieGroup.add(head)

  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8)
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff0000' })
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
  leftEye.position.set(-0.1, 1.48, 0.25)
  zombieGroup.add(leftEye)
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
  rightEye.position.set(0.1, 1.48, 0.25)
  zombieGroup.add(rightEye)

  const mouthGeo = new THREE.BoxGeometry(0.18, 0.05, 0.05)
  const mouthMat = new THREE.MeshBasicMaterial({ color: '#1a1a1a' })
  const mouth = new THREE.Mesh(mouthGeo, mouthMat)
  mouth.position.set(0, 1.32, 0.28)
  zombieGroup.add(mouth)

  const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.2)
  const armMat = new THREE.MeshStandardMaterial({ color: '#5a7c4a', roughness: 0.8 })
  const leftArm = new THREE.Mesh(armGeo, armMat)
  leftArm.position.set(-0.4, 0.95, 0.3)
  leftArm.rotation.x = -0.8
  leftArm.castShadow = true
  zombieGroup.add(leftArm)
  const rightArm = new THREE.Mesh(armGeo, armMat)
  rightArm.position.set(0.4, 0.95, 0.3)
  rightArm.rotation.x = -0.8
  rightArm.castShadow = true
  zombieGroup.add(rightArm)

  zombieGroup.position.copy(position)
  zombie.mesh = zombieGroup

  group.add(zombieGroup)
  state.zombies.push(zombie)
}
