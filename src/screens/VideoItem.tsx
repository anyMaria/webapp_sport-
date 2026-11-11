import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { db } from '../data/db'
import { deleteSourceRecords, workoutsUsingSource } from '../data/sources'
import { removeVideoFile, formatBytes } from '../data/opfs'
import { saveSegments } from '../import/saveExercises'
import { formatTime, wholeVideo } from '../import/segments'
import { originText, type VideoSource } from '../data/types'
import s from '../app/app.module.css'
import c from './importScreen.module.css'

const SHORT_SEC = 90

/** Titre modifiable : s'enregistre en quittant le champ ou avec Entrée. */
function NameField({ source }: { source: VideoSource }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const t = (draft ?? source.title).trim()
    if (t && t !== source.title) void db.sources.update(source.id, { title: t })
    setDraft(null)
  }
  return (
    <input
      className={c.name}
      value={draft ?? source.title}
      aria-label="Nom de la vidéo"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

/** Une vidéo : nom modifiable, état (brouillon, découpée), découper, supprimer. */
export function VideoItem({ src, exerciseCount, fresh = false, onDeleted }: { src: VideoSource; exerciseCount: number; fresh?: boolean; onDeleted?: (id: string) => void }) {
  const nav = useNavigate()
  const [toDelete, setToDelete] = useState<string[] | null>(null)
  const n = exerciseCount
  const short = src.kind === 'file' && src.durationSec < SHORT_SEC
  const draft = n === 0 && !!src.draftSegs
  const meta = [originText(src), src.author, src.durationSec ? formatTime(src.durationSec) : null, src.kind === 'file' ? formatBytes(src.sizeBytes ?? 0) : 'lien YouTube'].filter(Boolean).join(' · ')
  const state = n > 0 ? `${n} exercice${n > 1 ? 's' : ''}` : draft ? 'brouillon' : 'pas encore découpée'

  const askDelete = async () => setToDelete((await workoutsUsingSource(db, src.id)).map((w) => w.name))
  const confirmDelete = async () => {
    const { opfsPath } = await deleteSourceRecords(db, src.id)
    if (opfsPath) await removeVideoFile(opfsPath)
    onDeleted?.(src.id)
  }

  return (
    <div className={[c.item, fresh ? c.fresh : ''].join(' ')}>
      <div className={c.itemHead}>
        <NameField source={src} />
        {fresh && <span className={c.badge}>Nouvelle</span>}
        {draft && <span className={c.badge}>Brouillon</span>}
      </div>
      <span className={c.meta}>{meta} · {state}</span>
      {toDelete ? (
        <div role="alertdialog" aria-label="Supprimer la vidéo" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className={s.msg}>
            Supprimer « {src.title} » et ses exercices ?
            {toDelete.length > 0 && ` Séances touchées : ${toDelete.join(', ')}.`}
          </p>
          <div className={s.actions}>
            <Button variant="danger" onClick={() => void confirmDelete()}>Supprimer</Button>
            <Button onClick={() => setToDelete(null)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <div className={s.actions}>
          {n === 0 && short && !draft && <Button variant="primary" onClick={() => void saveSegments(src, wholeVideo(src.durationSec, src.title))}>Garder la vidéo entière</Button>}
          {n === 0 && <Button variant={short && !draft ? 'secondary' : 'primary'} onClick={() => nav(`/decoupage/${src.id}`)}>{draft ? 'Reprendre le découpage' : 'Découper'}</Button>}
          {n > 0 && <Button variant="primary" onClick={() => nav('/bibliotheque')}>Voir les exercices</Button>}
          <Button variant="danger" onClick={() => void askDelete()}>Supprimer</Button>
        </div>
      )}
    </div>
  )
}
