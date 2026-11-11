import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { formatTime, type Segment } from './segments'
import c from './import.module.css'

interface Props {
  segs: Segment[]
  duration: number
  pos: number
  selId: string
  /** Coupe sélectionnée : celle entre le segment de ce rang et le suivant. */
  cutSel: number | null
  /** Lecture en cours : la frise suit la tête de lecture. */
  playing: boolean
  /** Toucher un bloc, ou glisser sur la règle : déplace la lecture. */
  onSeek: (sec: number) => void
  onSelectCut: (index: number | null) => void
  /** Début du glissement d'une coupe (l'écran met la lecture en pause). */
  onCutGrab: (index: number) => void
  onMoveCut: (index: number, sec: number) => void
  children?: ReactNode
}

const ZOOMS = [1, 2, 4, 8, 16, 32]
const TICKS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
/** Demi-largeur de la zone où l'on attrape une coupe (52 px en tout), réduite quand deux coupes sont proches. */
const GRAB = 26
const sec1 = (t: number) => `${t.toFixed(1).replace('.', ',')} s`

/**
 * Frise de toute la vidéo. En haut, la règle : on y glisse le doigt pour se déplacer dans la vidéo.
 * En dessous, les exercices, séparés par des traits : chaque trait est une coupe qu'on attrape et qu'on glisse.
 */
