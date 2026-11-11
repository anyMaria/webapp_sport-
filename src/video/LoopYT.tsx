import { useEffect, useRef, useState } from 'react'
import { createYTPlayer, type YTPlayer } from './youtube'
import s from './video.module.css'

export interface LoopYTProps {
  videoId: string
  startSec: number
  endSec: number
  paused: boolean
  muted: boolean
  /** Prévenu à chaque changement : la vidéo est-elle vraiment en lecture ? (le minuteur de séance attend tant qu'elle ne l'est pas) */
  onPlaying?: (playing: boolean) => void
}

const PLAYING = 1

/**
 * Lecteur YouTube : visible, jamais recouvert. Un seul lecteur par vidéo : quand l'extrait change, il saute au nouveau début
 * au lieu de se recharger. Boucle sur l'extrait par seekTo, position lue toutes les 250 ms.
 * La lecture démarre son coupé (Safari refuse sinon une lecture qui n'a pas été touchée) ; le son est rétabli une fois la vidéo partie.
 */
export function LoopYT({ videoId, startSec, endSec, paused, muted, onPlaying }: LoopYTProps) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [error, setError] = useState<string | null>(() => (navigator.onLine ? null : 'Pas de réseau : cet exercice YouTube ne peut pas se lire.'))
  const end = Math.max(endSec, startSec + 1)
  const notify = useRef(onPlaying)
  useEffect(() => { notify.current = onPlaying }, [onPlaying])
  const lastPlaying = useRef<boolean | null>(null)
  /** Safari a remis en pause la vidéo quand on a rétabli le son : on la laisse muette. */
  const soundBlocked = useRef(false)
  const unmutedAt = useRef(0)

  useEffect(() => {
    if (error || !host.current) return
    let alive = true
    createYTPlayer(host.current, videoId, startSec)
      .then((p) => { if (alive) { player.current = p } else p.destroy() })
      .catch((e: Error) => alive && setError(e.message))
    return () => { alive = false; player.current?.destroy(); player.current = null }
    // Le lecteur est créé une fois par vidéo ; start/end sont lus ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  // Nouvel extrait sur la même vidéo : on saute directement à son début.
  useEffect(() => {
    try { player.current?.seekTo(startSec, true) } catch { /* lecteur pas prêt */ }
  }, [startSec])

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = player.current
      let playing = false
      if (p) {
        try {
          const state = p.getPlayerState()
          playing = state === PLAYING
          if (paused) p.pauseVideo()
          else {
            if (!playing) {
              // Pause juste après avoir rétabli le son : Safari l'a refusé, on reste muet.
              if (unmutedAt.current && performance.now() - unmutedAt.current < 1500 && state === 2) soundBlocked.current = true
              unmutedAt.current = 0
              p.mute()
              p.playVideo()
            } else if (!muted && !soundBlocked.current) {
              if (!unmutedAt.current) { p.unMute(); unmutedAt.current = performance.now() }
            } else p.mute()
            const t = p.getCurrentTime()
            if (t >= end - 0.3 || t < startSec - 1) p.seekTo(startSec, true)
          }
        } catch { /* lecteur pas prêt */ }
      }
      if (playing !== lastPlaying.current) { lastPlaying.current = playing; notify.current?.(playing) }
    }, 250)
    return () => window.clearInterval(id)
  }, [paused, muted, startSec, end])

  useEffect(() => { if (muted) unmutedAt.current = 0 }, [muted])

  if (error) return <div className={s.ytError} role="alert">{error}<br />Touche « Suivant » pour passer cet exercice.</div>
  return <div ref={host} className={s.yt} />
}
