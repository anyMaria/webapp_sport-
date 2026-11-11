import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import { db, saveSettings } from '../data/db'
import { Screen } from '../app/Screen'
import { Button, IconButton } from '../ui/Button'
import { Switch } from '../ui/Switch'
import { Stepper } from '../ui/Stepper'
import { Row } from '../ui/Card'
import { buildIcs, deliverIcs, slotKey } from '../motivation/ics'
import { streakMessage, useMotivation } from '../motivation/useMotivation'
import { APP_NAME } from '../lib/constants'
import { dayKey } from '../motivation/weeks'
import { addMonths, monthGrid } from '../motivation/month'
import { addActivity, removeActivity, sportChoices } from '../library/activities'
import ui from '../ui/ui.module.css'
import r from './rhythm.module.css'
import s from '../app/app.module.css'

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // lundi → dimanche, valeurs de getDay()

/** Ma semaine (ouverte depuis la carte « Cette semaine » de l'accueil) : le mois, le sport fait ailleurs, l'objectif, le créneau fixe. */
export function Rhythm() {
  const { settings, result, logs } = useMotivation()
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

  // Ce mois-ci : les jours avec une séance comptée, et la navigation d'un mois à l'autre.
  const today = new Date()
  // Un jour touché sur l'accueil arrive ici déjà choisi (?jour=AAAA-MM-JJ), pour noter un sport tout de suite.
  const askedDay = useSearchParams()[0].get('jour')
  const asked = askedDay && /^\d{4}-\d{2}-\d{2}$/.test(askedDay) ? askedDay : null
  const [shown, setShown] = useState(() => (asked ? { year: Number(asked.slice(0, 4)), month: Number(asked.slice(5, 7)) - 1 } : { year: today.getFullYear(), month: today.getMonth() }))
  const activities = useLiveQuery(() => db.activities.toArray(), []) ?? []
  const [picked, setPicked] = useState<string | null>(asked) // jour choisi dans le calendrier (AAAA-MM-JJ)
  const noteRef = useRef<HTMLDivElement>(null)
  // Arrivée depuis un jour de l'accueil : le formulaire « noter un sport » vient à l'écran.
  useEffect(() => { if (asked) noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [asked])
  const [sport, setSport] = useState('')
  const [minutes, setMinutes] = useState(60)
  const externalKeys = new Set(activities.map((a) => a.date))
  const doneKeys = new Set(logs.filter((l) => l.counted).map((l) => dayKey(new Date(l.startedAt))))
  const grid = monthGrid(shown.year, shown.month, doneKeys, slot.days, today, externalKeys)
  const doneCount = grid.filter((c) => c.done).length
  const externalCount = activities.filter((a) => a.date.startsWith(`${shown.year}-${String(shown.month + 1).padStart(2, '0')}`)).length
  const dayActivities = picked ? activities.filter((a) => a.date === picked) : []
  const pickedLabel = picked ? new Date(`${picked}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const choices = sportChoices(activities)
  const save = async () => {
    if (!picked || !sport.trim()) return
    await addActivity(picked, sport, minutes)
    setSport('')
  }
  const isCurrent = shown.year === today.getFullYear() && shown.month === today.getMonth()
  const monthName = new Date(shown.year, shown.month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <Screen title="Ma semaine" subtitle="Ton organisation : le mois, ton objectif et ton créneau. La série compte les semaines, pas les jours.">
      <div className={s.grid}>
        <section className={r.card} aria-label={isCurrent ? 'Ce mois-ci' : monthName}>
          <span className={r.label}>{isCurrent ? 'Ce mois-ci' : 'Un autre mois'}</span>
          <div className={r.monthBar}>
            <IconButton label="Mois précédent" onClick={() => setShown((m) => addMonths(m.year, m.month, -1))}><ChevronLeft size={22} aria-hidden="true" /></IconButton>
            <strong className={r.monthName} aria-live="polite">{monthName}</strong>
            <IconButton label="Mois suivant" onClick={() => setShown((m) => addMonths(m.year, m.month, 1))}><ChevronRight size={22} aria-hidden="true" /></IconButton>
          </div>
          <div className={r.grid} role="grid" aria-label={`Séances de ${monthName}`}>
            {WEEK_LABELS.map((l, i) => <span key={`h${i}`} className={r.gridHead} aria-hidden="true">{l}</span>)}
            {grid.map((c) => (
              c.inMonth ? (
                <button
                  key={c.key}
                  type="button"
                  role="gridcell"
                  aria-pressed={picked === c.key}
                  aria-label={`${c.day}${c.done ? ' : séance faite ici' : ''}${c.external ? ' : sport fait ailleurs' : ''}${!c.done && !c.external && c.slot ? ' : créneau prévu' : ''}. Noter du sport`}
                  onClick={() => setPicked(picked === c.key ? null : c.key)}
                  className={[r.cell, r.cellBtn, c.done ? r.cellDone : '', c.external && !c.done ? r.cellExt : '', c.today ? r.cellToday : '', c.slot && !c.done && !c.external ? r.cellSlot : '', picked === c.key ? r.cellPicked : ''].join(' ')}
                >
                  {c.done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : c.external ? <Dumbbell size={16} aria-hidden="true" /> : c.day}
                  {c.done && c.external && <span className={r.extDot} aria-hidden="true" />}
                </button>
              ) : <span key={c.key} className={[r.cell, r.cellPad].join(' ')} />
            ))}
          </div>
          <span className={ui.hint}>{doneCount} séance{doneCount > 1 ? 's' : ''} ici · {externalCount} sport{externalCount > 1 ? 's' : ''} ailleurs.</span>
          <div className={r.legend}>
            <span><span className={r.swatch} style={{ background: 'var(--effort)' }} />Séance ici</span>
            <span><span className={r.swatch} style={{ background: 'var(--transition)' }} />Sport ailleurs</span>
            <span><span className={r.swatch} style={{ border: '2px dashed var(--effort)' }} />Créneau prévu</span>
          </div>
          <Button onClick={() => setPicked(dayKey(today))}><Dumbbell size={18} aria-hidden="true" />Noter un sport fait ailleurs</Button>
          {picked && (
            <div ref={noteRef} className={r.note} role="group" aria-label={`Sport du ${pickedLabel}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <strong style={{ textTransform: 'capitalize' }}>{pickedLabel}</strong>
              {dayActivities.map((a) => (
                <div key={a.id} className={s.actions} style={{ justifyContent: 'space-between' }}>
                  <span>{a.label}{a.durationMin ? ` · ${a.durationMin} min` : ''}</span>
                  <Button variant="danger" aria-label={`Supprimer ${a.label}`} onClick={() => void removeActivity(a.id)}>Supprimer</Button>
                </div>
              ))}
              <span className={ui.hint}>Quel sport as-tu fait ?</span>
              <div className={r.chips} role="group" aria-label="Sports">
                {choices.map((c) => <button key={c} type="button" aria-pressed={sport === c} className={[r.chip, sport === c ? r.chipOn : ''].join(' ')} onClick={() => setSport(c)}>{c}</button>)}
              </div>
              <input className={ui.select} style={{ maxWidth: '100%' }} aria-label="Autre sport" placeholder="Autre sport" value={sport} maxLength={40} onChange={(e) => setSport(e.target.value)} />
              <Row label="Durée"><Stepper label="Durée du sport" value={minutes} min={5} max={240} step={5} unit="min" onChange={setMinutes} /></Row>
              <div className={s.actions}>
                <Button variant="primary" disabled={!sport.trim()} onClick={() => void save()}>Ajouter ce sport</Button>
                <Button onClick={() => setPicked(null)}>Fermer</Button>
              </div>
              <span className={ui.hint}>Un jour avec du sport fait ailleurs compte pour ton objectif de la semaine (une fois par jour).</span>
            </div>
          )}
          <div className={r.streakRow}>
            <span className={r.streak}>{result.streak}</span>
            <span className={r.streakText}>semaine{result.streak > 1 ? 's' : ''} d'affilée</span>
          </div>
          <Row label="Séances par semaine" hint="Dans l'app ou ailleurs"><Stepper unit="" label="Séances par semaine" value={settings.weeklyGoal} min={1} max={7} step={1} onChange={(v) => void saveSettings({ weeklyGoal: v, minInApp: Math.min(settings.minInApp, v) })} /></Row>
          <Row label="dont dans l'app" hint="Au moins"><Stepper unit="" label="Séances minimum dans l'app" value={settings.minInApp} min={0} max={settings.weeklyGoal} step={1} onChange={(v) => void saveSettings({ minInApp: v })} /></Row>
          <p className={ui.hint} style={{ margin: 0 }}>Objectif : {settings.weeklyGoal} séances par semaine, dont au moins {settings.minInApp} dans l'app. Le sport noté dans le calendrier compte pour le reste.</p>
          {message && <p role="status" className={[s.msg, s.msgOk].join(' ')}>{message}</p>}
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
