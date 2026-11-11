import { useEffect, useRef, useState } from 'react'
import { Btn, Field, fmtBytes, fmtSec, Log, TestCard, useLog } from './ui'
import s from './lab.module.css'

const FLAG = 'lab:t7:running'
const GOAL_MS = 90_000

function nextEvent(el: HTMLMediaElement, ev: string) {
  return new Promise<void>((res, rej) => {
    const ok = () => { el.removeEventListener('error', ko); res() }
    const ko = () => { el.removeEventListener(ev, ok); rej(new Error('Erreur de lecture vidéo')) }
    el.addEventListener(ev, ok, { once: true })
    el.addEventListener('error', ko, { once: true })
  })
}

export function T7Analysis() {
  const { lines, add, clear } = useLog()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const cancel = useRef(false)
  const preview = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(FLAG)) {
        add('ATTENTION : la page s’est rechargée pendant une analyse précédente. Résultat : échec.')
        sessionStorage.removeItem(FLAG)
      }
    } catch { /* ignoré */ }
  }, [add])

  const frames = async (f: File) => {
    const url = URL.createObjectURL(f)
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
    try {
      await nextEvent(v, 'loadedmetadata')
      const dur = v.duration
      const step = dur > 600 ? 1 : 0.5
      const total = Math.floor(dur / step)
      add(`Images : durée ${dur.toFixed(0)} s, un saut toutes les ${step} s (${total} images).`)
      const c = document.createElement('canvas'); c.width = 64; c.height = 36
      const g = c.getContext('2d', { willReadFrequently: true })!
      const t0 = performance.now()
      let prev: number[] | null = null
      let cuts = 0
      for (let i = 0; i < total; i++) {
        if (cancel.current) { add('Annulé.'); return null }
        v.currentTime = i * step
        await nextEvent(v, 'seeked')
        g.drawImage(v, 0, 0, 64, 36)
        preview.current?.getContext('2d')?.drawImage(v, 0, 0, 256, 144)
        const px = g.getImageData(0, 0, 64, 36).data
        const hist = new Array<number>(16).fill(0)
        for (let p = 0; p < px.length; p += 4) {
          const y = 0.299 * px[p]! + 0.587 * px[p + 1]! + 0.114 * px[p + 2]!
          hist[Math.min(15, Math.floor(y / 16))]!++
        }
        if (prev && hist.reduce((a, h, k) => a + Math.abs(h - prev![k]!), 0) > 900) cuts++
        prev = hist
        if (i % Math.ceil(total / 10) === 0) add(`  images ${Math.round((i / total) * 100)} % (${fmtSec(performance.now() - t0)})`)
      }
      const ms = performance.now() - t0
      add(`Images terminées en ${fmtSec(ms)} (${cuts} changements de plan grossiers).`)
      return ms
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const audio = async (f: File) => {
    add(`Audio : lecture du fichier (${fmtBytes(f.size)}) pour le décodage. Ce test charge le fichier en mémoire : c'est voulu, c'est ce qu'on mesure.`)
    const t0 = performance.now()
    const ctx = new OfflineAudioContext(1, 1, 16000)
    const decoded = await ctx.decodeAudioData(await f.arrayBuffer())
    const data = decoded.getChannelData(0)
    const win = 800 // 50 ms à 16 kHz
    let quiet = 0, silences = 0
    for (let i = 0; i + win <= data.length; i += win) {
      let e = 0
      for (let k = 0; k < win; k++) e += data[i + k]! * data[i + k]!
      if (Math.sqrt(e / win) < 0.01) quiet++
      else { if (quiet >= 14) silences++; quiet = 0 }
    }
    const ms = performance.now() - t0
    add(`Audio décodé à ${decoded.sampleRate} Hz, ${decoded.duration.toFixed(0)} s, en ${fmtSec(ms)} (${silences} silences de 0,7 s ou plus).`)
    return ms
  }

  const run = async (doFrames: boolean, doAudio: boolean) => {
    if (!file) return
    cancel.current = false
    setBusy(true)
    try { sessionStorage.setItem(FLAG, '1') } catch { /* ignoré */ }
    const t0 = performance.now()
    try {
      if (doFrames) await frames(file)
      if (doAudio && !cancel.current) await audio(file)
      const total = performance.now() - t0
      add(`TOTAL ${fmtSec(total)} → ${total < GOAL_MS ? 'sous les 90 s : OK' : 'au-delà de 90 s : échec'}. Pas de rechargement de page.`)
    } catch (e) {
      add(`Échec : ${(e as Error).name} ${(e as Error).message}`)
    } finally {
      try { sessionStorage.removeItem(FLAG) } catch { /* ignoré */ }
      setBusy(false)
    }
  }

  return (
    <TestCard
      id="t7"
      num={7}
      title="Analyse d'une vidéo de 15 minutes"
      how="Choisis une vraie vidéo d'environ 15 minutes (le fichier le plus lourd que tu aies). Lance les deux mesures ensemble, puis chacune séparément si ça plante."
      passIf="Moins de 90 secondes, sans plantage ni rechargement de la page."
      planB="Échantillonner moins souvent, ou abandonner l'audio et garder les changements de plan."
    >
      <div className={s.row}>
        <Field label="Vidéo longue">
          <input type="file" accept="video/*" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
      </div>
      <div className={s.actions}>
        <Btn primary onClick={() => void run(true, true)} disabled={!file || busy}>Images + audio</Btn>
        <Btn onClick={() => void run(true, false)} disabled={!file || busy}>Images seules</Btn>
        <Btn onClick={() => void run(false, true)} disabled={!file || busy}>Audio seul</Btn>
        <Btn onClick={() => { cancel.current = true }} disabled={!busy}>Annuler</Btn>
        <Btn onClick={clear}>Effacer</Btn>
      </div>
      <canvas ref={preview} width={256} height={144} className={s.video} style={{ width: 256, height: 144 }} aria-label="Aperçu de l'image analysée" />
      <Log lines={lines} />
    </TestCard>
  )
}
