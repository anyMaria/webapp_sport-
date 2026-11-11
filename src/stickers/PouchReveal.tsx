import { useCallback, useEffect, useRef, useState } from 'react'
import { playBeep, unlockAudio } from '../audio/beep'
import { SERIES, artUrl, baseIdOf, isShiny, stickerById } from './catalog'
import s from './reveal.module.css'

const HOLD_MS = 1200
const TILT_MAX = 14

type Stage = 'sealed' | 'opening' | 'revealed' | 'pasting'

export interface PouchRevealProps {
  stickerId: string
  /** Volume du carillon (le même que les bips). */
  volume: number
  /** Appelé quand le sticker est collé (ou la fenêtre fermée après l'ouverture). */
  onDone: (opened: boolean) => void
  /** Position de l'emplacement sur la planche, pour l'animation de collage. */
  slotRect?: () => DOMRect | null
  /** Agrandissement d'un sticker déjà obtenu : pas de pochette, le miroitement se rejoue. */
  zoomOnly?: boolean
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Pochette scellée → appui maintenu 1,2 s → ouverture → apparition → miroitement → collage. 6 secondes au plus après le geste. */
export function PouchReveal({ stickerId, volume, onDone, slotRect, zoomOnly }: PouchRevealProps) {
  const [stage, setStage] = useState<Stage>(zoomOnly ? 'revealed' : 'sealed')
  const stageRef = useRef<Stage>(zoomOnly ? 'revealed' : 'sealed')
  const goto = (st: Stage) => { stageRef.current = st; setStage(st) }

  const pouch = useRef<HTMLButtonElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const topHalf = useRef<HTMLDivElement>(null)
  const botHalf = useRef<HTMLDivElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const appear = useRef<HTMLDivElement>(null)
  const tilt = useRef<HTMLDivElement>(null)
  const rainbow = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const holdRaf = useRef(0)
  const progress = useRef(0)
  const holdStart = useRef<number | null>(null)
  const orientation = useRef(false)

  const def = stickerById.get(baseIdOf(stickerId))
  const shiny = isShiny(stickerId)
  const rare = def?.rarity === 'rare'
  const url = artUrl(stickerId)
  const seriesName = SERIES.find((x) => x.id === def?.series)?.name ?? ''

  const chime = useCallback(() => {
    void playBeep(volume, { freq: 660, durationSec: 0.2 })
    window.setTimeout(() => void playBeep(volume, { freq: 990, durationSec: 0.35 }), 160)
  }, [volume])

  // Gerbe de particules : canvas 2D, 20 à 40 particules.
  const burst = useCallback(() => {
    const cv = canvas.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = cv.clientWidth * dpr
    cv.height = cv.clientHeight * dpr
    const g = cv.getContext('2d')!
    g.scale(dpr, dpr)
    const colors = ['#6FE0CC', '#FFB27A', '#F2F5F1', '#FFD479']
    const n = 24 + Math.floor(Math.random() * 14)
    const ps = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2
      const v = 220 + Math.random() * 380
      return { x: cv.clientWidth / 2, y: cv.clientHeight / 2 - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, r: 3 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)]! }
    })
    const t0 = performance.now()
    let last = t0
    const frame = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const life = (now - t0) / 1000
      g.clearRect(0, 0, cv.clientWidth, cv.clientHeight)
      for (const p of ps) {
        p.vy += 900 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        g.globalAlpha = Math.max(0, 1 - life / 1.1)
        g.fillStyle = p.c
        g.beginPath()
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        g.fill()
      }
      if (life < 1.1) requestAnimationFrame(frame)
      else g.clearRect(0, 0, cv.clientWidth, cv.clientHeight)
    }
    requestAnimationFrame(frame)
  }, [])

  const open = useCallback(() => {
    if (stageRef.current !== 'sealed') return
    cancelAnimationFrame(holdRaf.current)
    goto('opening')
    chime()
    if (reduced()) { window.setTimeout(() => goto('revealed'), 50); return }
    flash.current?.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { duration: 280, easing: 'ease-out' })
    topHalf.current?.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-30px,-130%) rotate(-14deg)' }], { duration: 520, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' })
    botHalf.current?.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(30px,130%) rotate(12deg)' }], { duration: 520, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' })
    glow.current?.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 500, fill: 'forwards' })
    burst()
    window.setTimeout(() => goto('revealed'), 480)
  }, [burst, chime])

  // Appui maintenu : la pochette tremble de plus en plus, une lueur monte. Relâcher trop tôt la fait retomber doucement.
  const loopRef = useRef<FrameRequestCallback>(() => undefined)
  const loop = useCallback((now: number) => {
    const held = holdStart.current !== null
    if (held) progress.current = Math.min(1, (now - holdStart.current!) / HOLD_MS)
    else progress.current = Math.max(0, progress.current - 0.04)
    const p = progress.current
    const amp = p * p * 9
    if (pouch.current) pouch.current.style.transform = `translate(${Math.sin(now / 28) * amp}px, ${Math.cos(now / 33) * amp * 0.6}px) rotate(${Math.sin(now / 37) * p * 3}deg) scale(${1 + p * 0.06})`
    if (glow.current) glow.current.style.opacity = String(p * 0.85)
    if (held && p >= 1) { holdStart.current = null; open(); return }
    if (held || p > 0) holdRaf.current = requestAnimationFrame((t) => loopRef.current(t))
  }, [open])
  useEffect(() => { loopRef.current = loop }, [loop])

  const startHold = (e: React.PointerEvent) => {
    if (stageRef.current !== 'sealed') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    holdStart.current = performance.now()
    cancelAnimationFrame(holdRaf.current)
    holdRaf.current = requestAnimationFrame(loop)
  }
  const endHold = () => { if (holdStart.current !== null) { holdStart.current = null; holdRaf.current = requestAnimationFrame(loop) } }

  // Apparition : le sticker monte en tournant sur son axe vertical, avec un effet ressort.
  useEffect(() => {
    if (stage !== 'revealed') return
    if (reduced()) return
    appear.current?.animate(
      [
        { transform: 'translateY(140px) rotateY(0deg) scale(0.3)', opacity: 0 },
        { transform: 'translateY(-14px) rotateY(330deg) scale(1.14)', opacity: 1, offset: 0.7 },
        { transform: 'translateY(0) rotateY(360deg) scale(1)', opacity: 1 },
      ],
      { duration: 950, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
    )
  }, [stage])

  // Miroitement : le sticker suit le doigt (14° au plus) et son reflet se déplace.
  const setTilt = useCallback((nx: number, ny: number) => {
    const x = Math.max(-1, Math.min(1, nx))
    const y = Math.max(-1, Math.min(1, ny))
    if (tilt.current) tilt.current.style.transform = `rotateY(${x * TILT_MAX}deg) rotateX(${-y * TILT_MAX}deg)`
    if (rainbow.current) rainbow.current.style.transform = `translate(${-x * 38}%, ${-y * 38}%)`
    if (band.current) band.current.style.transform = `translateX(${x * 260}%) rotate(20deg)`
  }, [])
  const onMove = (e: React.PointerEvent) => {
    if (stageRef.current !== 'revealed' || !area.current) return
    const r = area.current.getBoundingClientRect()
    setTilt(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2)
  }
  const onLeave = () => {
    if (!tilt.current) return
    tilt.current.animate([{ transform: tilt.current.style.transform || 'none' }, { transform: 'rotateY(0) rotateX(0)' }], { duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    setTilt(0, 0)
  }

  // Orientation de l'iPad (facultatif) : permission demandée sur la touche « Ouvrir ».
  const askOrientation = async () => {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
    try {
      const ok = DOE?.requestPermission ? (await DOE.requestPermission()) === 'granted' : 'DeviceOrientationEvent' in window
      orientation.current = ok
    } catch { orientation.current = false }
  }
  useEffect(() => {
    const on = (e: DeviceOrientationEvent) => {
      if (!orientation.current || stageRef.current !== 'revealed') return
      setTilt((e.gamma ?? 0) / 30, ((e.beta ?? 45) - 45) / 30)
    }
    window.addEventListener('deviceorientation', on)
    return () => window.removeEventListener('deviceorientation', on)
  }, [setTilt])

  const paste = () => {
    if (stageRef.current !== 'revealed') return
    goto('pasting')
    const el = appear.current
    const target = slotRect?.()
    if (!el || reduced()) { onDone(true); return }
    const from = el.getBoundingClientRect()
    let anim: Animation
    if (target) {
      const dx = target.left + target.width / 2 - (from.left + from.width / 2)
      const dy = target.top + target.height / 2 - (from.top + from.height / 2)
      const k = target.width / from.width
      anim = el.animate(
        [
          { transform: 'translate(0,0) scale(1)' },
          { transform: `translate(${dx}px, ${dy}px) scale(${k})`, offset: 0.78 },
          { transform: `translate(${dx}px, ${dy}px) scale(${k * 1.12}, ${k * 0.86})`, offset: 0.9 },
          { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
        ],
        { duration: 650, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' },
      )
    } else {
      anim = el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'translate(40%, 60%) scale(0.2)', opacity: 0 }], { duration: 450, easing: 'ease-in', fill: 'forwards' })
    }
    anim.onfinish = () => onDone(true)
  }

  const close = () => onDone(!zoomOnly && (stageRef.current === 'revealed' || stageRef.current === 'pasting'))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => cancelAnimationFrame(holdRaf.current), [])

  const sealed = stage === 'sealed' || stage === 'opening'

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Révélation du sticker" onPointerMove={onMove} onPointerLeave={onLeave} onPointerUp={onLeave}>
      <canvas ref={canvas} className={s.particles} aria-hidden="true" />
      <div ref={flash} className={s.flash} aria-hidden="true" />
      <button type="button" className={s.skip} onClick={() => (sealed ? (stageRef.current === 'sealed' && goto('revealed')) : close())}>{sealed ? 'Passer' : 'Fermer'}</button>

      <div ref={area} className={s.stage}>
        {sealed && (
          <>
            <div ref={glow} className={s.glow} aria-hidden="true" />
            <button ref={pouch} type="button" className={[s.pouch, stage === 'sealed' ? s.float : ''].join(' ')} aria-label="Pochette scellée : maintiens pour ouvrir" onPointerDown={startHold} onPointerUp={endHold} onPointerCancel={endHold} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void askOrientation(); open() } }}>
              <div ref={topHalf} className={[s.pouchHalf, s.pouchTop].join(' ')}><PouchSvg /></div>
              <div ref={botHalf} className={[s.pouchHalf, s.pouchBottom].join(' ')}><PouchSvg /></div>
            </button>
          </>
        )}
        {!sealed && (
          <div ref={appear} className={[s.appear, reduced() ? s.fade : ''].join(' ')}>
            {rare && <div className={s.halo} aria-hidden="true" />}
            <div ref={tilt} className={[s.tilt, shiny ? s.shiny : ''].join(' ')}>
              <img className={s.art} src={url} alt={def?.name ?? 'Sticker'} draggable={false} />
              <div className={s.holo} style={{ ['--mask' as string]: `url("${url}")`, opacity: rare || shiny ? 1 : 0.6 }} aria-hidden="true">
                <div ref={rainbow} className={s.rainbow} />
                <div className={s.shine}><div ref={band} className={s.shineBand} /></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {sealed ? (
        <>
          <p className={s.msg}>Semaine validée. Maintiens pour ouvrir.</p>
          <button type="button" className={[s.cta, s.ctaGhost].join(' ')} disabled={stage !== 'sealed'} onClick={() => { void unlockAudio(); void askOrientation(); open() }}>Ouvrir</button>
        </>
      ) : (
        <>
          <div className={s.info} aria-live="polite">
            <span className={s.name}>{def?.name}{shiny ? ' (brillant)' : ''}</span>
            <span className={s.series}>{seriesName}{rare ? ' · rare' : ''}</span>
          </div>
          {!zoomOnly && <button type="button" className={s.cta} disabled={stage === 'pasting'} onClick={paste}>Coller dans ma collection</button>}
        </>
      )}
    </div>
  )
}

/** Pochette en papier métallisé : aplats, sertissage crénelé en haut et en bas, reflet qui la traverse. */
function PouchSvg() {
  const zig = (y: number, dir: number) => Array.from({ length: 16 }, (_, i) => `${40 + i * 20},${y + (i % 2 ? dir * 10 : 0)}`).join(' ')
  return (
    <>
    <svg className={s.pouchSvg} viewBox="30 56 340 288" aria-hidden="true">
      <polygon points={`40,70 ${zig(70, -1)} 360,70 360,330 ${zig(330, 1).split(' ').reverse().join(' ')} 40,330`} fill="#C9D3CE" stroke="#F2F5F1" strokeWidth="8" strokeLinejoin="round" />
      <rect x="40" y="100" width="320" height="200" fill="#A9B6B0" />
      <polygon points="200,130 214,176 262,176 224,204 238,250 200,222 162,250 176,204 138,176 186,176" fill="#FFB27A" stroke="#F2F5F1" strokeWidth="6" strokeLinejoin="round" />
    </svg>
    <div className={s.bandBox}><div className={s.band} /></div>
    </>
  )
}