export function Timeline({ segs, duration, pos, selId, cutSel, playing, onSeek, onSelectCut, onCutGrab, onMoveCut, children }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [dragCut, setDragCut] = useState<number | null>(null)
  const scrubbing = useRef(false)
  const drag = useRef<{ index: number; offset: number; startX: number; moved: boolean } | null>(null)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const innerW = width * zoom
  const pps = duration > 0 ? innerW / duration : 0
  const x = (t: number) => t * pps
  /** Instant sous le doigt, d'après la position réelle de la frise (défilement compris). */
  const timeAt = (clientX: number) => {
    const r = inner.current?.getBoundingClientRect()
    if (!r || !r.width || !duration) return 0
    return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration))
  }
  const maxZoom = ZOOMS.filter((z) => z === 1 || (width * z) / Math.max(1, duration) <= 120).pop() ?? 1
  const zoomTo = (z: number) => {
    setZoom(z)
    // Après le zoom, la tête de lecture reste au milieu de la fenêtre.
    requestAnimationFrame(() => { const el = scroller.current; if (el) el.scrollLeft = (pos / Math.max(0.001, duration)) * el.clientWidth * z - el.clientWidth / 2 })
  }

  // Pendant la lecture, la frise zoomée défile pour garder la tête de lecture à l'écran.
  useEffect(() => {
    const el = scroller.current
    if (!el || zoom === 1 || !playing || scrubbing.current || drag.current) return
    const px = pos * pps
    if (px < el.scrollLeft + 24 || px > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = px - el.clientWidth * 0.25
  }, [pos, pps, zoom, playing])

  const tick = TICKS.find((s) => s * pps >= 68) ?? TICKS[TICKS.length - 1]!
  const ticks: number[] = []
  if (pps > 0) for (let t = 0; t <= duration + 1e-6; t += tick) ticks.push(Math.round(t * 10) / 10)

  const cuts = segs.slice(0, -1).map((s, i) => ({ index: i, t: s.endSec, verify: !!s.verify }))
  const zone = (i: number) => {
    const here = x(cuts[i]!.t)
    const left = Math.min(GRAB, i > 0 ? (here - x(cuts[i - 1]!.t)) / 2 : GRAB)
    const right = Math.min(GRAB, i < cuts.length - 1 ? (x(cuts[i + 1]!.t) - here) / 2 : GRAB)
    return { left: here - left, width: left + right, line: left }
  }

  return (
    <div className={c.timelineBox}>
      <div ref={scroller} className={c.scroller}>
        <div ref={inner} className={c.tlInner} style={{ width: `${zoom * 100}%` }}>
          <div
            role="slider"
            tabIndex={0}
            className={c.ruler}
            aria-label="Position dans la vidéo"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={formatTime(pos)}
            onPointerDown={(e) => {
              if (!duration) return
              scrubbing.current = true
              e.currentTarget.setPointerCapture(e.pointerId)
              onSeek(timeAt(e.clientX))
            }}
            onPointerMove={(e) => { if (scrubbing.current) onSeek(timeAt(e.clientX)) }}
            onPointerUp={() => { scrubbing.current = false }}
            onPointerCancel={() => { scrubbing.current = false }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, pos - 1)) }
              if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(duration, pos + 1)) }
            }}
          >
            {ticks.map((t) => (
              <span key={t} className={c.tick} style={{ left: x(t) }}>{tick < 1 ? sec1(t) : formatTime(t)}</span>
            ))}
            <span className={c.knob} style={{ left: x(pos) }} aria-hidden="true" />
          </div>

          <div className={c.track} onClick={(e) => { if (duration) { onSelectCut(null); onSeek(timeAt(e.clientX)) } }}>
            {segs.map((s) => {
              const w = x(s.endSec - s.startSec)
              return (
                <div key={s.id} className={[c.seg, s.kept ? '' : c.segOff, s.id === selId ? c.segSel : ''].join(' ')} style={{ left: x(s.startSec), width: w }} aria-hidden="true">
                  {w >= 64 && <span className={c.segName}>{s.name}</span>}
                </div>
              )
            })}
            {cuts.map((cut, i) => {
              const z = zone(i)
              const active = dragCut === cut.index || cutSel === cut.index
              return (
                <button
                  key={segs[cut.index]!.id}
                  type="button"
                  role="slider"
                  className={[c.cutZone, cut.verify ? c.cutVerify : '', active ? c.cutOn : ''].join(' ')}
                  style={{ left: z.left, width: z.width }}
                  aria-label={`Coupe ${cut.index + 1}, entre ${segs[cut.index]!.name} et ${segs[cut.index + 1]!.name}${cut.verify ? ', à vérifier' : ''}`}
                  aria-valuemin={Math.round(segs[cut.index]!.startSec)}
                  aria-valuemax={Math.round(segs[cut.index + 1]!.endSec)}
                  aria-valuenow={Math.round(cut.t * 10) / 10}
                  aria-valuetext={sec1(cut.t)}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    const r = e.currentTarget.getBoundingClientRect()
                    drag.current = { index: cut.index, offset: e.clientX - (r.left + z.line), startX: e.clientX, moved: false }
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current
                    if (!d) return
                    if (!d.moved) {
                      if (Math.abs(e.clientX - d.startX) < 4) return
                      d.moved = true
                      setDragCut(d.index)
                      onCutGrab(d.index)
                    }
                    onMoveCut(d.index, timeAt(e.clientX - d.offset))
                  }}
                  onPointerUp={() => {
                    const d = drag.current
                    drag.current = null
                    setDragCut(null)
                    if (d && !d.moved) onSelectCut(d.index)
                  }}
                  onPointerCancel={() => { drag.current = null; setDragCut(null) }}
                  onKeyDown={(e) => {
                    const by = e.shiftKey ? 1 : 0.1
                    if (e.key === 'ArrowLeft') { e.preventDefault(); onSelectCut(cut.index); onMoveCut(cut.index, cut.t - by) }
                    if (e.key === 'ArrowRight') { e.preventDefault(); onSelectCut(cut.index); onMoveCut(cut.index, cut.t + by) }
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCut(cut.index) }
                  }}
                >
                  <span className={c.cutLine} style={{ left: z.line }} />
                  <span className={c.cutGrip} style={{ left: z.line }} />
                  {dragCut === cut.index && <span className={c.cutBubble} style={{ left: z.line }}>{sec1(cut.t)}</span>}
                </button>
              )
            })}
          </div>
          <div className={c.head} style={{ left: x(pos) }} aria-hidden="true" />
        </div>
      </div>

      <div className={c.times}>
        <span className={c.now}>{sec1(pos)} / {formatTime(duration)}</span>
        <div className={c.legend}>
          <span><span className={c.dot} style={{ background: 'var(--effort)' }} />Gardé</span>
          <span><span className={c.dot} style={{ background: 'var(--line)' }} />Retiré</span>
          {cuts.some((k) => k.verify) && <span><span className={c.dash} />Coupe à vérifier</span>}
        </div>
        <div className={c.zoom} role="group" aria-label="Zoom de la frise">
          <button type="button" className={c.zoomBtn} aria-label="Dézoomer la frise" disabled={zoom <= 1} onClick={() => zoomTo(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)]!)}><ZoomOut size={20} aria-hidden="true" /></button>
          <button type="button" className={c.zoomBtn} aria-label="Zoomer la frise" disabled={zoom >= maxZoom} onClick={() => zoomTo(ZOOMS[ZOOMS.indexOf(zoom) + 1] ?? zoom)}><ZoomIn size={20} aria-hidden="true" /></button>
        </div>
      </div>
      {children}
    </div>
  )
}
