import type { AppDB } from './db'

export const BACKUP_VERSION = 1

interface ThumbDump {
  id: string
  type: string
  base64: string
}

/** Sauvegarde : tout sauf les fichiers vidéo (ils restent dans OPFS). */
export interface BackupFile {
  app: 'webapp-sport'
  version: number
  exportedAt: string
  sources: unknown[]
  exercises: unknown[]
  workouts: unknown[]
  sessionLogs: unknown[]
  stickerUnlocks: unknown[]
  jokerUses: unknown[]
  settings: unknown[]
  thumbs: ThumbDump[]
}

const TABLES = ['sources', 'exercises', 'workouts', 'sessionLogs', 'stickerUnlocks', 'jokerUses', 'settings'] as const

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function exportBackup(db: AppDB): Promise<BackupFile> {
  const thumbs: ThumbDump[] = []
  for (const t of await db.thumbs.toArray()) {
    thumbs.push({ id: t.id, type: t.blob.type, base64: toBase64(new Uint8Array(await t.blob.arrayBuffer())) })
  }
  return {
    app: 'webapp-sport',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sources: await db.sources.toArray(),
    exercises: await db.exercises.toArray(),
    workouts: await db.workouts.toArray(),
    sessionLogs: await db.sessionLogs.toArray(),
    stickerUnlocks: await db.stickerUnlocks.toArray(),
    jokerUses: await db.jokerUses.toArray(),
    settings: await db.settings.toArray(),
    thumbs,
  }
}

export class BackupError extends Error {}

/** Vérifie la forme du fichier avant de toucher aux données. */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError("Ce fichier n'est pas une sauvegarde lisible.")
  }
  const b = data as Partial<BackupFile> | null
  if (!b || b.app !== 'webapp-sport') throw new BackupError("Ce fichier ne vient pas de l'app.")
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION)
    throw new BackupError("Cette sauvegarde vient d'une version plus récente de l'app.")
  for (const t of [...TABLES, 'thumbs'] as const) {
    if (!Array.isArray(b[t])) throw new BackupError(`Sauvegarde incomplète : « ${t} » manque.`)
  }
  return b as BackupFile
}

/** Remplace toutes les données par celles de la sauvegarde, en une seule transaction. */
export async function restoreBackup(db: AppDB, backup: BackupFile): Promise<void> {
  await db.transaction('rw', [...TABLES.map((t) => db[t]), db.thumbs], async () => {
    for (const t of TABLES) {
      await db[t].clear()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db[t] as any).bulkPut(backup[t])
    }
    await db.thumbs.clear()
    await db.thumbs.bulkPut(
      backup.thumbs.map((t) => ({ id: t.id, blob: new Blob([fromBase64(t.base64)], { type: t.type }) })),
    )
  })
}
