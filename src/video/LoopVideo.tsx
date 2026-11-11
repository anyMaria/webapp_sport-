import { useEffect, useRef } from 'react'
import s from './video.module.css'

export interface LoopVideoProps {
  url: string
  startSec: number
  endSec: number
  /** Cet extrait est celui qu'on regarde. Sinon il reste préchargé, au début de l'extrait. */
  active: boolean
  paused: boolean
  muted: boolean
  dimmed?: boolean
}

/** Lecture en boucle sur un extrait. Position surveillée à chaque image : retour à startSec juste avant endSec. */
export function LoopVideo({ url, startSec, endSec, active, paused, muted, dimmed }: LoopVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const end = Math.max(endSec, startSec + 1)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const toStart = () => { try { v.currentTime = startSec } catch { /* métadonnées pas prêtes */ } }
    if (!active) {
      v.pause()
      toStart()
      return
    }
    if (paused) {
      v.pause()
      return
    }
    if (v.currentTime < startSec || v.currentTime >= end) toStart()
    void v.play().catch(() => undefined)
    let stop = false
    let handle = 0
    const useRVFC = typeof v.requestVideoFrameCallback === 'function'
    const check = () => {
      if (stop) return
      if (v.currentTime >= end - 0.05) toStart()
      handle = useRVFC ? v.requestVideoFrameCallback(check) : requestAnimationFrame(check)
    }
    handle = useRVFC ? v.requestVideoFrameCallback(check) : requestAnimationFrame(check)
    // Fichier plus court que l'extrait demandé : on reboucle à la fin.
    const onEnded = () => { toStart(); void v.play().catch(() => undefined) }
    v.addEventListener('ended', onEnded)
    return () => {
      stop = true
      v.removeEventListener('ended', onEnded)
      if (useRVFC) v.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [active, paused, startSec, end])

  return (
    <video
      ref={ref}
      className={[s.video, active ? '' : s.hidden, dimmed ? s.dimmed : ''].join(' ')}
      src={url}
      muted={muted}
      playsInline
      preload="auto"
      onLoadedMetadata={(e) => { e.currentTarget.currentTime = startSec }}
      aria-hidden={!active}
    />
  )
}
