import type { ReactNode } from 'react'
import s from './ui.module.css'

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={s.card}>
      {title && <h2 className={s.label} style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13 }}>{title}</h2>}
      {children}
    </section>
  )
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <div className={s.rowText}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {hint && <span className={s.hint}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}
