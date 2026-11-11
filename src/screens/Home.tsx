import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Dumbbell, Flame, Play, Plus, Film, Scissors } from 'lucide-react'
import { db } from '../data/db'
import { Thumb } from '../library/Thumb'
import { formatDuration, workoutDurationSec } from '../library/workouts'
import { composeExpress } from '../motivation/express'
import { motivationPhrase, phraseSeed } from '../motivation/phrases'
import { sessionsUntilNextPouch } from '../stickers/schedule'
import { weekDays, weekStatusLine } from '../motivation/streak'
import { streakMessage, useMotivation } from '../motivation/useMotivation'
import { originText, type Exercise, type VideoSource, type Workout } from '../data/types'
import { APP_NAME } from '../lib/constants'
import { useVideoStats } from '../data/useVideoStats'
import { equipmentText, mergeEquipment } from '../library/equipment'
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
  const countedTotal = (useLiveQuery(() => db.sessionLogs.toArray(), []) ?? []).filter((l) => l.counted).length
  const untilPouch = sessionsUntilNextPouch(countedTotal)
  const unrevealed = (useLiveQuery(() => db.stickerUnlocks.toArray(), []) ?? []).filter((u) => !u.revealed).length

  const { counts, thumbs } = useVideoStats()

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
  const hello = now.getHours() < 18 ? 'Bonjour' : 'Bonsoir'
  const who = settings.userName.trim()
  const greeting = who ? `${hello} ${who}` : hello
  const slotLine = slotToday
    ? `C'est ton jour ! Ton créneau est à ${hhmm(settings.slot.time)}. On y va ?`
    : nextSlotDay !== undefined ? `Prochain créneau : ${DAYS[nextSlotDay]} à ${hhmm(settings.slot.time)}.` : 'Choisis tes jours de créneau dans « Mon rythme ».'
  const msg = streakMessage(result)
  const phrase = motivationPhrase({ slotToday, streak: result.streak, weekDone: result.current.validated }, phraseSeed(now))
  const days = weekDays(result.current, now, settings.slot.days)
  const pct = Math.min(100, Math.round((result.current.count / settings.weeklyGoal) * 100))

  // À continuer : vidéos pas encore découpées (ou en cours), puis vidéos découpées qui ne sont dans aucune séance.
  const inWorkouts = new Set(workouts.flatMap((w) => w.items.map((i) => exById.get(i.exerciseId)?.sourceId)))
  const recent = [...sources].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const toCut = recent.filter((v) => !counts[v.id])
  const toCompose = recent.filter((v) => counts[v.id] && !inWorkouts.has(v.id))
  const pending = [
    ...toCut.map((v) => ({ v, state: v.draftSegs ? 'Découpage commencé' : 'À découper', label: v.draftSegs ? 'Reprendre' : 'Découper', to: `/decoupage/${v.id}`, cut: true })),
    ...toCompose.map((v) => ({ v, state: `${counts[v.id]} exercice${counts[v.id]! > 1 ? 's' : ''}, pas encore dans une séance`, label: 'Créer une séance', to: `/composer/nouvelle?video=${v.id}`, cut: false })),
  ]
  // Premiers pas : où en est-elle des trois étapes ?
  const firstStep = sources.length === 0 ? 1 : exercises.length === 0 ? 2 : 4
  const firstSteps = [
    { title: 'Importe une vidéo', text: 'Un TikTok enregistré, un lien YouTube ou un fichier. Tout reste sur cet iPad.', label: 'Importer une vidéo', to: '/import' },
    { title: 'Découpe-la en exercices', text: "À la main, au rythme régulier, ou avec l'IA qui pose les coupes.", label: toCut[0] ? `Découper « ${toCut[0].title} »` : 'Voir mes vidéos', to: toCut[0] ? `/decoupage/${toCut[0].id}` : '/videos' },
    { title: 'Nomme les exercices', text: 'Le nom que dira la voix, une consigne, la zone du corps.', label: '', to: '' },
    { title: 'Crée ta séance', text: 'Choisis tes exercices et la durée de chacun.', label: 'Créer ma séance', to: toCompose[0] ? `/composer/nouvelle?video=${toCompose[0].id}` : '/composer/nouvelle' },
  ]

  const equipOf = (w: Workout) => equipmentText(mergeEquipment(w.items.map((i) => srcById.get(exById.get(i.exerciseId)?.sourceId ?? '')?.equipment)))

  const originsOf = (w: Workout) => [...new Set(w.items.map((i) => { const src = srcById.get(exById.get(i.exerciseId)?.sourceId ?? ''); return src ? originText(src) : undefined }).filter(Boolean))] as string[]

  return (
    <main className={h.page}>
      <header className={h.top}>
        <div className={h.hello}>
          <h1>{greeting}</h1>
          <p className={h.phrase}>{msg ?? phrase}</p>
        </div>
        <div className={h.pills}>
          {unrevealed > 0 && <Link to="/collection" className={[h.pill, h.pillGlow].join(' ')}>Une pochette t'attend</Link>}
          <Link to="/mon-rythme" className={h.pill}>
            <Flame size={20} color="var(--transition)" aria-hidden="true" style={{ animation: result.streak > 0 ? 'wiggle 2.8s ease-in-out infinite' : undefined, transformOrigin: '50% 90%' }} />
            <span>Mon espace{result.streak > 0 ? ` · ${result.streak} semaine${result.streak > 1 ? 's' : ''}` : ''}</span>
          </Link>
          <Link to="/videos" className={h.pillStrong}><Film size={20} aria-hidden="true" />Mes vidéos</Link>
          <Link to="/import" className={h.pillMain}><Plus size={22} aria-hidden="true" />Importer une vidéo</Link>
        </div>
      </header>

      {workouts.length === 0 ? (
        <section className={h.empty} aria-label="Premiers pas">
          <div>
            <h2 style={{ fontSize: 28 }}>Bienvenue dans {APP_NAME}</h2>
            <p className={h.hint} style={{ fontSize: 16, margin: '4px 0 0' }}>Quatre étapes pour ta première séance.</p>
          </div>
          <ol className={h.firstSteps}>
            {firstSteps.map((st, i) => {
              const n = i + 1
              return (
                <li key={st.title} className={[h.firstStep, n === firstStep ? h.firstNow : n < firstStep ? h.firstDone : ''].join(' ')} aria-current={n === firstStep ? 'step' : undefined}>
                  <span className={h.firstNum} aria-hidden="true">{n < firstStep ? <Check size={20} strokeWidth={3} /> : n}</span>
                  <strong>{st.title}{n < firstStep && <span className={h.srOnly}> (fait)</span>}</strong>
                  <span className={h.hint}>{st.text}</span>
                  {n === firstStep && <Link to={st.to} className={h.firstGo}>{st.label}</Link>}
                </li>
              )
            })}
          </ol>
        </section>
      ) : (
        <section className={h.hero}>
          <div className={h.today}>
            <div>
              <span className={h.eyebrow}>Séance du jour{slotToday ? ` · créneau de ${hhmm(settings.slot.time)}` : ''}</span>
              <h2>{today?.name}</h2>
              <span className={h.todayMeta}>{today ? `${formatDuration(workoutDurationSec(today.items))} · ${today.items.length} exercices` : ''}</span>
              {today && equipOf(today) ? <span className={h.todayMeta} style={{ display: 'block', fontWeight: 600 }}>{equipOf(today)}</span> : null}
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
              <p className={h.slotLine}>{slotLine}</p>
              <div><span className={h.big}>{result.current.count} / {settings.weeklyGoal}</span><span className={h.unit}>séances</span></div>
              <span className={h.hint}>dont {Math.min(result.current.inApp, settings.minInApp)} / {settings.minInApp} dans l'app, le reste ici ou ailleurs</span>
            </div>
            <div className={h.days} role="list" aria-label="Jours de la semaine">
              {days.map((d, i) => (
                <div key={i} className={h.day} role="listitem">
                  <div className={[h.dot, d.state === 'done' ? h.dotDone : d.state === 'external' ? h.dotExt : d.state === 'today' ? h.dotToday : d.state === 'slot' ? h.dotSlot : ''].join(' ')}>
                    {d.state === 'done' && <Check size={18} strokeWidth={3} aria-label="Séance faite dans l'app" />}
                    {d.state === 'external' && <Dumbbell size={18} aria-label="Sport fait ailleurs" />}
                  </div>
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
            <div>
              <div className={h.track} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de la semaine"><div className={h.fill} style={{ width: `${pct}%` }} /></div>
              <span className={h.hint}>{weekStatusLine(result.current, settings.minInApp)} {untilPouch === 1 ? 'Ta prochaine pochette : à la prochaine séance !' : `Prochaine pochette dans ${untilPouch} séances`}</span>
            </div>
          </div>
        </section>
      )}

      {pending.length > 0 && !(workouts.length === 0 && pending.length === 1) && (
        <section aria-labelledby="a-continuer" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={h.sectionHead}>
            <h2 id="a-continuer">À continuer</h2>
            {pending.length > 3 && <Link to="/videos" className={h.link}>Toutes mes vidéos</Link>}
          </div>
          <div className={h.pending}>
            {pending.slice(0, 3).map(({ v, state, label, to, cut }) => (
              <article key={v.id} className={h.pendItem}>
                <Thumb id={v.thumbId ?? thumbs[v.id]} youtubeId={v.youtubeId} className={h.pendThumb} />
                <div className={h.pendText}>
                  <strong>{v.title}</strong>
                  <span className={h.hint}>{state}</span>
                </div>
                <Link to={to} className={h.pendGo}>{cut && <Scissors size={18} aria-hidden="true" />}{label}</Link>
              </article>
            ))}
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
                    {equipOf(w) ? <span className={h.hint} style={{ display: 'block' }}>{equipOf(w)}</span> : null}
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

    </main>
  )
}
