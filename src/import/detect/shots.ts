import type { Candidate, MotionSeries } from './types'

export const HIST_BINS = 16
export const FRAME_W = 64
export const FRAME_H = 36

/** Histogramme de luminance normalisé (somme = 1) d'une image RGBA de 64 × 36. */
export function lumaHistogram(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const hist = new Float32Array(HIST_BINS)
  const n = rgba.length / 4
  for (let p = 0; p < rgba.length; p += 4) {
    const y = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!
    hist[Math.min(HIST_BINS - 1, Math.floor(y / (256 / HIST_BINS)))]! += 1 / n
  }
  return hist
}

/** Écart entre deux histogrammes, de 0 (identiques) à 1 (totalement différents). */
export function histDistance(a: Float32Array, b: Float32Array): number {
  let d = 0
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i]! - b[i]!)
  return d / 2
}

/** Différence moyenne de luminance entre deux images, normalisée de 0 à 1 : sert de mesure de mouvement. */
export function frameMotion(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array): number {
  let d = 0
  let n = 0
  for (let p = 0; p < a.length; p += 4) {
    d += Math.abs(0.299 * (a[p]! - b[p]!) + 0.587 * (a[p + 1]! - b[p + 1]!) + 0.114 * (a[p + 2]! - b[p + 2]!))
    n++
  }
  return n ? d / n / 255 : 0
}

export const median = (xs: number[]): number => {
  if (!xs.length) return 0
  const s = [...xs].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Seuil adaptatif : médiane plus quelques écarts médians, avec un plancher pour ignorer le bruit. */
export function adaptiveThreshold(diffs: number[], k = 6, floor = 0.12): number {
  const med = median(diffs)
  const mad = median(diffs.map((d) => Math.abs(d - med)))
  return Math.max(floor, med + k * mad)
}

/**
 * Frontières par changements de plan. `diffs[i]` est l'écart entre l'échantillon i et i+1
 * (pris tous les `stepSec`). Un écart au-dessus du seuil est une frontière, placée entre les deux.
 */
export function shotBoundaries(diffs: number[], stepSec: number): Candidate[] {
  const thr = adaptiveThreshold(diffs)
  const out: Candidate[] = []
  diffs.forEach((d, i) => {
    if (d <= thr) return
    // Fort écart (≥ 2 seuils) : sans ambiguïté. Juste au-dessus du seuil : proche du seuil, donc incertain.
    out.push({ t: (i + 0.5) * stepSec, source: 'shots', strength: Math.min(1, 0.35 + (0.65 * (d - thr)) / thr) })
  })
  return out
}

export const stepFor = (durationSec: number) => (durationSec > 600 ? 1 : 0.5)

export interface SampleResult {
  boundaries: Candidate[]
  motion: MotionSeries
}

/** Échantillonne la vidéo (élément caché, sauts réguliers) et calcule les frontières. Annulable. */
export async function analyzeShots(
  file: Blob,
  durationSec: number,
  onProgress: (ratio: number) => void,
  signal: AbortSignal,
): Promise<SampleResult> {
  const step = stepFor(durationSec)
  const total = Math.max(2, Math.floor(durationSec / step))
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  const canvas = document.createElement('canvas')
  canvas.width = FRAME_W
  canvas.height = FRAME_H
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  try {
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res()
      v.onerror = () => rej(new Error('Vidéo illisible'))
      v.src = url
    })
    const diffs: number[] = []
    const motion: number[] = []
    let prevHist: Float32Array | null = null
    let prevPix: Uint8ClampedArray | null = null
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
      await new Promise<void>((res, rej) => {
        v.onseeked = () => res()
        v.onerror = () => rej(new Error('Saut impossible dans la vidéo'))
        v.currentTime = Math.min(i * step, Math.max(0, durationSec - 0.05))
      })
      g.drawImage(v, 0, 0, FRAME_W, FRAME_H)
      const pix = new Uint8ClampedArray(g.getImageData(0, 0, FRAME_W, FRAME_H).data)
      const hist = lumaHistogram(pix)
      if (prevHist && prevPix) {
        diffs.push(histDistance(prevHist, hist))
        motion.push(frameMotion(prevPix, pix))
      }
      prevHist = hist
      prevPix = pix
      if (i % 5 === 0) onProgress(i / total)
    }
    onProgress(1)
    return { boundaries: shotBoundaries(diffs, step), motion: { stepSec: step, values: motion } }
  } finally {
    URL.revokeObjectURL(url)
    v.removeAttribute('src')
    v.load()
  }
}
