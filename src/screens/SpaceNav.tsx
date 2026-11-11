import { NavLink } from 'react-router-dom'
import { Settings as SettingsIcon } from 'lucide-react'
import s from './spaceNav.module.css'

/** Barre de « Mon espace » : Mon rythme, Collection, et un bouton Réglages en haut à droite. */
export function SpaceNav() {
  return (
    <div className={s.bar}>
      <nav className={s.tabs} aria-label="Mon espace">
        <NavLink to="/mon-rythme" className={({ isActive }) => [s.tab, isActive ? s.on : ''].join(' ')}>Mon rythme</NavLink>
        <NavLink to="/collection" className={({ isActive }) => [s.tab, isActive ? s.on : ''].join(' ')}>Collection</NavLink>
      </nav>
      <NavLink to="/reglages" className={s.gear} aria-label="Réglages"><SettingsIcon size={22} aria-hidden="true" /><span>Réglages</span></NavLink>
    </div>
  )
}
