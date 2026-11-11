import { wholeVideo, type Segment } from '../segments'
import { audioBoundaries } from './audio'
import { mergeCandidates } from './merge'
import { rhythmBoundaries, type Rhythm } from './rhythm'
import { analyzeShots } from './shots'
import type { Candidate, MotionSeries } from './types'

export interface AnalysisOptions {
  shots: boolean
  audio: boolean
  rhythm: Rhythm | null
}

export interface AnalysisResult {
  segments: Segment[]
  /** Messages pour l'utilisatrice : ce qui a marché, ce qui a échoué. */
  notes: string[]
}

export type ProgressFn = (label: string, ratio: number | null) => void

/** Décode la piste audio en mono à faible fréquence d'échantillonnage pour limiter la mémoire. */
async function decodeMono(file: Blob): Promise<{ samples: Float32Array; rate: number }> {
  let lastError: unknown = null
  for (const rate of [16000, 8000, 22050]) {
    try {
      const buf = await file.arrayBuffer() // decodeAudioData détache le tampon : on relit à chaque essai
      const ctx = new OfflineAudioContext(1, 1, rate)
      const decoded = await ctx.decodeAudioData(buf)
      return { samples: decoded.getChannelData(0), rate: decoded.sampleRate }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Décodage audio impossible')
}

function audioInWorker(samples: Float32Array, rate: number): Promise<Candidate[]> {
  return new Promise((resolve) => {
    try {
      const w = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<{ boundaries?: Candidate[]; error?: string }>) => {
        w.terminate()
        resolve(e.data.boundaries ?? audioBoundaries(samples, rate))
      }
      w.onerror = () => { w.terminate(); resolve(audioBoundaries(samples, rate)) }
      w.postMessage({ samples, rate })
    } catch {
      resolve(audioBoundaries(samples, rate))
    }
  })
}

/**
 * Analyse complète. Ne bloque jamais l'interface, peut être annulée (AbortSignal), et en cas d'échec d'un
 * détecteur continue avec les autres. Si tout échoue : un seul segment à couper à la main.
 */
export async function analyzeVideo(
  file: Blob,
  durationSec: number,
  opts: AnalysisOptions,
  onProgress: ProgressFn,
  signal: AbortSignal,
): Promise<AnalysisResult> {
  const notes: string[] = []
  const cands: Candidate[] = []
  let motion: MotionSeries | undefined

  if (opts.shots) {
    try {
      const r = await analyzeShots(file, durationSec, (x) => onProgress('Changements de plan', x), signal)
      cands.push(...r.boundaries)
      motion = r.motion
      notes.push(`Changements de plan : ${r.boundaries.length} frontières.`)
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      notes.push(`Changements de plan indisponibles : ${(e as Error).message}`)
    }
  }
  if (signal.aborted) throw new DOMException('Annulé', 'AbortError')

  if (opts.audio) {
    try {
      onProgress('Lecture de la piste audio', null)
      const { samples, rate } = await decodeMono(file)
      if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
      onProgress('Bips et silences', null)
      const b = await audioInWorker(samples, rate)
      cands.push(...b)
      notes.push(`Bips et silences : ${b.length} frontières.`)
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      notes.push(`Bips et silences indisponibles sur cette vidéo (${(e as Error).message || 'décodage audio impossible'}). Les autres détecteurs continuent.`)
    }
  }

  if (opts.rhythm) {
    cands.push(...rhythmBoundaries(opts.rhythm, durationSec, cands))
    notes.push('Rythme régulier appliqué.')
  }

  if (!cands.length) {
    notes.push('Aucune frontière trouvée : coupe à la main, la frise et l’aperçu t’aident.')
    return { segments: wholeVideo(durationSec), notes }
  }
  return { segments: mergeCandidates(cands, durationSec, motion), notes }
}
