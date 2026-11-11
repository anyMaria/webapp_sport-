import { Link } from 'react-router-dom'
import { APP_NAME } from '../lib/constants'
import s from '../app/app.module.css'

const ITEMS = [
  { to: '/bibliotheque', title: "Bibliothèque d'exercices", hint: 'Tes exercices et tes séances' },
  { to: '/mon-rythme', title: 'Mon rythme', hint: 'Série, créneau, séance express' },
  { to: '/collection', title: 'Collection', hint: 'Tes stickers' },
  { to: '/demo', title: 'Séance de démonstration', hint: 'Teste le lecteur avec une vidéo' },
  { to: '/reglages', title: 'Réglages', hint: 'Son, séance, sauvegarde' },
]

/** Accueil provisoire : la vraie page d'accueil arrive en phase 6. */
export function Home() {
  return (
    <main className={s.screen}>
      <header>
        <h1 style={{ fontSize: 34 }}>{APP_NAME}</h1>
        <p className={s.sub}>L'accueil complet arrive avec la séance et la motivation. Pour l'instant, les réglages et la sauvegarde sont prêts.</p>
      </header>
      <nav className={s.nav} aria-label="Navigation principale">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to} className={s.navItem}>
            {i.title}
            <span>{i.hint}</span>
          </Link>
        ))}
      </nav>
    </main>
  )
}
