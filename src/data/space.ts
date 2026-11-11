import { readStorageInfo, formatBytes } from './opfs'

export const LOW_SPACE_RATIO = 0.8

export class NotEnoughSpaceError extends Error {}

/** Refuse un import qui ne tiendrait pas, avec un message clair, avant de copier quoi que ce soit. */
export async function assertSpaceFor(bytes: number): Promise<void> {
  const { usage, quota } = await readStorageInfo()
  if (!quota) return // estimation indisponible : on tente quand même
  const free = quota - usage
  if (bytes * 1.05 > free) {
    throw new NotEnoughSpaceError(`Pas assez de place : il reste ${formatBytes(Math.max(0, free))} et cette vidéo en demande ${formatBytes(bytes)}. Supprime une vidéo dans les Réglages, puis réessaie.`)
  }
}

export async function isSpaceLow(): Promise<boolean> {
  const { usage, quota } = await readStorageInfo()
  return quota > 0 && usage / quota >= LOW_SPACE_RATIO
}

/** Message lisible pour une erreur d'écriture (quota dépassé, fichier illisible…). */
export function friendlyWriteError(e: unknown): string {
  const err = e as { name?: string; message?: string }
  if (err.name === 'QuotaExceededError' || /quota|space/i.test(err.message ?? '')) return "L'iPad n'a plus assez de place pour cette vidéo. Supprime une vidéo dans les Réglages, puis réessaie."
  return err.message || "L'import a échoué. Réessaie avec ce fichier."
}
