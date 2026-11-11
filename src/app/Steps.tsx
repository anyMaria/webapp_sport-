import { Check } from 'lucide-react'
import s from './steps.module.css'

const STEPS = ['Importer', 'Découper', 'Nommer', 'Créer la séance']

export type StepNo = 1 | 2 | 3 | 4

/** Les quatre étapes pour passer d'une vidéo à une séance : montre où l'on en est. */
export function Steps({ current }: { current: StepNo }) {
  return (
    <ol className={s.steps} aria-label="Étapes">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = n < current ? s.done : n === current ? s.now : ''
        return (
          <li key={label} className={[s.step, state].join(' ')} aria-current={n === current ? 'step' : undefined} title={n < current ? `${label} : fait` : undefined}>
            <span className={s.num} aria-hidden="true">{n < current ? <Check size={16} strokeWidth={3} /> : n}</span>
            {n < current ? <span className={s.sr}>{label} (fait)</span> : <span>{label}</span>}
          </li>
        )
      })}
    </ol>
  )
}
