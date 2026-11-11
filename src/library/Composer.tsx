import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, GripVertical, Trash2, ListChecks } from 'lucide-react'
import { db } from '../data/db'
import { newId } from '../data/importFile'
import type { Workout, WorkoutItem } from '../data/types'
import { Screen } from '../app/Screen'
import { Button, IconButton } from '../ui/Button'
import { Stepper } from '../ui/Stepper'
import { Thumb } from './Thumb'
import { TAGS } from '../screens/Split'
import { applyRhythm, formatDuration, inVideoOrder, itemFor, move, naturalDurationSec, removeRun, workoutDurationSec } from './workouts'
import c from './library.module.css'
import ui from '../ui/ui.module.css'
import s from '../app/app.module.css'

/** Composition : une séance se construit à partir de vidéos entières (ou d'exercices choisis dedans), puis se règle à son rythme. */
export function Composer() {
  const { id = 'nouvelle' } = useParams()
  const [params] = useSearchParams()
  const video = params.get('video') ?? ''
  const existing = useLiveQuery(async () => (id === 'nouvelle' ? null : ((await db.workouts.get(id)) ?? null)), [id])
  const preset = useLiveQuery(async () => {
    if (!video) return null
    const src = await db.sources.get(video)
    if (!src) return null
    const exs = inVideoOrder(await db.exercises.where('sourceId').equals(video).toArray())
    return { name: src.title, items: exs.map(itemFor) }
  }, [video])
  if (existing === undefined || preset === undefined) return null
  return <ComposerEditor key={`${id}-${video}`} id={id} existing={existing ?? undefined} preset={preset ?? undefined} />
}

const NONE: never[] = []

