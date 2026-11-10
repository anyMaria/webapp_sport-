import { useEffect, useState } from 'react'
import { Btn, Field, Log, TestCard, useLog } from './ui'
import s from './lab.module.css'

export function T2Voice() {
  const { lines, add, clear } = useLog()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceUri, setVoiceUri] = useState('')
  const [text, setText] = useState('Ensuite : Rotation du buste, 45 secondes. Assise, dos droit.')
  const supported = 'speechSynthesis' in window

  useEffect(() => {
    if (!supported) return
    const load = () => {
      const fr = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'))
      setVoices(fr)
      setVoiceUri((cur) => cur || fr[0]?.voiceURI || '')
    }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  const speak = () => {
    const u = new SpeechSynthesisUtterance(text)
    const v = voices.find((x) => x.voiceURI === voiceUri)
    if (v) { u.voice = v; u.lang = v.lang } else u.lang = 'fr-FR'
    u.onstart = () => add(`Début de la voix${v ? ` (${v.name})` : ''}`)
    u.onend = () => add('Fin de la voix')
    u.onerror = (e) => add(`Erreur : ${e.error}`)
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    add('speak() appelé')
  }

  return (
    <TestCard
      id="t2"
      num={2}
      title="Voix de synthèse par-dessus Spotify"
      how="Spotify en lecture, touche « Dire la phrase ». Essaie aussi avec audioSession réglé via le test 1 (touche d'abord A ou B, puis la voix)."
      passIf="La phrase est dite sans couper Spotify."
      planB="Clips audio pré-générés joués par le même canal que les bips, ou consigne affichée en grand sans voix."
    >
      {!supported && <p className={s.muted}>speechSynthesis absent sur cet appareil.</p>}
      <div className={s.row}>
        <Field label={`Voix françaises trouvées : ${voices.length}`}>
          <select value={voiceUri} onChange={(e) => setVoiceUri(e.target.value)}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </Field>
        <Field label="Phrase">
          <input value={text} onChange={(e) => setText(e.target.value)} style={{ minWidth: 340 }} />
        </Field>
      </div>
      <div className={s.actions}>
        <Btn primary onClick={speak} disabled={!supported}>Dire la phrase</Btn>
        <Btn onClick={clear}>Effacer</Btn>
      </div>
      <Log lines={lines} />
    </TestCard>
  )
}
