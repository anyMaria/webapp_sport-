/** Accès aux fichiers vidéo dans OPFS. Les fichiers ne sont jamais lus en entier en mémoire. */
export async function removeVideoFile(path: string): Promise<void> {
  const root = await navigator.storage.getDirectory()
  await root.removeEntry(path).catch(() => undefined)
}

export async function getVideoFile(path: string): Promise<File> {
  const root = await navigator.storage.getDirectory()
  return (await root.getFileHandle(path)).getFile()
}

/** Copie un fichier dans OPFS par flux, avec progression (0 à 1). Repli sur un worker si createWritable manque. */
export async function writeVideoFile(file: File, name: string, onProgress?: (ratio: number) => void): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const fh = await root.getFileHandle(name, { create: true })
  if ('createWritable' in fh) {
    const writable = await (fh as FileSystemFileHandle & { createWritable(): Promise<WritableStream<Uint8Array>> }).createWritable()
    let done = 0
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        done += chunk.byteLength
        onProgress?.(file.size ? done / file.size : 1)
        ctl.enqueue(chunk)
      },
    })
    await (file.stream() as ReadableStream<Uint8Array>).pipeThrough(counter).pipeTo(writable)
    return
  }
  await new Promise<void>((resolve, reject) => {
    const w = new Worker(new URL('./opfsWorker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ progress?: number; done?: boolean; error?: string }>) => {
      if (e.data.error) { w.terminate(); reject(new Error(e.data.error)) }
      else if (e.data.done) { w.terminate(); resolve() }
      else if (e.data.progress) onProgress?.(e.data.progress / file.size)
    }
    w.postMessage({ file, name })
  })
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
