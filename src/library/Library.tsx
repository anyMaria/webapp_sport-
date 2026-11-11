import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play } from 'lucide-react'
import { db } from '../data/db'
import { Screen } from '../app/Screen'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Thumb } from './Thumb'
import { equipmentText, mergeEquipment } from './equipment'
import { deleteExercise, duplicateWorkout, formatDuration, inVideoOrder, workoutDurationSec } from './workouts'
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
  const [len, setLen] = useState<'' | 'short' | 'mid' | 'long'>('')
  const [confirm, setConfirm] = useState<{ kind: 'workout' | 'exercise'; id: string; name: string } | null>(null)

  const srcName = useMemo(() => new Map(sources.map((x) => [x.id, x.title])), [sources])
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const srcById = useMemo(() => new Map(sources.map((x) => [x.id, x])), [sources])
  const equipOf = (w: (typeof workouts)[number]) => equipmentText(mergeEquipment(w.items.map((i) => srcById.get(exById.get(i.exerciseId)?.sourceId ?? '')?.equipment)))
  const srcYt = useMemo(() => new Map(sources.map((x) => [x.id, x.youtubeId])), [sources])
  const allTags = useMemo(() => [...new Set([...TAGS, ...exercises.flatMap((e) => e.tags)])], [exercises])
  const lenOk = (e: (typeof exercises)[number]) => {
    const d = e.endSec - e.startSec
    return !len || (len === 'short' ? d < 30 : len === 'mid' ? d >= 30 && d <= 60 : d > 60)
  }
  const shown = exercises.filter((e) => (!tag || (tag === '__none' ? e.tags.length === 0 : e.tags.includes(tag))) && (!sourceId || e.sourceId === sourceId) && lenOk(e) && e.name.toLowerCase().includes(q.trim().toLowerCase()))
  const videosShown = sources.filter((v) => shown.some((e) => e.sourceId === v.id))

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
                {equipOf(w) ? <div className={c.meta}>{equipOf(w)}</div> : null}
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
          {allTags.map((t) => <button key={t} type="button" aria-pressed={tag === t} className={[c.chip, tag === t ? c.chipOn : ''].join(' ')} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
          <button type="button" aria-pressed={tag === '__none'} className={[c.chip, tag === '__none' ? c.chipOn : ''].join(' ')} onClick={() => setTag(tag === '__none' ? '' : '__none')}>sans zone</button>
        </div>
        <div className={c.chips} role="group" aria-label="Filtrer par durée">
          {([['short', 'Moins de 30 s'], ['mid', '30 à 60 s'], ['long', 'Plus d’une minute']] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={len === k} className={[c.chip, len === k ? c.chipOn : ''].join(' ')} onClick={() => setLen(len === k ? '' : k)}>{label}</button>
          ))}
        </div>
        {exercises.length === 0 && <p className={s.empty}>Aucun exercice. Importe une vidéo pour commencer.</p>}
        {exercises.length > 0 && shown.length === 0 && <p className={s.empty}>Aucun exercice ne correspond à ces filtres.</p>}
        <div className={c.exList}>
          {videosShown.map((v) => (
            <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className={c.groupHead}>
                <strong>{v.title}<span className={c.meta}> · {shown.filter((e) => e.sourceId === v.id).length} exercice{shown.filter((e) => e.sourceId === v.id).length > 1 ? 's' : ''}</span></strong>
                <div className={c.btnRow}>
                  <Button className={c.small} onClick={() => nav(`/nommer/${v.id}`)}>Renommer</Button>
                  <Button className={c.small} onClick={() => nav(`/composer/nouvelle?video=${v.id}`)}>Séance avec cette vidéo</Button>
                </div>
              </div>
              {inVideoOrder(shown.filter((e) => e.sourceId === v.id)).map((e) => (
                <div key={e.id} className={c.ex}>
                  <Thumb id={e.thumbId} youtubeId={srcYt.get(e.sourceId)} className={c.exThumb} />
                  <div className={c.exMain}>
                    <input className={c.exName} value={e.name} aria-label={`Nom de l'exercice ${e.name}`} onChange={(ev) => void db.exercises.update(e.id, { name: ev.target.value })} />
                    <span className={c.meta}>Dit à voix haute : « {e.name} »{e.cue ? ` puis « ${e.cue} »` : ''}</span>
                    <span className={c.meta}>{srcName.get(e.sourceId) ?? 'Vidéo supprimée'} · {formatTime(e.startSec)} – {formatTime(e.endSec)}{e.tags.length ? ` · ${e.tags.join(', ')}` : ''}</span>
                  </div>
                  <Button variant="danger" className={c.small} onClick={() => setConfirm({ kind: 'exercise', id: e.id, name: e.name })}>Supprimer</Button>
                </div>
              ))}
            </div>
          ))}
          {shown.filter((e) => !srcName.has(e.sourceId)).map((e) => (
            <div key={e.id} className={c.ex}><span className={c.exName}>{e.name}</span></div>
          ))}
        </div>
      </section>
    </Screen>
  )
}
