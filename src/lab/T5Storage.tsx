import { useEffect, useState } from 'react'
import { Btn, Field, fmtBytes, Log, TestCard, useLog } from './ui'
import s from './lab.module.css'

const META = 'lab:t5:file'
interface Meta { name: string; size: number; at: string }

function readMeta(): Meta | null {
  try { return JSON.parse(localStorage.getItem(META) ?? 'null') as Meta | null } catch { return null }
}

export function T5Storage() {
  const { lines, add, clear } = useLog()
  const [meta, setMeta] = useState<Meta | null>(readMeta)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const report = async () => {
    try {
      const persisted = (await navigator.storage.persist?.()) ?? false
      add(`storage.persist() → ${persisted ? 'accordé' : 'refusé'}`)
      const est = await navigator.storage.estimate()
      add(`estimate() : utilisé ${fmtBytes(est.usage ?? 0)} sur quota ${fmtBytes(est.quota ?? 0)}`)
    } catch (e) {
      add(`Erreur storage : ${(e as Error).message}`)
    }
  }

  const writeWithWorker = (file: File, name: string) =>
    new Promise<void>((resolve, reject) => {
      const w = new Worker(new URL('./opfsWorker.ts', import.meta.url), { type: 'module' })
      let last = 0
      w.onmessage = (e: MessageEvent<{ progress?: number; done?: boolean; error?: string }>) => {
        if (e.data.error) { w.terminate(); reject(new Error(e.data.error)) }
        else if (e.data.done) { w.terminate(); resolve() }
        else if (e.data.progress && e.data.progress - last > 25e6) { last = e.data.progress; add(`…${fmtBytes(last)}`) }
      }
      w.postMessage({ file, name })
    })

  const save = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    const name = `lab-${file.name}`
    add(`Import de ${file.name} (${fmtBytes(file.size)}) dans OPFS…`)
    const t0 = performance.now()
    try {
      const root = await navigator.storage.getDirectory()
      const fh = await root.getFileHandle(name, { create: true })
      if ('createWritable' in fh) {
        add('Méthode : createWritable (flux)')
        const writable = await (fh as FileSystemFileHandle & { createWritable(): Promise<WritableStream> }).createWritable()
        await file.stream().pipeTo(writable)
      } else {
        add('createWritable absent, repli sur un worker (createSyncAccessHandle)')
        await writeWithWorker(file, name)
      }
      add(`Écrit en ${((performance.now() - t0) / 1000).toFixed(1)} s`)
      const m = { name, size: file.size, at: new Date().toISOString() }
      localStorage.setItem(META, JSON.stringify(m))
      setMeta(m)
      await report()
    } catch (e) {
      add(`Échec : ${(e as Error).name} ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const reread = async () => {
    const m = readMeta()
    if (!m) { add('Aucun fichier enregistré par ce test.'); return }
    try {
      const root = await navigator.storage.getDirectory()
      const f = await (await root.getFileHandle(m.name)).getFile()
      add(`Fichier retrouvé : ${f.name}, ${fmtBytes(f.size)} (attendu ${fmtBytes(m.size)}). Enregistré le ${new Date(m.at).toLocaleString('fr-FR')}.`)
      add(f.size === m.size ? 'Taille identique : OK.' : 'TAILLE DIFFÉRENTE : échec.')
      const tail = new Uint8Array(await f.slice(Math.max(0, f.size - 1024)).arrayBuffer())
      add(`Lecture de la fin du fichier : ${tail.length} octets lus.`)
      setUrl(URL.createObjectURL(f))
      add('Lecture vidéo ci-dessous (URL.createObjectURL).')
    } catch (e) {
      add(`Fichier introuvable : ${(e as Error).name} ${(e as Error).message}`)
    }
  }

  const remove = async () => {
    const m = readMeta()
    if (!m) return
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(m.name).catch(() => undefined)
    localStorage.removeItem(META)
    setMeta(null)
    setUrl(null)
    add('Fichier supprimé.')
  }

  return (
    <TestCard
      id="t5"
      num={5}
      title="Stockage des vidéos"
      how="Importe une vidéo d'environ 150 Mo. Ferme complètement l'app (balaye-la dans le sélecteur d'apps), rouvre-la, reviens ici et touche « Relire ». Refais-le le lendemain."
      passIf="Le fichier se relit après fermeture complète de l'app, le lendemain aussi."
      planB="Blobs dans IndexedDB, et alerte quand l'espace manque."
    >
      <div className={s.row}>
        <Field label="Vidéo à importer (~150 Mo)">
          <input type="file" accept="video/*" disabled={busy} onChange={(e) => void save(e.target.files?.[0])} />
        </Field>
      </div>
      <p className={s.muted}>
        {meta ? `Fichier présent : ${meta.name}, ${fmtBytes(meta.size)}, importé le ${new Date(meta.at).toLocaleString('fr-FR')}.` : 'Aucun fichier importé.'}
      </p>
      <div className={s.actions}>
        <Btn primary onClick={() => void reread()} disabled={!meta}>Relire le fichier</Btn>
        <Btn onClick={() => void report()}>Espace disponible</Btn>
        <Btn onClick={() => void remove()} disabled={!meta}>Supprimer</Btn>
        <Btn onClick={clear}>Effacer</Btn>
      </div>
      {url && <video className={s.video} src={url} controls muted playsInline />}
      <Log lines={lines} />
    </TestCard>
  )
}
