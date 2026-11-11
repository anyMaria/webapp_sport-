/// Écriture OPFS par createSyncAccessHandle : repli si createWritable n'existe pas sur Safari.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<{ file: File; name: string }>) => void) | null
  postMessage(msg: unknown): void
}

ctx.onmessage = async (e) => {
  const { file, name } = e.data
  try {
    const root = await navigator.storage.getDirectory()
    const fh = await root.getFileHandle(name, { create: true })
    const handle = await fh.createSyncAccessHandle()
    handle.truncate(0)
    const reader = file.stream().getReader()
    let offset = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      handle.write(value, { at: offset })
      offset += value.byteLength
      ctx.postMessage({ progress: offset })
    }
    handle.flush()
    handle.close()
    ctx.postMessage({ done: true, size: offset })
  } catch (err) {
    ctx.postMessage({ error: (err as Error).message })
  }
}

export {}
