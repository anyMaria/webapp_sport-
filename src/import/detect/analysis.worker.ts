import { audioBoundaries } from './audio'
import type { Candidate } from './types'

/// Calculs audio hors du fil principal : enveloppe d'énergie, silences, bips.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<{ samples: Float32Array; rate: number }>) => void) | null
  postMessage(msg: unknown): void
}

ctx.onmessage = (e) => {
  try {
    const out: Candidate[] = audioBoundaries(e.data.samples, e.data.rate)
    ctx.postMessage({ boundaries: out })
  } catch (err) {
    ctx.postMessage({ error: (err as Error).message })
  }
}
