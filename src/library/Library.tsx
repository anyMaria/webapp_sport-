import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play } from 'lucide-react'
import { db } from '../data/db'
import { Screen } from '../app/Screen'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Thumb } from './Thumb'
import { deleteExercise, duplicateWorkout, formatDuration, workoutDurationSec } from './workouts'
import { TAGS } from '../screens/Split'
import { formatTime } from '../import/segments'
import c from './library.module.css'
import s from '../app/app.module.css'

const NONE: never[] = []

/** Bibliothèque : séances sauvegardées et tous les exercices, filtrables par tag, vidéo d'origine et nom. */
export function Library() {
  const nav = useNavigate()
  const workouts = useLiveQuery(() => db.workouts.orderBy('updatedAt').reverse().toArray(), []) ?? NONE
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? NONE
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? NONE
  const [tag, setTag] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState<{ kind: 'workout' | 'exercise'; id: string; name: string } | null>(null)

  const srcName = useMemo(() => new Map(sources.map((x) => [x.id, x.title])), [sources])
  const shown = exercises.filter((e) => (!tag || e.tags.includes(tag)) && (!sourceId || e.sourceId === sourceId) && e.name.toLowerCase().includes(q.trim().toLowerCase()))

  const doDelete = async () => {
    if (!confirm) return
    if (confirm.kind === 'workout') await db.workouts.delete(confirm.id)
    else await deleteExercise(confirm.id)
    setConfirm(null)
  }

  return (
    <Screen title="Bibliothèque" subtitle="Tes séances et tous tes exercices.">
      <div className={s.actions}>
        <Button variant="primary" onClick={() => nav('/composer/nouvelle')} disabled={exercises.length === 0}>Nouvelle séance</Button>
        <Button onClick={() => nav('/import')}>Importer une vidéo</Button>
      </div>

      {confirm && (
        <Card>
          <div role="alertdialog" aria-label="Confirmer la suppression" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className={s.msg}>Supprimer « {confirm.name} » ?{confirm.kind === 'exercise' ? ' Les séances qui l’utilisent le sauteront.' : ''}</p>
            <div className={s.actions}>
              <Button variant="danger" onClick={() => void doDelete()}>Supprimer</Button>
              <Button onClick={() => setConfirm(null)}>Annuler</Button>
            </div>
          </div>
        </Card>
      )}

      <section aria-labelledby="ws-h" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="ws-h" style={{ fontSize: 24 }}>Mes séances</h2>
        {workouts.length === 0 && <p className={s.empty}>Aucune séance pour l'instant. Importe une vidéo, découpe-la, puis compose ta première séance.</p>}
        <div className={c.cards}>
          {workouts.map((w) => (
            <article key={w.id} className={c.wcard}>
              <div>
                <span className={c.wname}>{w.name}</span>{w.isExpress && <span className={c.badge}>Express</span>}
                <div className={c.meta}>{formatDuration(workoutDurationSec(w.items))} · {w.items.length} exercice{w.items.length > 1 ? 's' : ''}</div>
              </div>
              <div className={c.btnRow}>
                <Button variant="primary" className={c.small} onClick={() => nav(`/seance/${w.id}`)}><Play size={18} fill="currentColor" aria-hidden="true" />Lancer</Button>
                <Button className={c.small} onClick={() => nav(`/composer/${w.id}`)}>Modifier</Button>
                <Button className={c.small} onClick={() => void duplicateWorkout(w.id)}>Dupliquer</Button>
                <Button className={c.small} aria-pressed={w.isExpress} onClick={() => void db.workouts.update(w.id, { isExpress: !w.isExpress, updatedAt: new Date().toISOString() })}>{w.isExpress ? 'Retirer express' : 'Marquer express'}</Button>
                <Button variant="danger" className={c.small} onClick={() => setConfirm({ kind: 'workout', id: w.id, name: w.name })}>Supprimer</Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ex-h" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="ex-h" style={{ fontSize: 24 }}>Exercices</h2>
        <div className={c.filters}>
          <label className={c.field}>Recherche<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom de l'exercice" /></label>
          <label className={c.field}>Vidéo d'origine
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Toutes</option>
              {sources.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </label>
        </div>
        <div className={c.chips} role="group" aria-label="Filtrer par zone du corps">
          {TAGS.map((t) => <button key={t} type="button" aria-pressed={tag === t} className={[c.chip, tag === t ? c.chipOn : ''].join(' ')} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
        </div>
        {exercises.length === 0 && <p className={s.empty}>Aucun exercice. Importe une vidéo pour commencer.</p>}
        {exercises.length > 0 && shown.length === 0 && <p className={s.empty}>Aucun exercice ne correspond à ces filtres.</p>}
        <div className={c.exList}>
          {shown.map((e) => (
            <div key={e.id} className={c.ex}>
              <Thumb id={e.thumbId} className={c.exThumb} />
              <div className={c.exMain}>
                <input className={c.exName} value={e.name} aria-label={`Nom de l'exercice ${e.name}`} onChange={(ev) => void db.exercises.update(e.id, { name: ev.target.value })} />
                <span className={c.meta}>{srcName.get(e.sourceId) ?? 'Vidéo supprimée'} · {formatTime(e.startSec)} – {formatTime(e.endSec)}{e.tags.length ? ` · ${e.tags.join(', ')}` : ''}</span>
              </div>
              <Button variant="danger" className={c.small} onClick={() => setConfirm({ kind: 'exercise', id: e.id, name: e.name })}>Supprimer</Button>
            </div>
          ))}
        </div>
      </section>
    </Screen>
  )
}
