import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Flame, Play, Plus } from 'lucide-react'
import { db } from '../data/db'
import { Thumb } from '../library/Thumb'
import { formatDuration, workoutDurationSec } from '../library/workouts'
import { composeExpress } from '../motivation/express'
import { remainingThisWeek, weekDays } from '../motivation/streak'
import { streakMessage, useMotivation } from '../motivation/useMotivation'
import { originText, type Exercise, type VideoSource, type Workout } from '../data/types'
import { APP_NAME } from '../lib/constants'
import h from './home.module.css'

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const hhmm = (t: string) => t.replace(':', 'h')
const NONE: never[] = []

export function Home() {
  const nav = useNavigate()
  const { settings, logs, result, now } = useMotivation()
  const workouts = useLiveQuery(() => db.workouts.orderBy('updatedAt').reverse().toArray(), []) ?? (NONE as Workout[])
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? (NONE as Exercise[])
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? (NONE as VideoSource[])
  const unrevealed = (useLiveQuery(() => db.stickerUnlocks.toArray(), []) ?? []).filter((u) => !u.revealed).length

  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const srcById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])

  // Séance du jour : celle choisie pour le créneau, sinon la dernière utilisée, sinon la plus récente.
  const lastUsedId = [...logs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.workoutId
  const today = workouts.find((w) => w.id === settings.slotWorkoutId) ?? workouts.find((w) => w.id === lastUsedId) ?? workouts[0]
  const expressWorkout = workouts.find((w) => w.isExpress)
  const expressSec = expressWorkout
    ? workoutDurationSec(expressWorkout.items)
    : today ? workoutDurationSec(composeExpress(today.items)) : 0

  const slotToday = settings.slot.days.includes(now.getDay())
  const nextSlotDay = [1, 2, 3, 4, 5, 6, 7].map((i) => (now.getDay() + i) % 7).find((d) => settings.slot.days.includes(d))
  const greeting = `${now.getHours() < 18 ? 'Bonjour' : 'Bonsoir'}${settings.userName.trim() ? ` ${settings.userName.trim()}` : ''}`
  const slotLine = slotToday
    ? `Ton créneau du jour est à ${hhmm(settings.slot.time)}. Tout est prêt.`
    : nextSlotDay !== undefined ? `Prochain créneau : ${DAYS[nextSlotDay]} à ${hhmm(settings.slot.time)}.` : 'Choisis tes jours de créneau dans « Mon rythme ».'
  const msg = streakMessage(result)
  const left = remainingThisWeek(result, settings.weeklyGoal)
  const days = weekDays(result.current, now, settings.slot.days)
  const pct = Math.min(100, Math.round((result.current.count / settings.weeklyGoal) * 100))

  const originsOf = (w: Workout) => [...new Set(w.items.map((i) => { const src = srcById.get(exById.get(i.exerciseId)?.sourceId ?? ''); return src ? originText(src) : undefined }).filter(Boolean))] as string[]

  return (
    <main className={h.page}>
      <header className={h.top}>
        <div className={h.hello}>
          <h1>{greeting}</h1>
          <p>{msg ?? slotLine}</p>
        </div>
        <div className={h.pills}>
          {unrevealed > 0 && <Link to="/collection" className={[h.pill, h.pillGlow].join(' ')}>Une pochette t'attend</Link>}
          <Link to="/mon-rythme" className={h.pill}>
            <Flame size={20} color="var(--transition)" aria-hidden="true" />
            <span>{result.streak > 0 ? `${result.streak} semaine${result.streak > 1 ? 's' : ''} d'affilée` : 'Nouvelle série'}</span>
          </Link>
          <Link to="/import" className={h.pill} style={{ border: '2px solid var(--text)', background: 'transparent' }}><Plus size={18} aria-hidden="true" />Importer une vidéo</Link>
        </div>
      </header>

      {workouts.length === 0 ? (
        <section className={h.empty} aria-label="Premiers pas">
          <h2 style={{ fontSize: 28 }}>Bienvenue dans {APP_NAME}</h2>
          <p className={h.hint} style={{ fontSize: 16, margin: 0 }}>Importe une vidéo d'exercices, découpe-la, puis compose ta première séance. Tout reste sur cet iPad.</p>
          <div><Link to="/import" className={h.pill} style={{ background: 'var(--effort)', color: 'var(--on-accent)', display: 'inline-flex' }}>Importer une vidéo</Link></div>
        </section>
      ) : (
        <section className={h.hero}>
          <div className={h.today}>
            <div>
              <span className={h.eyebrow}>Séance du jour{slotToday ? ` · créneau de ${hhmm(settings.slot.time)}` : ''}</span>
              <h2>{today?.name}</h2>
              <span className={h.todayMeta}>{today ? `${formatDuration(workoutDurationSec(today.items))} · ${today.items.length} exercices` : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className={h.start} onClick={() => today && nav(`/seance/${today.id}`)}><Play size={22} fill="currentColor" aria-hidden="true" />Commencer</button>
              {settings.expressFallback && today && (
                <button className={h.express} onClick={() => nav(expressWorkout ? `/seance/${expressWorkout.id}` : `/seance/${today.id}?express=1`)}>
                  Version express · {Math.max(1, Math.round(expressSec / 60))} min
                </button>
              )}
            </div>
          </div>

          <div className={h.week}>
            <div>
              <span className={h.eyebrow} style={{ color: 'var(--text-muted)' }}>Cette semaine</span>
              <div><span className={h.big}>{result.current.count} / {settings.weeklyGoal}</span><span className={h.unit}>séances</span></div>
            </div>
            <div className={h.days} role="list" aria-label="Jours de la semaine">
              {days.map((d, i) => (
                <div key={i} className={h.day} role="listitem">
                  <div className={[h.dot, d.state === 'done' ? h.dotDone : d.state === 'today' ? h.dotToday : d.state === 'slot' ? h.dotSlot : ''].join(' ')}>
                    {d.state === 'done' && <Check size={18} strokeWidth={3} aria-label="Séance faite" />}
                  </div>
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
            <div>
              <div className={h.track} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de la semaine"><div className={h.fill} style={{ width: `${pct}%` }} /></div>
              <span className={h.hint}>{left === 0 ? 'Semaine validée.' : `Prochaine pochette dans ${left} séance${left > 1 ? 's' : ''}`}</span>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="mes-seances" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className={h.sectionHead}>
          <h2 id="mes-seances">Mes séances</h2>
          <Link to="/bibliotheque" className={h.link}>Bibliothèque d'exercices</Link>
        </div>
        <div className={h.grid}>
          {workouts.map((w) => {
            const first = exById.get(w.items[0]?.exerciseId ?? '')
            return (
              <article key={w.id} className={h.card}>
                <div className={h.cover}>
                  <Thumb id={first?.thumbId} youtubeId={first ? srcById.get(first.sourceId)?.youtubeId : undefined} className={h.coverImg} />
                  {originsOf(w).map((o) => <span key={o} className={h.chip}>{o}</span>)}
                </div>
                <div className={h.cardBody}>
                  <div>
                    <div className={h.cardName}>{w.name}</div>
                    <span className={h.hint}>{formatDuration(workoutDurationSec(w.items))} · {w.items.length} exercices</span>
                  </div>
                  <button className={h.play} aria-label={`Lancer ${w.name}`} onClick={() => nav(`/seance/${w.id}`)}><Play size={20} fill="currentColor" aria-hidden="true" /></button>
                </div>
              </article>
            )
          })}
          <button className={h.newCard} onClick={() => nav('/composer/nouvelle')}>
            <Plus size={30} aria-hidden="true" />
            Nouvelle séance
            <span className={h.hint} style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14 }}>Combine des exercices de plusieurs vidéos</span>
          </button>
        </div>
      </section>

      <nav className={h.foot} aria-label="Navigation principale">
        <Link to="/mon-rythme" className={h.link}>Mon rythme</Link>
        <Link to="/collection" className={h.link}>Collection</Link>
        <Link to="/reglages" className={h.link}>Réglages</Link>
      </nav>
    </main>
  )
}
