import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, loadSettings, saveSettings } from '../data/db'
import { DEFAULT_SETTINGS } from '../data/settings'
import { BackupError, exportBackup, parseBackup, restoreBackup, type BackupFile } from '../data/backup'
import { deleteSourceRecords, workoutsUsingSource } from '../data/sources'
import { formatBytes, readStorageInfo, removeVideoFile, requestPersist, type StorageInfo } from '../data/opfs'
import { playBeep, speak } from '../audio/beep'
import { Screen } from '../app/Screen'
import { Card, Row } from '../ui/Card'
import { Button } from '../ui/Button'
import { Stepper } from '../ui/Stepper'
import ui from '../ui/ui.module.css'
import s from '../app/app.module.css'

function useFrenchVoices() {
  const [voices, setVoices] = useState<string[]>([])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => setVoices(speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr')).map((v) => v.name))
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])
  return voices
}

type Msg = { kind: 'ok' | 'err'; text: string } | null

export function Settings() {
  const settings = useLiveQuery(() => loadSettings(), []) ?? DEFAULT_SETTINGS
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? []
  const voices = useFrenchVoices()
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [toDelete, setToDelete] = useState<{ id: string; title: string; workouts: string[] } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refreshStorage = () => void readStorageInfo().then(setStorage)
  useEffect(refreshStorage, [sources.length])

  const exportFile = async () => {
    const data = await exportBackup(db)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg({ kind: 'ok', text: 'Sauvegarde créée. Les vidéos ne sont pas incluses.' })
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
      setMsg(null)
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof BackupError ? e.message : 'Lecture impossible.' })
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const confirmRestore = async () => {
    if (!pending) return
    try {
      await restoreBackup(db, pending)
      setMsg({ kind: 'ok', text: 'Sauvegarde restaurée.' })
    } catch {
      setMsg({ kind: 'err', text: 'La restauration a échoué. Tes données actuelles n’ont pas changé.' })
    }
    setPending(null)
  }

  const askDelete = async (id: string, title: string) => {
    const workouts = (await workoutsUsingSource(db, id)).map((w) => w.name)
    setToDelete({ id, title, workouts })
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const { opfsPath } = await deleteSourceRecords(db, toDelete.id)
    if (opfsPath) await removeVideoFile(opfsPath)
    setToDelete(null)
    refreshStorage()
  }

  const testSound = async () => {
    await playBeep(settings.beepVolume)
    if (settings.audioMode === 'music+beeps+voice') speak('Ensuite : Rotation du buste, quarante-cinq secondes.', settings.voiceName)
  }

  return (
    <Screen title="Réglages" subtitle="Tout reste sur cet iPad.">
      <div className={s.grid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Son">
            <Row label="Volume des bips">
              <input className={ui.range} type="range" min={0} max={1} step={0.05} value={settings.beepVolume} aria-label="Volume des bips" onChange={(e) => void saveSettings({ beepVolume: Number(e.target.value) })} />
            </Row>
            <Row label="Voix des consignes" hint={voices.length ? undefined : 'Aucune voix française trouvée sur cet appareil.'}>
              <select className={ui.select} aria-label="Voix des consignes" value={settings.voiceName ?? ''} onChange={(e) => void saveSettings({ voiceName: e.target.value || undefined })}>
                <option value="">Voix par défaut</option>
                {voices.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Row>
            <div className={s.actions}>
              <Button onClick={() => void testSound()}>Tester le son</Button>
            </div>
          </Card>

          <Card title="Séance">
            <Row label="Décompte entre exercices">
              <Stepper label="Durée du décompte" value={settings.countdownSec} min={3} max={15} unit="s" onChange={(v) => void saveSettings({ countdownSec: v })} />
            </Row>
            <Row label="Durée de « Encore »">
              <Stepper label="Durée de Encore" value={settings.extendSec} min={15} max={120} step={15} unit="s" onChange={(v) => void saveSettings({ extendSec: v })} />
            </Row>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Données">
            <Row label="Espace utilisé" hint={storage ? (storage.persisted ? 'Stockage protégé par l’appareil.' : 'Stockage non protégé : iOS peut le vider si l’espace manque.') : undefined}>
              <span style={{ fontFamily: 'var(--font-title)', fontWeight: 600, fontSize: 20 }}>{storage ? `${formatBytes(storage.usage)} sur ${formatBytes(storage.quota)}` : '…'}</span>
            </Row>
            {storage && !storage.persisted && (
              <div className={s.actions}>
                <Button onClick={() => void requestPersist().then(refreshStorage)}>Protéger mes données</Button>
              </div>
            )}

            <div className={s.actions}>
              <Button variant="primary" onClick={() => void exportFile()}>Sauvegarder</Button>
              <Button onClick={() => fileInput.current?.click()}>Restaurer</Button>
              <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void chooseFile(e.target.files?.[0])} aria-label="Choisir un fichier de sauvegarde" />
            </div>
            {pending && (
              <div role="alertdialog" aria-label="Confirmer la restauration" className={s.actions} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <p className={s.msg}>
                  Remplacer toutes tes données par cette sauvegarde du {new Date(pending.exportedAt).toLocaleDateString('fr-FR')} ({pending.exercises.length} exercices, {pending.workouts.length} séances) ?
                </p>
                <div className={s.actions}>
                  <Button variant="danger" onClick={() => void confirmRestore()}>Remplacer</Button>
                  <Button onClick={() => setPending(null)}>Annuler</Button>
                </div>
              </div>
            )}
            {msg && <p role="status" className={[s.msg, msg.kind === 'ok' ? s.msgOk : s.msgErr].join(' ')}>{msg.text}</p>}
          </Card>

          <Card title="Mes vidéos">
            {sources.length === 0 && <p className={s.empty}>Aucune vidéo importée pour l'instant.</p>}
            {sources.map((src) => (
              <Row key={src.id} label={src.title} hint={`${src.originLabel}${src.sizeBytes ? ` · ${formatBytes(src.sizeBytes)}` : ''}`}>
                <Button variant="danger" onClick={() => void askDelete(src.id, src.title)}>Supprimer</Button>
              </Row>
            ))}
            {toDelete && (
              <div role="alertdialog" aria-label="Confirmer la suppression" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className={s.msg}>
                  Supprimer « {toDelete.title} » et tous ses exercices ?
                  {toDelete.workouts.length > 0 && ` Séances touchées : ${toDelete.workouts.join(', ')}.`}
                </p>
                <div className={s.actions}>
                  <Button variant="danger" onClick={() => void confirmDelete()}>Supprimer</Button>
                  <Button onClick={() => setToDelete(null)}>Annuler</Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Avancé">
            <Link to="/lab" style={{ color: 'var(--effort)', fontWeight: 600 }}>Page de tests (/lab)</Link>
          </Card>
        </div>
      </div>
    </Screen>
  )
}
