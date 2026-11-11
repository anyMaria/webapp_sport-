import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Screen } from '../app/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { importVideoFile, newId } from '../data/importFile'
import { db } from '../data/db'
import { deleteSourceRecords, workoutsUsingSource } from '../data/sources'
import { removeVideoFile, formatBytes } from '../data/opfs'
import { parseYouTubeId } from '../video/youtube'
import { saveSegments } from '../import/saveExercises'
import { formatTime, wholeVideo } from '../import/segments'
import { originText, type VideoSource } from '../data/types'
import ui from '../ui/ui.module.css'
import s from '../app/app.module.css'
import c from './importScreen.module.css'

const SHORT_SEC = 90
type Origin = VideoSource['originLabel']
type Slot = 'social' | 'YouTube' | 'Autre'

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

/** Import : trois sources (TikTok, YouTube, autre). Les vidéos importées s'affichent juste en dessous. */
export function Import() {
  const nav = useNavigate()
  const inputs = useRef<Record<Slot, HTMLInputElement | null>>({ social: null, YouTube: null, Autre: null })
  const listTop = useRef<HTMLDivElement>(null)
  const [social, setSocial] = useState<'TikTok' | 'Instagram'>('TikTok')
  const [otherName, setOtherName] = useState('')
  const [current, setCurrent] = useState<{ name: string; ratio: number; origin: Origin } | null>(null)
  const [fresh, setFresh] = useState<string[]>([])
  const [info, setInfo] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [link, setLink] = useState('')
  const [ytTitle, setYtTitle] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<{ id: string; title: string; workouts: string[] } | null>(null)

  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? []
  const counts = useLiveQuery(async () => {
    const map: Record<string, number> = {}
    for (const e of await db.exercises.toArray()) map[e.sourceId] = (map[e.sourceId] ?? 0) + 1
    return map
  }, []) ?? {}
  const sorted = [...sources].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const importFiles = async (files: FileList | null, slot: Slot, origin: Origin, note?: string) => {
    if (!files?.length) return
    setErrors([])
    setInfo(null)
    let ok = 0
    const added: string[] = []
    for (const file of Array.from(files)) {
      setCurrent({ name: file.name, ratio: 0, origin })
      try {
        const source = await importVideoFile(file, origin, (ratio) => setCurrent({ name: file.name, ratio, origin }), note)
        added.push(source.id)
        ok++
      } catch (e) {
        setErrors((x) => [...x, `${file.name} : ${(e as Error).message}`])
      }
    }
    setCurrent(null)
    const input = inputs.current[slot]
    if (input) input.value = ''
    if (ok) {
      setFresh((f) => [...added, ...f])
      setInfo(ok === 1 ? 'Vidéo importée. Elle est juste en dessous.' : `${ok} vidéos importées. Elles sont juste en dessous.`)
      window.setTimeout(() => listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
  }

  const addYouTube = async () => {
    const id = parseYouTubeId(link)
    if (!id) { setLinkError("Ce lien n'est pas reconnu. Colle l'adresse d'une vidéo YouTube."); return }
    const source: VideoSource = { id: newId(), kind: 'youtube', title: ytTitle.trim() || 'Vidéo YouTube', durationSec: 0, originLabel: 'YouTube', youtubeId: id, createdAt: new Date().toISOString() }
    await db.sources.put(source)
    setLink(''); setYtTitle(''); setLinkError(null)
    setFresh((f) => [source.id, ...f])
    setInfo('Lien ajouté. Il est juste en dessous.')
    window.setTimeout(() => listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }

  const keepWhole = async (src: VideoSource) => {
    await saveSegments(src, wholeVideo(src.durationSec, src.title))
  }

  const askDelete = async (src: VideoSource) => {
    const workouts = (await workoutsUsingSource(db, src.id)).map((w) => w.name)
    setToDelete({ id: src.id, title: src.title, workouts })
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const { opfsPath } = await deleteSourceRecords(db, toDelete.id)
    if (opfsPath) await removeVideoFile(opfsPath)
    setFresh((f) => f.filter((x) => x !== toDelete.id))
    setToDelete(null)
  }

  const fileButton = (slot: Slot, origin: Origin, label: string, primary = false, note?: string) => (
    <>
      <Button variant={primary ? 'primary' : 'secondary'} disabled={!!current} onClick={() => inputs.current[slot]?.click()}>{label}</Button>
      <input ref={(el) => { inputs.current[slot] = el }} type="file" accept="video/*" multiple hidden aria-label={`${label} (${origin})`} onChange={(e) => void importFiles(e.target.files, slot, origin, note)} />
    </>
  )

  return (
    <Screen title="Importer une vidéo" subtitle="Choisis d'où vient ta vidéo. Les fichiers restent sur cet iPad.">
      <div className={c.sources}>
        <Card title="Réseaux sociaux">
          <div className={s.actions} role="group" aria-label="Réseau social">
            {(['TikTok', 'Instagram'] as const).map((o) => (
              <Button key={o} aria-pressed={social === o} className={social === o ? ui.primary : ''} onClick={() => setSocial(o)}>{o}</Button>
            ))}
          </div>
          <p className={s.empty}>Un lien {social} ne se lit pas dans une autre app. Enregistre d'abord la vidéo dans Photos, puis choisis le fichier ici.</p>
          <div className={s.actions}>{fileButton('social', social, 'Choisir des fichiers', true)}</div>
        </Card>

        <Card title="YouTube">
          <p className={s.empty}>Un lien se lit dans le lecteur YouTube, avec une connexion. Un fichier que tu as déjà se découpe automatiquement.</p>
          <label className={c.field}>Lien de la vidéo
            <input value={link} onChange={(e) => { setLink(e.target.value); setLinkError(null) }} placeholder="https://youtu.be/…" inputMode="url" />
          </label>
          {link.trim() && (
            <label className={c.field}>Nom (facultatif)
              <input value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} placeholder="Étirements du dos" />
            </label>
          )}
          {linkError && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{linkError}</p>}
          <div className={s.actions}>
            <Button variant="primary" onClick={() => void addYouTube()} disabled={!link.trim()}>Ajouter le lien</Button>
            {fileButton('YouTube', 'YouTube', 'Choisir des fichiers')}
          </div>
        </Card>

        <Card title="Autre">
          <label className={c.field}>Quelle source ?
            <input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Ex. coach, caméra, Facebook" />
          </label>
          <div className={s.actions}>{fileButton('Autre', 'Autre', 'Choisir des fichiers', false, otherName)}</div>
        </Card>
      </div>

      <div ref={listTop} style={{ scrollMarginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {current && (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className={s.msg}>Copie de {current.name}…</p>
            <progress value={current.ratio} max={1} style={{ width: '100%', height: 12 }} aria-label="Copie en cours" />
          </div>
        )}
        {info && !current && <p role="status" className={[s.msg, s.msgOk].join(' ')}>{info}</p>}
        {errors.map((e) => <p key={e} role="alert" className={[s.msg, s.msgErr].join(' ')}>{e}</p>)}

        <Card title={`Mes vidéos${sorted.length ? ` · ${sorted.length}` : ''}`}>
          {sorted.length === 0 && <p className={s.empty}>Aucune vidéo pour l'instant. Choisis une source ci-dessus.</p>}
          <div className={c.list}>
            {sorted.map((src) => {
              const n = counts[src.id] ?? 0
              const short = src.kind === 'file' && src.durationSec < SHORT_SEC
              const isFresh = fresh.includes(src.id)
              const meta = [originText(src), src.durationSec ? formatTime(src.durationSec) : null, src.kind === 'file' ? formatBytes(src.sizeBytes ?? 0) : 'lien YouTube'].filter(Boolean).join(' · ')
              return (
                <div key={src.id} className={[c.item, isFresh ? c.fresh : ''].join(' ')}>
                  <div className={c.itemHead}>
                    <NameField source={src} />
                    {isFresh && <span className={c.badge}>Nouvelle</span>}
                  </div>
                  <span className={c.meta}>{meta}{n > 0 ? ` · ${n} exercice${n > 1 ? 's' : ''}` : ' · pas encore découpée'}</span>
                  {toDelete?.id === src.id ? (
                    <div role="alertdialog" aria-label="Supprimer la vidéo" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p className={s.msg}>
                        Supprimer « {toDelete.title} » et ses exercices ?
                        {toDelete.workouts.length > 0 && ` Séances touchées : ${toDelete.workouts.join(', ')}.`}
                      </p>
                      <div className={s.actions}>
                        <Button variant="danger" onClick={() => void confirmDelete()}>Supprimer</Button>
                        <Button onClick={() => setToDelete(null)}>Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <div className={s.actions}>
                      {n === 0 && short && <Button variant="primary" onClick={() => void keepWhole(src)}>Garder la vidéo entière</Button>}
                      {n === 0 && <Button variant={short ? 'secondary' : 'primary'} onClick={() => nav(`/decoupage/${src.id}`)}>Découper</Button>}
                      {n > 0 && <Button variant="primary" onClick={() => nav('/bibliotheque')}>Voir les exercices</Button>}
                      <Button variant="danger" onClick={() => void askDelete(src)}>Supprimer</Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </Screen>
  )
}
