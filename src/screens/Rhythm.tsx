import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { db, saveSettings } from '../data/db'
import { Screen } from '../app/Screen'
import { SpaceNav } from './SpaceNav'
import { Button } from '../ui/Button'
import { Switch } from '../ui/Switch'
import { Stepper } from '../ui/Stepper'
import { Row } from '../ui/Card'
import { buildIcs, deliverIcs, slotKey } from '../motivation/ics'
import { streakMessage, useMotivation } from '../motivation/useMotivation'
import { APP_NAME } from '../lib/constants'
import { addDays, weekKey } from '../motivation/weeks'
import ui from '../ui/ui.module.css'
import r from './rhythm.module.css'
import s from '../app/app.module.css'

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // lundi → dimanche, valeurs de getDay()

/** Mon rythme : série, historique, créneau fixe, séance express de secours. */
export function Rhythm() {
  const { settings, result } = useMotivation()
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const [msg, setMsg] = useState<string | null>(null)
  const slot = settings.slot
  const message = streakMessage(result)
  const changedSinceExport = settings.slotExportedKey !== undefined && settings.slotExportedKey !== slotKey(slot)

  const setSlot = (p: Partial<typeof slot>) => void saveSettings({ slot: { ...slot, ...p } })
  const toggleDay = (d: number) => setSlot({ days: slot.days.includes(d) ? slot.days.filter((x) => x !== d) : [...slot.days, d] })

  const addToCalendar = async () => {
    const ics = buildIcs({ slot, reminder: settings.reminder, appName: APP_NAME, appUrl: `${window.location.origin}/`, now: new Date() })
    const how = await deliverIcs(ics, 'creneau-seance.ics')
    await saveSettings({ slotExportedKey: slotKey(slot) })
    setMsg(how === 'shared' ? 'Choisis « Calendrier » dans la feuille de partage pour ajouter l’événement.' : 'Fichier téléchargé : ouvre-le pour l’ajouter à ton calendrier.')
  }

  // Les quatre dernières semaines : la semaine en cours et les trois précédentes.
  const monday = result.current.monday
  const history = [3, 2, 1, 0].map((back) => {
    const m = addDays(monday, -7 * back)
    const known = result.weeks.find((w) => w.key === weekKey(m))
    return { label: back === 0 ? 'Cette sem.' : `−${back} sem.`, days: known?.days ?? [], jokered: known?.jokered ?? false, current: back === 0 }
  })

  return (
    <Screen title="Mon rythme" subtitle="La série compte les semaines, pas les jours : un jour sans séance ne casse rien.">
      <SpaceNav />
      <div className={s.grid}>
        <section className={r.card} aria-label="Série en cours">
          <span className={r.label}>Série en cours</span>
          <div className={r.streakRow}>
            <span className={r.streak}>{result.streak}</span>
            <span className={r.streakText}>semaine{result.streak > 1 ? 's' : ''}<br />d'affilée</span>
          </div>
          <span className={ui.hint}>Objectif : {settings.weeklyGoal} séances par semaine</span>
          {message && <p role="status" className={[s.msg, s.msgOk].join(' ')}>{message}</p>}

          <div className={r.history} role="list" aria-label="Historique des dernières semaines">
            {history.map((w, i) => (
              <div key={i} className={r.histRow} role="listitem">
                <span className={r.histLabel} style={{ fontWeight: w.current ? 600 : 400 }}>{w.label}</span>
                <div className={r.dots}>
                  {WEEK_LABELS.map((l, d) => (
                    <span key={d} className={[r.dot, w.days.includes(d) ? r.dotOn : ''].join(' ')} aria-label={`${l}${w.days.includes(d) ? ' : séance faite' : ''}`}>
                      {w.days.includes(d) && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                    </span>
                  ))}
                </div>
                {w.jokered && <span className={r.joker}>Joker</span>}
              </div>
            ))}
          </div>
          <div className={r.note}>Joker : une fois par mois, une semaine à 1 séance compte quand même.</div>
        </section>

        <section className={r.card} aria-label="Mon créneau">
          <span className={r.label}>Mon créneau</span>
          <div className={r.dayRow} role="group" aria-label="Jours du créneau">
            {DAY_ORDER.map((d) => (
              <button key={d} type="button" aria-pressed={slot.days.includes(d)} aria-label={DAY_NAMES[d]} className={[r.dayBtn, slot.days.includes(d) ? r.dayOn : ''].join(' ')} onClick={() => toggleDay(d)}>{DAY_NAMES[d]![0]}</button>
            ))}
          </div>
          <label className={r.timeField}>
            <span className={ui.hint}>Heure</span>
            <input type="time" value={slot.time} className={r.time} onChange={(e) => e.target.value && setSlot({ time: e.target.value })} />
          </label>
          <Row label="Durée bloquée"><Stepper label="Durée du créneau" value={slot.durationMin} min={5} max={60} step={5} unit="min" onChange={(v) => setSlot({ durationMin: v })} /></Row>
          <Row label="Rappel 10 min avant"><Switch on={settings.reminder} onChange={(v) => void saveSettings({ reminder: v })} label="Rappel 10 minutes avant" /></Row>
          <Row label="Séance du créneau">
            <select className={ui.select} aria-label="Séance du créneau" value={settings.slotWorkoutId ?? ''} onChange={(e) => void saveSettings({ slotWorkoutId: e.target.value || undefined })}>
              <option value="">Dernière utilisée</option>
              {workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Row>
          <Row label="Séance express de secours" ><Switch on={settings.expressFallback} onChange={(v) => void saveSettings({ expressFallback: v })} label="Séance express de secours" /></Row>
          <span className={ui.hint} style={{ marginTop: -10 }}>3 min, et la séance compte.</span>
          <div className={s.actions}>
            <Button variant="primary" disabled={slot.days.length === 0} onClick={() => void addToCalendar()}>Ajouter à mon calendrier</Button>
          </div>
          {changedSinceExport && <p role="alert" className={[s.msg, s.msgErr].join(' ')} style={{ color: 'var(--transition)' }}>Ton créneau a changé : supprime l'ancien événement de ton calendrier avant d'ajouter le nouveau.</p>}
          {msg && <p role="status" className={s.msg}>{msg}</p>}
        </section>
      </div>
    </Screen>
  )
}
