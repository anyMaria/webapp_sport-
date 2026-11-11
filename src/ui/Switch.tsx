import s from './ui.module.css'

/** Interrupteur : vrai <button> avec aria-pressed, comme le demande le plan. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className={s.switchBtn} aria-pressed={on} aria-label={`${label}, ${on ? 'activé' : 'désactivé'}`} onClick={() => onChange(!on)}>
      <span className={[s.track, on ? s.trackOn : ''].join(' ')}>
        <span className={s.thumb} />
      </span>
    </button>
  )
}