function ComposerEditor({ id, existing, preset }: { id: string; existing?: Workout; preset?: { name: string; items: WorkoutItem[] } }) {
  const nav = useNavigate()
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? NONE
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? NONE
  const ytOf = new Map(sources.map((x) => [x.id, x.youtubeId]))
  const [name, setName] = useState(existing?.name ?? preset?.name ?? 'Nouvelle séance')
  const [items, setItems] = useState<WorkoutItem[]>(existing?.items ?? preset?.items ?? [])
  const [express, setExpress] = useState(existing?.isExpress ?? false)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [open, setOpen] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkDur, setBulkDur] = useState(30)
  const [bulkRest, setBulkRest] = useState(0)
  const [drag, setDrag] = useState<number | null>(null)
  const rows = useRef<(HTMLDivElement | null)[]>([])

  const byId = new Map(exercises.map((e) => [e.id, e]))
  const srcTitle = new Map(sources.map((x) => [x.id, x.title]))
  const sourceOf = (exId: string) => byId.get(exId)?.sourceId
  const matches = (e: (typeof exercises)[number]) => (!tag || e.tags.includes(tag)) && e.name.toLowerCase().includes(q.trim().toLowerCase())
  const add = (list: typeof exercises) => setItems((l) => [...l, ...inVideoOrder(list).map(itemFor)])
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
          {sources.length > 0 && <p className={ui.hint} style={{ margin: 0 }}>Choisis une vidéo : elle s'ajoute avec tous ses exercices, dans l'ordre. Tu peux aussi ne prendre que certains exercices.</p>}
          <div className={c.exList}>
            {sources.map((v) => {
              const all = inVideoOrder(exercises.filter((e) => e.sourceId === v.id))
              const visible = all.filter(matches)
              if (visible.length === 0) return null
              const total = all.reduce((n, e) => n + itemFor(e).durationSec, 0)
              const isOpen = open === v.id
              const sel = visible.filter((e) => picked.has(e.id))
              return (
                <div key={v.id} className={c.videoCard}>
                  <div className={c.exMain}>
                    <span className={c.exName} style={{ display: 'block' }}>{v.title}</span>
                    <span className={c.meta}>{all.length} exercice{all.length > 1 ? 's' : ''} · {formatDuration(total)}{v.author ? ` · ${v.author}` : ''}</span>
                  </div>
                  <div className={c.btnRow}>
                    <Button variant="primary" className={c.small} aria-label={`Ajouter la vidéo entière ${v.title}`} onClick={() => add(all)}>Ajouter la vidéo</Button>
                    <Button className={c.small} aria-pressed={isOpen} onClick={() => { setOpen(isOpen ? '' : v.id); setPicked(new Set()) }}><ListChecks size={18} aria-hidden="true" />Choisir les exercices</Button>
                  </div>
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {visible.map((e) => (
                        <label key={e.id} className={c.pickRow}>
                          <input type="checkbox" checked={picked.has(e.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n })} />
                          <Thumb id={e.thumbId} youtubeId={ytOf.get(e.sourceId)} className={c.exThumb} />
                          <span className={c.exMain}><span className={c.exName} style={{ display: 'block' }}>{e.name}</span><span className={c.meta}>{Math.round(e.endSec - e.startSec)} s{e.tags.length ? ` · ${e.tags.join(', ')}` : ''}</span></span>
                        </label>
                      ))}
                      <div className={c.btnRow}>
                        <Button className={c.small} onClick={() => setPicked(new Set(visible.map((e) => e.id)))}>Tout cocher</Button>
                        <Button variant="primary" className={c.small} disabled={sel.length === 0} onClick={() => { add(sel); setPicked(new Set()) }}>Ajouter la sélection ({sel.length})</Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {exercises.length > 0 && shown.length === 0 && <p className={s.empty}>Aucun exercice ne correspond à ces filtres.</p>}
          </div>
        </section>

        <section aria-label="Séance en cours de composition" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className={c.field}>Nom de la séance<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className={s.actions} style={{ justifyContent: 'space-between' }}>
            <span className={c.total} aria-live="polite">{formatDuration(workoutDurationSec(items))}</span>
            <Button aria-pressed={express} onClick={() => setExpress(!express)}>{express ? 'Séance express' : 'Marquer comme express'}</Button>
          </div>
          {items.length === 0 && <p className={s.empty}>Ajoute une vidéo depuis la liste.</p>}
          {items.length > 0 && (
            <div className={c.item}>
              <span className={ui.label}>Ton rythme pour toute la séance</span>
              <div className={c.steppers}>
                <Stepper label="Durée de chaque exercice" value={bulkDur} min={5} max={300} step={5} unit="s" onChange={setBulkDur} />
                <Stepper label="Repos après chaque exercice" value={bulkRest} min={0} max={60} step={5} unit="s" onChange={setBulkRest} />
              </div>
              <div className={c.btnRow}>
                <Button className={c.small} onClick={() => setItems((l) => applyRhythm(l, bulkDur, bulkRest))}>Appliquer à tous</Button>
                <Button className={c.small} onClick={() => setItems((l) => l.map((i) => { const e = byId.get(i.exerciseId); return e ? { ...i, durationSec: naturalDurationSec(e) } : i }))}>Durée de chaque extrait</Button>
              </div>
            </div>
          )}
          {items.map((it, i) => {
            const ex = byId.get(it.exerciseId)
            const src = ex?.sourceId
            const head = src !== undefined && (i === 0 || sourceOf(items[i - 1]!.exerciseId) !== src)
            return (
              <div key={`${it.exerciseId}-${i}`} style={{ display: 'contents' }}>
              {head && (
                <div className={c.groupHead}>
                  <strong>{srcTitle.get(src) ?? 'Vidéo'}</strong>
                  <Button className={c.small} onClick={() => setItems((l) => removeRun(l, i, sourceOf))}>Retirer la vidéo</Button>
                </div>
              )}
              <div ref={(el) => { rows.current[i] = el }} className={[c.item, drag === i ? c.itemDrag : ''].join(' ')}>
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
