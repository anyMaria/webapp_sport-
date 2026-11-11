import { NavLink } from 'react-router-dom'
import { Settings as SettingsIcon } from 'lucide-react'
import s from './spaceNav.module.css'

/** Barre de la collection : le bouton Réglages en haut à droite. (Le rythme s'ouvre depuis la carte « Cette semaine » de l'accueil.) */
export function SpaceNav() {
  return (
    <div className={s.bar} style={{ justifyContent: 'flex-end' }}>
      <NavLink to="/reglages" className={s.gear} aria-label="Réglages"><SettingsIcon size={22} aria-hidden="true" /><span>Réglages</span></NavLink>
    </div>
  )
}
