import { db } from './db'
import { writeVideoFile, removeVideoFile } from './opfs'
import { assertSpaceFor, friendlyWriteError } from './space'
import type { VideoSource } from './types'

export const newId = () => crypto.randomUUID()

export interface VideoMeta {
  durationSec: number
  width: number
  height: number
}

/** Lit durée et dimensions sans charger le fichier en mémoire. */
export function probeVideo(file: Blob): Promise<VideoMeta> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.preload = 'metadata'
  v.muted = true
  return new Promise<VideoMeta>((resolve, reject) => {
    v.onloadedmetadata = () => resolve({ durationSec: v.duration, width: v.videoWidth, height: v.videoHeight })
    v.onerror = () => reject(new Error('Cette vidéo ne se lit pas sur cet appareil.'))
    v.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

/** Vignette JPEG (largeur 320) prise à une position donnée. */
export function makeThumb(file: Blob, atSec: number): Promise<Blob> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  return new Promise<Blob>((resolve, reject) => {
    v.onloadedmetadata = () => { v.currentTime = Math.min(Math.max(0, atSec), Math.max(0, v.duration - 0.1)) }
    v.onseeked = () => {
      const w = 320
      const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(v, 0, 0, w, h)
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Vignette impossible'))), 'image/jpeg', 0.8)
    }
    v.onerror = () => reject(new Error('Vignette impossible'))
    v.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

/** Importe un fichier vidéo : copie dans OPFS (avec progression) puis crée la source. En cas d'échec, rien ne reste. */
export async function importVideoFile(file: File, originLabel: VideoSource['originLabel'], onProgress?: (ratio: number) => void, originNote?: string): Promise<VideoSource> {
  await assertSpaceFor(file.size)
  const meta = await probeVideo(file)
  const id = newId()
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'mp4'
  const opfsPath = `${id}.${ext || 'mp4'}`
  try {
    await writeVideoFile(file, opfsPath, onProgress)
  } catch (e) {
    await removeVideoFile(opfsPath)
    throw new Error(friendlyWriteError(e), { cause: e })
  }
  // Vignette pour reconnaître la vidéo dans les listes. Un échec ne bloque pas l'import.
  let thumbId: string | undefined
  try {
    const blob = await makeThumb(file, Math.min(1, meta.durationSec / 2))
    thumbId = newId()
    await db.thumbs.put({ id: thumbId, blob })
  } catch {
    thumbId = undefined
  }
  const source: VideoSource = {
    id, kind: 'file', title: file.name.replace(/\.[^.]+$/, ''), durationSec: meta.durationSec,
    originLabel, originNote: originNote?.trim() || undefined, opfsPath, sizeBytes: file.size, thumbId, createdAt: new Date().toISOString(),
  }
  await db.sources.put(source)
  return source
}
