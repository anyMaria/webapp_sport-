import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from '../app/Screen'
import { Card, Row } from '../ui/Card'
import { Button } from '../ui/Button'
import { importVideoFile, newId } from '../data/importFile'
import { db } from '../data/db'
import { parseYouTubeId } from '../video/youtube'
import { saveSegments } from '../import/saveExercises'
import { wholeVideo } from '../import/segments'
import { formatBytes } from '../data/opfs'
import type { VideoSource } from '../data/types'
import ui from '../ui/ui.module.css'
import s from '../app/app.module.css'

const SHORT_SEC = 90
const ORIGINS: VideoSource['originLabel'][] = ['TikTok', 'YouTube', 'Autre']

interface Done { source: VideoSource; saved: boolean }

/** Entrée de l'import : un ou plusieurs fichiers. Un fichier court se garde entier en une touche. */
export function Import() {
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [origin, setOrigin] = useState<VideoSource['originLabel']>('TikTok')
  const [current, setCurrent] = useState<{ name: string; ratio: number } | null>(null)
  const [done, setDone] = useState<Done[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [link, setLink] = useState('')
  const [ytTitle, setYtTitle] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setErrors([])
    for (const file of Array.from(files)) {
      setCurrent({ name: file.name, ratio: 0 })
      try {
        const source = await importVideoFile(file, origin, (ratio) => setCurrent({ name: file.name, ratio }))
        setDone((d) => [...d, { source, saved: false }])
      } catch (e) {
        setErrors((x) => [...x, `${file.name} : ${(e as Error).message}`])
      }
    }
    setCurrent(null)
    if (input.current) input.current.value = ''
  }

  const addYouTube = async () => {
    const id = parseYouTubeId(link)
    if (!id) { setLinkError("Ce lien n'est pas reconnu. Colle l'adresse d'une vidéo YouTube."); return }
    const source: VideoSource = { id: newId(), kind: 'youtube', title: ytTitle.trim() || 'Vidéo YouTube', durationSec: 0, originLabel: 'YouTube', youtubeId: id, createdAt: new Date().toISOString() }
    await db.sources.put(source)
    nav(`/decoupage/${source.id}`)
  }

  const keepWhole = async (d: Done) => {
    await saveSegments(d.source, wholeVideo(d.source.durationSec, d.source.title))
    setDone((list) => list.map((x) => (x.source.id === d.source.id ? { ...x, saved: true } : x)))
  }

  return (
    <Screen title="Importer une vidéo" subtitle="Les fichiers restent sur cet iPad. Rien n'est téléchargé depuis YouTube ou TikTok.">
      <Card title="Origine des vidéos">
        <div className={s.actions} role="group" aria-label="Origine des vidéos">
          {ORIGINS.map((o) => (
            <Button key={o} aria-pressed={origin === o} className={origin === o ? ui.primary : ''} onClick={() => setOrigin(o)}>{o}</Button>
          ))}
        </div>
        <p className={s.empty}>Sert seulement à l'affichage sur les cartes de séances.</p>
        <div className={s.actions}>
          <Button variant="primary" disabled={!!current} onClick={() => input.current?.click()}>Choisir des fichiers vidéo</Button>
          <input ref={input} type="file" accept="video/*" multiple hidden aria-label="Choisir des fichiers vidéo" onChange={(e) => void importFiles(e.target.files)} />
        </div>
        {current && (
          <div role="status">
            <p className={s.msg}>Copie de {current.name}…</p>
            <progress value={current.ratio} max={1} style={{ width: '100%', height: 12 }} aria-label="Copie en cours" />
          </div>
        )}
        {errors.map((e) => <p key={e} role="alert" className={[s.msg, s.msgErr].join(' ')}>{e}</p>)}
      </Card>

      <Card title="Lien YouTube">
        <p className={s.empty}>La vidéo reste chez YouTube et se lit dans leur lecteur, avec une connexion. Rien n'est téléchargé.</p>
        <label className={ui.hint} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Lien de la vidéo
          <input value={link} onChange={(e) => { setLink(e.target.value); setLinkError(null) }} placeholder="https://youtu.be/…" inputMode="url" style={{ minHeight: 52, borderRadius: 14, border: '2px solid var(--border)', background: 'var(--bg-deep)', padding: '0 12px' }} />
        </label>
        <label className={ui.hint} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Nom (facultatif)
          <input value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} placeholder="Étirements du dos" style={{ minHeight: 52, borderRadius: 14, border: '2px solid var(--border)', background: 'var(--bg-deep)', padding: '0 12px' }} />
        </label>
        {linkError && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{linkError}</p>}
        <div className={s.actions}><Button variant="primary" onClick={() => void addYouTube()} disabled={!link.trim()}>Ajouter la vidéo</Button></div>
      </Card>

      {done.length > 0 && (
        <Card title="Vidéos importées">
          {done.map((d) => {
            const short = d.source.durationSec < SHORT_SEC
            return (
              <div key={d.source.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Row label={d.source.title} hint={`${Math.round(d.source.durationSec)} s · ${formatBytes(d.source.sizeBytes ?? 0)}`}>
                  {d.saved ? <span className={[s.msg, s.msgOk].join(' ')}>Enregistré</span> : null}
                </Row>
                {!d.saved && (
                  <div className={s.actions}>
                    {short && <Button variant="primary" onClick={() => void keepWhole(d)}>Garder la vidéo entière comme un exercice</Button>}
                    <Button variant={short ? 'secondary' : 'primary'} onClick={() => nav(`/decoupage/${d.source.id}`)}>Découper</Button>
                  </div>
                )}
              </div>
            )
          })}
          <div className={s.actions}>
            <Button onClick={() => nav('/bibliotheque')}>Voir la bibliothèque</Button>
          </div>
        </Card>
      )}
    </Screen>
  )
}
