import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from '../ui/Button'
import s from './app.module.css'

/** Cadre commun des écrans secondaires : bouton retour, titre, sous-titre. */
export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const nav = useNavigate()
  return (
    <main className={s.screen}>
      <header className={s.head}>
        <IconButton label="Retour à l'accueil" onClick={() => nav('/')}>
          <ChevronLeft size={24} aria-hidden="true" />
        </IconButton>
        <div>
          <h1>{title}</h1>
          {subtitle && <p className={s.sub}>{subtitle}</p>}
        </div>
      </header>
      {children}
    </main>
  )
}
