/** Accès aux fichiers vidéo dans OPFS. Les fichiers ne sont jamais lus en entier en mémoire. */
export async function removeVideoFile(path: string): Promise<void> {
  const root = await navigator.storage.getDirectory()
  await root.removeEntry(path).catch(() => undefined)
}

export interface StorageInfo {
  usage: number
  quota: number
  persisted: boolean
}

export async function readStorageInfo(): Promise<StorageInfo> {
  const est = (await navigator.storage?.estimate?.()) ?? {}
  const persisted = (await navigator.storage?.persisted?.()) ?? false
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted }
}

export async function requestPersist(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false
}

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} Go`
  return `${Math.round(n / 1e6)} Mo`
}
