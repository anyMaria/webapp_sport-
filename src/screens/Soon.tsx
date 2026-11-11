import { Screen } from '../app/Screen'
import { Card } from '../ui/Card'
import s from '../app/app.module.css'

/** Écran pas encore construit : dit clairement à quelle phase il arrive. */
export function Soon({ title, phase, text }: { title: string; phase: number; text: string }) {
  return (
    <Screen title={title}>
      <Card>
        <p className={s.empty}>{text}</p>
        <p className={s.empty}>Cet écran arrive en phase {phase}.</p>
      </Card>
    </Screen>
  )
}
