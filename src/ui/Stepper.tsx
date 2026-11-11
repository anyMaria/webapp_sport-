import { Minus, Plus } from 'lucide-react'
import { IconButton } from './Button'
import s from './ui.module.css'

export function Stepper(props: { value: number; min: number; max: number; step?: number; unit: string; label: string; onChange: (v: number) => void }) {
  const step = props.step ?? 1
  const clamp = (v: number) => Math.min(props.max, Math.max(props.min, v))
  return (
    <div className={s.stepper} role="group" aria-label={props.label}>
      <IconButton label={`Moins : ${props.label}`} onClick={() => props.onChange(clamp(props.value - step))} disabled={props.value <= props.min}>
        <Minus size={22} aria-hidden="true" />
      </IconButton>
      <span className={s.value} aria-live="polite">{props.value} {props.unit}</span>
      <IconButton label={`Plus : ${props.label}`} onClick={() => props.onChange(clamp(props.value + step))} disabled={props.value >= props.max}>
        <Plus size={22} aria-hidden="true" />
      </IconButton>
    </div>
  )
}
