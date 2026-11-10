import { useRef } from 'react'
import { Btn, Log, TestCard, useLog } from './ui'
import s from './lab.module.css'

type AudioSessionNav = Navigator & { audioSession?: { type: string } }

/** Bip court en WAV (pour la variante <audio>). */
function wavBlob(freq = 880, sec = 0.4, rate = 22050): Blob {
  const n = Math.floor(rate * sec)
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 400, (n - i) / 400)
    v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * freq * i) / rate) * 0.6 * env * 32767, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

export function T1Beep() {
  const { lines, add, clear } = useLog()
  const ctxRef = useRef<AudioContext | null>(null)

  const beepWebAudio = async (type: string | null) => {
    try {
      const sessionApi = (navigator as AudioSessionNav).audioSession
      if (sessionApi) {
        if (type) sessionApi.type = type
        add(`audioSession.type = ${sessionApi.type}`)
      } else {
        add('navigator.audioSession absent sur cet appareil')
      }
      ctxRef.current ??= new AudioContext()
      const ctx = ctxRef.current
      await ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      const t = ctx.currentTime
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.5, t + 0.02)
      gain.gain.linearRampToValueAtTime(0, t + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.42)
      add(`Bip Web Audio envoyé (${type ?? 'sans réglage'}). Contexte : ${ctx.state}`)
    } catch (e) {
      add(`Erreur : ${(e as Error).message}`)
    }
  }

  const beepAudioEl = async () => {
    try {
      const url = URL.createObjectURL(wavBlob())
      const a = new Audio(url)
      a.onended = () => URL.revokeObjectURL(url)
      await a.play()
      add('Bip <audio> lancé.')
    } catch (e) {
      add(`Erreur <audio> : ${(e as Error).message}`)
    }
  }

  return (
    <TestCard
      id="t1"
      num={1}
      title="Bip par-dessus Spotify"
      how="Lance Spotify en lecture sur l'iPad, reviens ici, puis touche chaque bouton l'un après l'autre. Note pour chacun : Spotify a-t-il continué sans coupure ? Le bip s'entendait-il ?"
      passIf="Spotify continue sans coupure et le bip s'entend, dans au moins une variante."
      planB="Signal visuel seul (flash plein écran et changement de couleur), ou Spotify sur un autre appareil."
    >
      <div className={s.actions}>
        <Btn primary onClick={() => beepWebAudio('ambient')}>A · Web Audio, ambient</Btn>
        <Btn primary onClick={() => beepWebAudio('transient')}>B · Web Audio, transient</Btn>
        <Btn primary onClick={() => beepWebAudio(null)}>C · Web Audio, sans réglage</Btn>
        <Btn primary onClick={beepAudioEl}>D · Élément &lt;audio&gt;</Btn>
        <Btn onClick={clear}>Effacer</Btn>
      </div>
      <Log lines={lines} />
    </TestCard>
  )
}
