import { useState } from 'react'
import { Button } from '../ui/Button'
import { PRESETS, toggleEquipment } from './equipment'
import c from './library.module.css'

/** Choix de l'équipement : trois choix courants, ceux déjà écrits ailleurs, et « Autre… » pour en écrire un. */
export function EquipmentPicker({ value, known, onChange }: { value: string[]; known: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [other, setOther] = useState('')
  const extra = value.filter((x) => !PRESETS.includes(x as (typeof PRESETS)[number]) && !known.includes(x))
  const close = () => { setOther(''); setOpen(false) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className={c.chips} role="group" aria-label="Équipement">
        {[...PRESETS, ...known, ...extra].map((e) => {
          const on = value.includes(e)
          return <button key={e} type="button" aria-pressed={on} className={[c.chip, on ? c.chipOn : ''].join(' ')} onClick={() => onChange(toggleEquipment(value, e))}>{e}</button>
        })}
        {!open && <button type="button" className={c.chip} onClick={() => setOpen(true)}>Autre…</button>}
      </div>
      {open && (
        <form className={c.otherRow} onSubmit={(e) => { e.preventDefault(); const t = other.trim(); if (t) onChange(toggleEquipment(value.filter((x) => x.toLowerCase() !== t.toLowerCase()), t)); close() }}>
          <label className={c.field} style={{ flex: 1 }}>Autre équipement<input autoFocus value={other} maxLength={40} onChange={(e) => setOther(e.target.value)} placeholder="Ex. tapis, haltères, chaise" /></label>
          <Button type="submit" variant="primary" disabled={!other.trim()}>Ajouter</Button>
          <Button onClick={close}>Annuler</Button>
        </form>
      )}
    </div>
  )
}
