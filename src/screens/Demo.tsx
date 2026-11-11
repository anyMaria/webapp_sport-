import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from '../app/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { importVideoFile } from '../data/importFile'
import { createDemoWorkout } from '../data/demo'
import s from '../app/app.module.css'

/** Écran provisoire de la phase 2 : importe un fichier à la main et crée une séance de 5 exercices. */
export function Demo() {
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const go = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      const source = await importVideoFile(file, 'Autre', setProgress)
      const id = await createDemoWorkout(source, file)
      nav(`/seance/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setProgress(null)
    }
  }

  return (
    <Screen title="Séance de démonstration" subtitle="Choisis une vidéo : elle est découpée en 5 extraits réguliers.">
      <Card>
        <p className={s.empty}>Cet écran sert à tester le lecteur. Le vrai découpage arrive en phase 3.</p>
        <div className={s.actions}>
          <Button variant="primary" disabled={progress !== null} onClick={() => input.current?.click()}>Choisir une vidéo</Button>
          <input ref={input} type="file" accept="video/*" hidden aria-label="Choisir une vidéo" onChange={(e) => void go(e.target.files?.[0])} />
        </div>
        {progress !== null && <progress value={progress} max={1} aria-label="Import en cours" style={{ width: '100%', height: 12 }} />}
        {error && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{error}</p>}
      </Card>
    </Screen>
  )
}
