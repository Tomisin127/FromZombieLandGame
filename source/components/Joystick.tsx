'use client'

import { useEffect, useRef, useState } from 'react'

export interface JoystickVector {
  x: number
  y: number
}

interface JoystickProps {
  movementRef: React.MutableRefObject<JoystickVector>
  disabled?: boolean
}

const MAX_DIST = 56 // px — how far the knob can travel from center

/**
 * Dynamic floating joystick.
 * - Invisible until the bottom-left touch zone is pressed
 * - Appears at the touch point and follows the finger
 * - Fades out on release
 * - Uses pointer capture on its own element so a second finger on the
 *   canvas continues to control the camera without interruption.
 */
export default function Joystick({ movementRef, disabled }: JoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const originRef = useRef({ x: 0, y: 0 })
  const [center, setCenter] = useState({ x: 0, y: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

  useEffect(() => {
    const zone = zoneRef.current
    if (!zone) return

    const update = (clientX: number, clientY: number) => {
      let dx = clientX - originRef.current.x
      let dy = clientY - originRef.current.y
      const d = Math.hypot(dx, dy)
      if (d > MAX_DIST) {
        dx = (dx / d) * MAX_DIST
        dy = (dy / d) * MAX_DIST
      }
      setKnob({ x: dx, y: dy })
      // Invert Y so joystick-up is "forward" in world
      movementRef.current = { x: dx / MAX_DIST, y: -dy / MAX_DIST }
    }

    const onDown = (e: PointerEvent) => {
      if (disabled) return
      if (pointerIdRef.current !== null) return
      pointerIdRef.current = e.pointerId
      originRef.current = { x: e.clientX, y: e.clientY }
      setCenter({ x: e.clientX, y: e.clientY })
      setKnob({ x: 0, y: 0 })
      setActive(true)
      try {
        zone.setPointerCapture(e.pointerId)
      } catch {}
      e.preventDefault()
      e.stopPropagation()
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return
      update(e.clientX, e.clientY)
      e.preventDefault()
    }

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return
      try {
        zone.releasePointerCapture(e.pointerId)
      } catch {}
      pointerIdRef.current = null
      setKnob({ x: 0, y: 0 })
      setActive(false)
      movementRef.current = { x: 0, y: 0 }
    }

    zone.addEventListener('pointerdown', onDown)
    zone.addEventListener('pointermove', onMove)
    zone.addEventListener('pointerup', onEnd)
    zone.addEventListener('pointercancel', onEnd)

    return () => {
      zone.removeEventListener('pointerdown', onDown)
      zone.removeEventListener('pointermove', onMove)
      zone.removeEventListener('pointerup', onEnd)
      zone.removeEventListener('pointercancel', onEnd)
    }
  }, [disabled, movementRef])

  return (
    <>
      {/* Invisible touch zone: bottom-left 45% width × 55% height */}
      <div
        ref={zoneRef}
        className="absolute bottom-0 left-0 z-20"
        style={{
          width: '45%',
          height: '55%',
          touchAction: 'none',
        }}
        aria-label="Movement zone"
      />

      {/* Subtle idle hint — barely visible marker of where to touch */}
      <div
        className="absolute bottom-5 left-5 z-10 pointer-events-none transition-opacity duration-200"
        style={{ opacity: active ? 0 : 0.35 }}
      >
        <div className="w-24 h-24 rounded-full border border-dashed border-[#d6ccb2]/30 flex items-center justify-center">
          <span
            className="text-[10px] text-[#d6ccb2]/50 tracking-[0.3em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            MOVE
          </span>
        </div>
      </div>

      {/* Floating active joystick — appears where the finger touched */}
      <div
        className="absolute z-20 pointer-events-none transition-opacity duration-150"
        style={{
          left: center.x,
          top: center.y,
          transform: 'translate(-50%, -50%)',
          opacity: active ? 1 : 0,
          visibility: active ? 'visible' : 'hidden',
        }}
      >
        {/* Base ring — ash with rust outline (zombie apocalypse feel) */}
        <div
          className="relative w-36 h-36 rounded-full border-2"
          style={{
            borderColor: '#a35124',
            backgroundColor: 'rgba(20, 16, 14, 0.55)',
            boxShadow: '0 0 0 1px rgba(122, 21, 21, 0.35) inset',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Inner cross hairs */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#d6ccb2]/40" />
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#d6ccb2]/10" />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#d6ccb2]/10" />
          {/* Knob */}
          <div
            className="absolute left-1/2 top-1/2 w-16 h-16 rounded-full border-2"
            style={{
              borderColor: '#d6ccb2',
              backgroundColor: '#7a1515',
              transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
              boxShadow:
                '0 4px 12px rgba(0,0,0,0.6), 0 0 0 3px rgba(163, 81, 36, 0.25)',
            }}
          />
        </div>
      </div>
    </>
  )
}
