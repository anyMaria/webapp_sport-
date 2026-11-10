import { useCallback, useEffect, useRef, useState } from 'react'
import { Btn, Log, TestCard, useLog } from './ui'
import s from './lab.module.css'

const GOAL_S = 300

export function T4WakeLock() {
  const { lines, add, clear } = useLog()
  const lock = useRef<WakeLockSentinel | null>(null)
  const startedAt = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const supported = 'wakeLock' in navigator

  const acquire = useCallback(async () => {
    try {
      lock.current = await navigator.wakeLock.request('screen')
      lock.current.addEventListener('release', () => add('Verrou relâché par le système.'))
      add('Verrou obtenu.')
    } catch (e) {
      add(`Refus du verrou : ${(e as Error).message}`)
    }
  }, [add])

  const stop = useCallback(async () => {
    startedAt.current = null
    setRunning(false)
    await lock.current?.release()
    lock.current = null
    add('Test arrêté.')
  }, [add])

  const start = async () => {
    startedAt.current = performance.now()
    setElapsed(0)
    setRunning(true)
    await acquire()
    add(`Ne touche plus l'écran. Attends ${GOAL_S / 60} minutes.`)
  }

  useEffect(() => {
    if (!running) return
    const onVis = () => {
      add(`Page ${document.visibilityState === 'visible' ? 'revenue au premier plan' : 'passée en arrière-plan'}.`)
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVis)
    const id = window.setInterval(() => {
      if (startedAt.current === null) return
      const sec = Math.floor((performance.now() - startedAt.current) / 1000)
      setElapsed(sec)
      if (sec === GOAL_S) add(`${GOAL_S / 60} minutes écoulées. L'écran est-il resté allumé ? Donne ton verdict.`)
    }, 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(id)
    }
  }, [running, acquire, add])

  useEffect(() => () => { void lock.current?.release() }, [])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <TestCard
      id="t4"
      num={4}
      title="Écran allumé"
      how="Dans l'app installée sur l'écran d'accueil, touche « Démarrer » puis ne touche plus rien pendant 5 minutes, Spotify en lecture. Réglage de veille de l'iPad : mets-le sur 2 minutes pour que le test soit parlant."
      passIf="L'écran reste allumé 5 minutes sans toucher."
      planB="La vidéo de l'exercice, toujours en lecture, maintient l'écran allumé."
    >
      {!supported && <p className={s.muted}>navigator.wakeLock absent sur cet appareil.</p>}
      <div className={s.actions}>
        <Btn primary onClick={start} disabled={!supported || running}>Démarrer</Btn>
        <Btn onClick={stop} disabled={!running}>Arrêter</Btn>
        <Btn onClick={clear}>Effacer</Btn>
        <span className={s.badge} aria-live="off">{mm}:{ss} / 05:00</span>
      </div>
      <Log lines={lines} />
    </TestCard>
  )
}
