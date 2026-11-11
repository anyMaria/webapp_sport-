import { useEffect, useRef, useState } from 'react'
import { createYTPlayer, type YTPlayer } from './youtube'
import s from './video.module.css'

export interface LoopYTProps {
  videoId: string
  startSec: number
  endSec: number
  paused: boolean
  muted: boolean
}

/** Lecteur YouTube en séance : visible, jamais recouvert. Boucle sur l'extrait par seekTo, position lue toutes les 250 ms. */
export function LoopYT({ videoId, startSec, endSec, paused, muted }: LoopYTProps) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [error, setError] = useState<string | null>(() => (navigator.onLine ? null : 'Pas de réseau : cet exercice YouTube ne peut pas se lire.'))
  const end = Math.max(endSec, startSec + 1)

  useEffect(() => {
    if (error || !host.current) return
    let alive = true
    createYTPlayer(host.current, videoId, startSec)
      .then((p) => { if (alive) { player.current = p } else p.destroy() })
      .catch((e: Error) => alive && setError(e.message))
    return () => { alive = false; player.current?.destroy(); player.current = null }
    // Le lecteur est créé une fois par exercice ; start/end sont lus par la boucle ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = player.current
      if (!p) return
      try {
        if (muted) p.mute(); else p.unMute()
        if (paused) { p.pauseVideo(); return }
        p.playVideo()
        const t = p.getCurrentTime()
        if (t >= end - 0.3 || t < startSec - 1) p.seekTo(startSec, true)
      } catch { /* lecteur pas prêt */ }
    }, 250)
    return () => window.clearInterval(id)
  }, [paused, muted, startSec, end])

  if (error) return <div className={s.ytError} role="alert">{error}<br />Touche « Suivant » pour passer cet exercice.</div>
  return <div ref={host} className={s.yt} />
}
