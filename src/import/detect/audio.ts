import type { Candidate } from './types'

export const WINDOW_SEC = 0.05
export const MIN_SILENCE_SEC = 0.7
export const BEEP_MIN_SEC = 0.08
export const BEEP_MAX_SEC = 0.6
export const BEEP_BAND: [number, number] = [800, 2500]

/** Énergie RMS par fenêtres de 50 ms. */
export function energyEnvelope(samples: Float32Array, sampleRate: number): Float32Array {
  const win = Math.round(sampleRate * WINDOW_SEC)
  const n = Math.floor(samples.length / win)
  const env = new Float32Array(n)
  for (let w = 0; w < n; w++) {
    let e = 0
    for (let i = w * win, end = i + win; i < end; i++) e += samples[i]! * samples[i]!
    env[w] = Math.sqrt(e / win)
  }
  return env
}

/** Un silence est un creux d'au moins 0,7 s, sous un seuil relatif au niveau typique de la piste. */
export function findSilences(env: Float32Array): { start: number; end: number }[] {
  if (!env.length) return []
  const sorted = [...env].sort()
  const loud = sorted[Math.floor(sorted.length * 0.9)] ?? 0
  const thr = Math.max(0.002, loud * 0.05)
  const minWin = Math.ceil(MIN_SILENCE_SEC / WINDOW_SEC)
  const out: { start: number; end: number }[] = []
  let run = 0
  for (let i = 0; i <= env.length; i++) {
    if (i < env.length && env[i]! < thr) { run++; continue }
    if (run >= minWin) out.push({ start: (i - run) * WINDOW_SEC, end: i * WINDOW_SEC })
    run = 0
  }
  return out
}

/** Énergie à une fréquence donnée sur une fenêtre (algorithme de Goertzel), rapportée à l'énergie totale. */
function goertzelPower(samples: Float32Array, from: number, len: number, freq: number, rate: number): number {
  const k = (2 * Math.PI * freq) / rate
  const coeff = 2 * Math.cos(k)
  let s1 = 0
  let s2 = 0
  for (let i = from; i < from + len; i++) {
    const s0 = samples[i]! + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (len * len / 4)
}

/** Un bip est un pic étroit entre 800 et 2500 Hz, de 80 à 600 ms : une fenêtre est « tonale » si une fréquence de la bande domine. */
export function findBeeps(samples: Float32Array, sampleRate: number, env: Float32Array): { start: number; end: number; strength: number }[] {
  const win = Math.round(sampleRate * WINDOW_SEC)
  const loud = [...env].sort()[Math.floor(env.length * 0.5)] ?? 0
  const freqs: number[] = []
  for (let f = BEEP_BAND[0]; f <= BEEP_BAND[1]; f += 100) freqs.push(f)
  const tonal = new Float32Array(env.length)
  for (let w = 0; w < env.length; w++) {
    const rms = env[w]!
    if (rms < Math.max(0.02, loud * 1.5)) continue
    let best = 0
    for (const f of freqs) best = Math.max(best, goertzelPower(samples, w * win, win, f, sampleRate))
    // Pour un sinus pur, best ≈ rms² × 2 : le ratio vaut ~1. Pour du bruit ou de la parole, il reste bas.
    tonal[w] = Math.min(1, best / (2 * rms * rms + 1e-9))
  }
  const out: { start: number; end: number; strength: number }[] = []
  let run = 0
  let sum = 0
  for (let w = 0; w <= tonal.length; w++) {
    if (w < tonal.length && tonal[w]! > 0.6) { run++; sum += tonal[w]!; continue }
    const dur = run * WINDOW_SEC
    if (run && dur >= BEEP_MIN_SEC - 1e-9 && dur <= BEEP_MAX_SEC + 1e-9) out.push({ start: (w - run) * WINDOW_SEC, end: w * WINDOW_SEC, strength: sum / run })
    run = 0
    sum = 0
  }
  return out
}

/** Frontières issues de l'audio : début et fin de chaque silence, et début de chaque bip. */
export function audioBoundaries(samples: Float32Array, sampleRate: number): Candidate[] {
  const env = energyEnvelope(samples, sampleRate)
  const out: Candidate[] = []
  for (const s of findSilences(env)) {
    out.push({ t: s.start, source: 'audio', strength: 0.9 }, { t: s.end, source: 'audio', strength: 0.9 })
  }
  for (const b of findBeeps(samples, sampleRate, env)) out.push({ t: b.start, source: 'audio', strength: Math.min(1, b.strength) })
  return out
}
