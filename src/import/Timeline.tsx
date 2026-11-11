import { useRef } from 'react'
import { formatTime, type Segment } from './segments'
import c from './import.module.css'

interface Props {
  segs: Segment[]
  duration: number
  pos: number
  selId: string
  /** Durée d'un appui sur une flèche du clavier. */
  step: number
  onSeek: (sec: number) => void
}

/** Frise de toute la vidéo : la tête de lecture avance pendant la lecture, un toucher ou un glissement déplace la lecture. */
export function Timeline({ segs, duration, pos, selId, step, onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = (t: number) => `${duration ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0}%`
  const at = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || !r.width) return 0
    return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration))
  }

  return (
    <div className={c.timelineBox}>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        className={c.track}
        aria-label="Position dans la vidéo"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={formatTime(pos)}
        onPointerDown={(e) => {
          if (!duration) return
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          onSeek(at(e.clientX))
        }}
        onPointerMove={(e) => { if (dragging.current) onSeek(at(e.clientX)) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, pos - step)) }
          if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(duration, pos + step)) }
        }}
      >
        {segs.map((x) => (
          <div
            key={x.id}
            className={[c.seg, !x.kept ? c.segOff : x.verify ? c.segVerify : '', x.id === selId ? c.segSel : ''].join(' ')}
            style={{ left: pct(x.startSec), width: pct(x.endSec - x.startSec) }}
          />
        ))}
        <div className={c.head} style={{ left: pct(pos) }} />
      </div>
      <div className={c.times}>
        <span>{pos.toFixed(1)} s</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className={c.legend}>
        <span><span className={c.dot} style={{ background: 'var(--effort)' }} />Gardé</span>
        <span><span className={c.dot} style={{ background: 'var(--transition)' }} />À vérifier</span>
        <span><span className={c.dot} style={{ background: 'var(--line)' }} />Retiré</span>
      </div>
    </div>
  )
}
