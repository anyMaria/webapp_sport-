import { useEffect, useRef, useState } from 'react'
import { Btn, Field, Log, TestCard, useLog } from './ui'
import { createYTPlayer, parseYouTubeId, type YTPlayer } from './youtube'
import s from './lab.module.css'

const stats = (xs: number[]) =>
  xs.length ? `moy ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0)} ms, max ${Math.max(...xs).toFixed(0)} ms (${xs.length} boucles)` : 'aucune boucle'

export function T6Loop() {
  const { lines, add, clear } = useLog()
  const [src, setSrc] = useState<string | null>(null)
  const [start, setStart] = useState(2)
  const [end, setEnd] = useState(6)
  const [ytInput, setYtInput] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const stopLocal = useRef<(() => void) | null>(null)
  const ytHost = useRef<HTMLDivElement>(null)
  const ytPlayer = useRef<YTPlayer | null>(null)
  const ytTimer = useRef<number | null>(null)

  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])
  useEffect(() => () => {
    stopLocal.current?.()
    if (ytTimer.current) window.clearInterval(ytTimer.current)
    ytPlayer.current?.destroy()
  }, [])

  const runLocal = async () => {
    const v = video.current
    if (!v) { add('Choisis d’abord une vidéo.'); return }
    stopLocal.current?.()
    const delays: number[] = []
    let t0: number | null = null
    let cancelled = false
    let handle = 0
    const useRVFC = typeof v.requestVideoFrameCallback === 'function'
    add(`Boucle ${start}–${end} s. Mesure par ${useRVFC ? 'requestVideoFrameCallback' : 'événement seeked (rVFC absent)'}.`)
    v.currentTime = start
    await v.play().catch((e) => add(`play() refusé : ${(e as Error).message}`))

    const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (cancelled) return
      if (t0 !== null && meta.mediaTime < start + 1) {
        delays.push(performance.now() - t0)
        t0 = null
        if (delays.length % 5 === 0) add(`Retour au début : ${stats(delays)}`)
      }
      if (t0 === null && meta.mediaTime >= end - 0.05) {
        t0 = performance.now()
        v.currentTime = start
      }
      handle = v.requestVideoFrameCallback(onFrame)
    }
    const onSeeked = () => {
      if (t0 !== null) { delays.push(performance.now() - t0); t0 = null }
    }
    const raf = () => {
      if (cancelled) return
      if (t0 === null && v.currentTime >= end - 0.05) { t0 = performance.now(); v.currentTime = start }
      requestAnimationFrame(raf)
    }
    if (useRVFC) handle = v.requestVideoFrameCallback(onFrame)
    else { v.addEventListener('seeked', onSeeked); requestAnimationFrame(raf) }

    stopLocal.current = () => {
      cancelled = true
      if (useRVFC) v.cancelVideoFrameCallback(handle)
      v.removeEventListener('seeked', onSeeked)
      v.pause()
      add(`Arrêt. ${stats(delays)}. Critère : moins de 300 ms.`)
    }
  }

  const runYT = async () => {
    const id = parseYouTubeId(ytInput)
    if (!id || !ytHost.current) { add('Lien YouTube non reconnu.'); return }
    try {
      if (ytTimer.current) window.clearInterval(ytTimer.current)
      ytPlayer.current?.destroy()
      const p = await createYTPlayer(ytHost.current, id, start)
      ytPlayer.current = p
      p.playVideo()
      const delays: number[] = []
      let t0: number | null = null
      add(`YouTube : boucle ${start}–${end} s par seekTo, position lue toutes les 250 ms (précision ±250 ms).`)
      ytTimer.current = window.setInterval(() => {
        const t = p.getCurrentTime()
        if (t0 !== null && t >= start && t < start + 1.5) {
          delays.push(performance.now() - t0)
          t0 = null
          add(`Retour YouTube : ${delays[delays.length - 1]!.toFixed(0)} ms (${stats(delays)})`)
        }
        if (t0 === null && t >= end) { t0 = performance.now(); p.seekTo(start, true) }
      }, 250)
    } catch (e) {
      add((e as Error).message)
    }
  }

  const stopAll = () => {
    stopLocal.current?.()
    stopLocal.current = null
    if (ytTimer.current) window.clearInterval(ytTimer.current)
    ytTimer.current = null
    ytPlayer.current?.destroy()
    ytPlayer.current = null
  }

  return (
    <TestCard
      id="t6"
      num={6}
      title="Boucle sur un extrait"
      how="Choisis une vidéo locale, règle début et fin (en secondes), lance. Le journal donne le délai de retour au début à chaque boucle. Fais la même chose avec un lien YouTube."
      passIf="Le retour au début de l'extrait prend moins de 0,3 s en local. Noter le délai observé pour YouTube."
      planB="Fondu au noir court au moment de la boucle."
    >
      <div className={s.row}>
        <Field label="Vidéo locale">
          <input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSrc(URL.createObjectURL(f)) }} />
        </Field>
        <Field label="Début (s)">
          <input type="number" min={0} step={0.5} value={start} onChange={(e) => setStart(Number(e.target.value))} style={{ width: 90 }} />
        </Field>
        <Field label="Fin (s)">
          <input type="number" min={1} step={0.5} value={end} onChange={(e) => setEnd(Number(e.target.value))} style={{ width: 90 }} />
        </Field>
      </div>
      {src && <video ref={video} className={s.video} src={src} muted playsInline />}
      <div className={s.actions}>
        <Btn primary onClick={() => void runLocal()} disabled={!src}>Boucler le fichier local</Btn>
        <Btn onClick={stopAll}>Arrêter</Btn>
        <Btn onClick={clear}>Effacer</Btn>
      </div>
      <div className={s.row}>
        <Field label="Lien YouTube">
          <input value={ytInput} onChange={(e) => setYtInput(e.target.value)} placeholder="https://youtu.be/…" style={{ minWidth: 320 }} />
        </Field>
        <Btn primary onClick={() => void runYT()}>Boucler YouTube</Btn>
      </div>
      <div className={s.yt} ref={ytHost} />
      <Log lines={lines} />
    </TestCard>
  )
}
