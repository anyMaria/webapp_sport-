import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import { db } from '../data/db'
import { newId } from '../data/importFile'
import type { Workout, WorkoutItem } from '../data/types'
import { Screen } from '../app/Screen'
import { Button, IconButton } from '../ui/Button'
import { Stepper } from '../ui/Stepper'
import { Thumb } from './Thumb'
import { TAGS } from '../screens/Split'
import { DEFAULT_ITEM_SEC, formatDuration, move, workoutDurationSec } from './workouts'
import c from './library.module.css'
import s from '../app/app.module.css'

/** Composition : ajouter des exercices depuis la bibliothèque, réordonner (glisser ou flèches), régler durées et repos. */
export function Composer() {
  const { id = 'nouvelle' } = useParams()
  const existing = useLiveQuery(async () => (id === 'nouvelle' ? null : ((await db.workouts.get(id)) ?? null)), [id])
  if (existing === undefined) return null
  return <ComposerEditor key={id} id={id} existing={existing ?? undefined} />
}

const NONE: never[] = []

function ComposerEditor({ id, existing }: { id: string; existing?: Workout }) {
  const nav = useNavigate()
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? NONE
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? NONE
  const ytOf = new Map(sources.map((x) => [x.id, x.youtubeId]))
  const [name, setName] = useState(existing?.name ?? 'Nouvelle séance')
  const [items, setItems] = useState<WorkoutItem[]>(existing?.items ?? [])
  const [express, setExpress] = useState(existing?.isExpress ?? false)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [drag, setDrag] = useState<number | null>(null)
  const rows = useRef<(HTMLDivElement | null)[]>([])

  const byId = new Map(exercises.map((e) => [e.id, e]))
  const shown = exercises.filter((e) => (!tag || e.tags.includes(tag)) && e.name.toLowerCase().includes(q.trim().toLowerCase()))
  const patch = (i: number, p: Partial<WorkoutItem>) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)))

  // Glisser-déposer au doigt ou à la souris : la poignée capte le pointeur, la position décide du rang.
  const startDrag = (e: React.PointerEvent, from: number) => {
    e.preventDefault()
    let cur = from
    setDrag(from)
    const onMove = (ev: PointerEvent) => {
      const centers = rows.current.map((r) => (r ? r.getBoundingClientRect().top + r.offsetHeight / 2 : 0))
      let target = cur
      centers.forEach((y, i) => { if (ev.clientY > y && i > target) target = i; if (ev.clientY < y && i < target) target = i })
      if (target !== cur) { setItems((l) => move(l, cur, target)); cur = target; setDrag(target) }
    }
    const onUp = () => { setDrag(null); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const save = async () => {
    const now = new Date().toISOString()
    const w: Workout = { id: existing?.id ?? newId(), name: name.trim() || 'Séance sans nom', items, isExpress: express, createdAt: existing?.createdAt ?? now, updatedAt: now }
    await db.workouts.put(w)
    nav('/bibliotheque')
  }

  return (
    <Screen title={id === 'nouvelle' ? 'Nouvelle séance' : 'Modifier la séance'}>
      <div className={c.composer}>
        <section aria-label="Exercices disponibles" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className={c.field}>Recherche<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom de l'exercice" /></label>
          <div className={c.chips} role="group" aria-label="Filtrer par zone du corps">
            {TAGS.map((t) => <button key={t} type="button" aria-pressed={tag === t} className={[c.chip, tag === t ? c.chipOn : ''].join(' ')} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
          </div>
          {exercises.length === 0 && <p className={s.empty}>Aucun exercice. Importe d'abord une vidéo.</p>}
          <div className={c.exList}>
            {shown.map((e) => {
              const planned = Math.min(Math.round(e.endSec - e.startSec), 120) || DEFAULT_ITEM_SEC
              return (
                <div key={e.id} className={c.ex}>
                  <Thumb id={e.thumbId} youtubeId={ytOf.get(e.sourceId)} className={c.exThumb} />
                  <div className={c.exMain}><span className={c.exName} style={{ display: 'block' }}>{e.name}</span><span className={c.meta}>{Math.round(e.endSec - e.startSec)} s{e.tags.length ? ` · ${e.tags.join(', ')}` : ''}</span></div>
                  <Button className={c.small} aria-label={`Ajouter ${e.name}`} onClick={() => setItems((l) => [...l, { exerciseId: e.id, durationSec: Math.max(5, Math.min(planned, DEFAULT_ITEM_SEC)), restAfterSec: 0 }])}>Ajouter</Button>
                </div>
              )
            })}
          </div>
        </section>

        <section aria-label="Séance en cours de composition" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className={c.field}>Nom de la séance<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className={s.actions} style={{ justifyContent: 'space-between' }}>
            <span className={c.total} aria-live="polite">{formatDuration(workoutDurationSec(items))}</span>
            <Button aria-pressed={express} onClick={() => setExpress(!express)}>{express ? 'Séance express' : 'Marquer comme express'}</Button>
          </div>
          {items.length === 0 && <p className={s.empty}>Ajoute des exercices depuis la liste.</p>}
          {items.map((it, i) => {
            const ex = byId.get(it.exerciseId)
            return (
              <div key={`${it.exerciseId}-${i}`} ref={(el) => { rows.current[i] = el }} className={[c.item, drag === i ? c.itemDrag : ''].join(' ')}>
                <div className={c.itemTop}>
                  <button type="button" className={c.grip} aria-label={`Glisser pour déplacer ${ex?.name ?? 'cet exercice'}`} onPointerDown={(e) => startDrag(e, i)}><GripVertical size={22} aria-hidden="true" /></button>
                  <Thumb id={ex?.thumbId} youtubeId={ex ? ytOf.get(ex.sourceId) : undefined} className={c.exThumb} />
                  <div className={c.exMain}><span className={c.exName} style={{ display: 'block' }}>{ex?.name ?? 'Exercice supprimé'}</span>{!ex && <span className={c.meta}>Il sera sauté à la lecture.</span>}</div>
                  <IconButton label="Monter" disabled={i === 0} onClick={() => setItems((l) => move(l, i, i - 1))}><ArrowUp size={20} aria-hidden="true" /></IconButton>
                  <IconButton label="Descendre" disabled={i === items.length - 1} onClick={() => setItems((l) => move(l, i, i + 1))}><ArrowDown size={20} aria-hidden="true" /></IconButton>
                  <IconButton label={`Retirer ${ex?.name ?? 'cet exercice'}`} onClick={() => setItems((l) => l.filter((_, k) => k !== i))}><Trash2 size={20} aria-hidden="true" /></IconButton>
                </div>
                <div className={c.steppers}>
                  <Stepper label="Durée" value={it.durationSec} min={5} max={300} step={5} unit="s" onChange={(v) => patch(i, { durationSec: v })} />
                  <Stepper label="Repos après" value={it.restAfterSec} min={0} max={60} step={5} unit="s" onChange={(v) => patch(i, { restAfterSec: v })} />
                </div>
              </div>
            )
          })}
          <div className={s.actions}>
            <Button variant="primary" disabled={items.length === 0} onClick={() => void save()}>Enregistrer la séance</Button>
            <Button onClick={() => nav('/bibliotheque')}>Annuler</Button>
          </div>
        </section>
      </div>
    </Screen>
  )
}
