import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from '../ui/Button'
import { Steps } from './Steps'
import s from './app.module.css'

/** Cadre commun des écrans secondaires : bouton retour, titre, sous-titre, et les trois étapes quand l'écran en fait partie. */
export function Screen({ title, subtitle, step, children }: { title: string; subtitle?: string; step?: 1 | 2 | 3; children: ReactNode }) {
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
        {step && <div className={s.headSteps}><Steps current={step} /></div>}
      </header>
      {children}
    </main>
  )
}
