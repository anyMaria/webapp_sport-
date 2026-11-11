import { AiError, aiPost, aiStatus, drawTag, openHiddenVideo, seekVideo, wait } from './aiClient'
import { clampCue, defaultName, fillGaps, MIN_SEGMENT_SEC, segId, type Segment } from './segments'

export interface Found { start: number; end: number; name: string; cue: string }
/** Une planche : une grille d'images de la vidéo, numérotées, avec l'instant de chacune. */
export interface Sheet { image: string; times: number[] }
/** Réponse de l'IA pour une planche : un numéro d'exercice par image (0 = pas d'exercice) et les noms. */
export interface SheetMarks { labels: number[]; names: { ex: number; name: string; cue: string }[] }

export async function aiSegmentsEnabled(): Promise<boolean> {
  return (await aiStatus()).enabled
}

const COLS = 4
const ROWS = 3
export const PER_SHEET = COLS * ROWS
/** Une demande par planche : au plus 10 demandes, pour rester sous les limites d'un service gratuit. */
export const MAX_SHEETS = 10
const CELL_PX = 320

/** Nombre de planches : deux images par seconde tant que ça tient en 10 planches, plus espacées au-delà. */
export const sheetCount = (durationSec: number) => Math.min(MAX_SHEETS, Math.max(1, Math.ceil((durationSec * 2 - 1) / (PER_SHEET - 1))))

/**
 * Instants des images, planche par planche. Deux planches voisines ont une image en commun (la dernière de l'une
 * est la première de l'autre) : c'est elle qui permet de raccorder les exercices d'une planche à l'autre.
 */
export function sheetTimes(durationSec: number): number[][] {
  const k = sheetCount(durationSec)
  const n = 1 + k * (PER_SHEET - 1)
  const at = (i: number) => Math.round(Math.min(Math.max(0, durationSec - 0.1), ((i + 0.5) * durationSec) / n) * 100) / 100
  return Array.from({ length: k }, (_, s) => Array.from({ length: PER_SHEET }, (_, j) => at(s * (PER_SHEET - 1) + j)))
}

/** Planches d'images (grille de 4 x 3, 320 px au plus par image), le numéro de l'image écrit dans son coin. */
export async function sampleSheets(file: Blob, durationSec: number, signal: AbortSignal, onProgress: (ratio: number) => void): Promise<Sheet[]> {
  const { v, done } = await openHiddenVideo(file)
  try {
    const vw = v.videoWidth || 16
    const vh = v.videoHeight || 9
    const k = CELL_PX / Math.max(vw, vh)
    const w = Math.round(vw * k)
    const h = Math.round(vh * k)
    const plan = sheetTimes(durationSec)
    const total = plan.length * PER_SHEET
    const sheets: Sheet[] = []
    for (const [s, times] of plan.entries()) {
      const cv = document.createElement('canvas')
      cv.width = COLS * w
      cv.height = ROWS * h
      const g = cv.getContext('2d')!
      g.fillStyle = '#000'
      g.fillRect(0, 0, cv.width, cv.height)
      for (const [j, t] of times.entries()) {
        if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
        await seekVideo(v, t)
        const x = (j % COLS) * w
        const y = Math.floor(j / COLS) * h
        g.drawImage(v, x, y, w, h)
        drawTag(g, String(j + 1), x + 3, y + 3)
        onProgress((s * PER_SHEET + j + 1) / total)
      }
      sheets.push({ image: cv.toDataURL('image/jpeg', 0.75).split(',')[1]!, times })
    }
    return sheets
  } finally {
    done()
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Raccorde les réponses des planches en une seule suite d'étiquettes, puis en exercices.
 * - L'image commune à deux planches dit quel exercice continue de l'une à l'autre (à défaut : un nom identique en début de planche).
 * - Une planche sans réponse reprend l'étiquette d'avant : aucune coupe n'y est inventée, la zone est signalée dans `missing`.
 * - À deux images par seconde, une image isolée entre deux images identiques est du bruit.
 * Les limites tombent à mi-chemin entre deux images voisines d'exercices différents.
 */
export function stitchSheets(plan: number[][], results: (SheetMarks | null)[], durationSec: number): { found: Found[]; missing: [number, number][] } {
  const times: number[] = []
  const labels: number[] = []
  const names = new Map<number, { name: string; cue: string }>()
  const missing: [number, number][] = []
  let next = 1
  plan.forEach((sheetT, s) => {
    const from = s === 0 ? 0 : 1
    const r = results[s]
    if (!r || r.labels.length !== sheetT.length) {
      missing.push([s === 0 ? 0 : sheetT[0]!, s === plan.length - 1 ? durationSec : sheetT[sheetT.length - 1]!])
      for (let j = from; j < sheetT.length; j++) { times.push(sheetT[j]!); labels.push(-1) }
      return
    }
    const local = new Map(r.names.map((n) => [n.ex, n]))
    const map = new Map<number, number>()
    const shared = s > 0 ? (labels[labels.length - 1] ?? 0) : 0
    const first = r.labels[0] ?? 0
    if (first > 0 && shared > 0) map.set(first, shared)
    else {
      // Pas de raccord par l'image commune : un exercice du début de la planche qui porte le même nom que le dernier vu est le même.
      const lastSeen = [...labels].reverse().find((l) => l > 0)
      const lead = r.labels.slice(0, 3).find((l) => l > 0)
      const a = lead ? local.get(lead)?.name : undefined
      const b = lastSeen ? names.get(lastSeen)?.name : undefined
      if (lead && lastSeen && labels.slice(-3).includes(lastSeen) && a && b && norm(a) === norm(b)) map.set(lead, lastSeen)
    }
    for (let j = from; j < sheetT.length; j++) {
      const l = r.labels[j] ?? 0
      let g = 0
      if (l > 0) {
        if (!map.has(l)) map.set(l, next++)
        g = map.get(l)!
        const n = local.get(l)
        if (n && !names.has(g)) names.set(g, { name: n.name, cue: n.cue })
      }
      times.push(sheetT[j]!)
      labels.push(g)
    }
  })
  // Planche sans réponse : même étiquette que juste avant (ou que juste après, en tout début de vidéo).
  for (let i = 0; i < labels.length; i++) if (labels[i] === -1) labels[i] = i > 0 ? labels[i - 1]! : (labels.find((l) => l !== -1) ?? 0)
  const step = times.length > 1 ? (times[times.length - 1]! - times[0]!) / (times.length - 1) : durationSec
  if (step < 1.5) for (let i = 1; i < labels.length - 1; i++) if (labels[i] !== labels[i - 1] && labels[i - 1] === labels[i + 1]) labels[i] = labels[i - 1]!
  const found: Found[] = []
  let i = 0
  while (i < labels.length) {
    if (labels[i] === 0) { i++; continue }
    let j = i
    while (j + 1 < labels.length && labels[j + 1] === labels[i]) j++
    const start = i === 0 ? 0 : (times[i - 1]! + times[i]!) / 2
    const end = j === labels.length - 1 ? durationSec : (times[j]! + times[j + 1]!) / 2
    if (end - start >= MIN_SEGMENT_SEC) {
      const n = names.get(labels[i]!)
      found.push({ start: round(start), end: round(end), name: n?.name || defaultName(found.length), cue: n?.cue ?? '' })
    }
    i = j + 1
  }
  return { found, missing }
}

const MAX_TRIES = 3
/** Un trou plus court que ça entre deux exercices repérés est du bruit (une image à peine) : pas de « Pause » pour si peu. */
const AI_MIN_GAP_SEC = 1.5

/**
 * Envoie les planches une par une. Chaque demande est petite (une image, douze étiquettes), ce qu'un modèle léger réussit bien mieux
 * qu'une grosse demande. Quand le service est saturé, on attend le délai qu'il indique et on réessaie. Une planche en échec n'arrête pas les autres.
 */
export async function requestMarks(
  sheets: Sheet[], durationSec: number, signal: AbortSignal, onStep: (done: number, total: number, waitSec?: number) => void,
): Promise<{ found: Found[]; notes: string[] }> {
  const results: (SheetMarks | null)[] = []
  const problems = new Set<string>()
  let prev = ''
  for (const [s, sheet] of sheets.entries()) {
    onStep(s, sheets.length)
    const stepSec = sheet.times.length > 1 ? (sheet.times[sheet.times.length - 1]! - sheet.times[0]!) / (sheet.times.length - 1) : durationSec
    let got: SheetMarks | null = null
    for (let attempt = 1; attempt <= MAX_TRIES && !got; attempt++) {
      try {
        const body = await aiPost<{ labels?: number[] | null; names?: SheetMarks['names']; note?: string }>({ task: 'marks', image: sheet.image, count: sheet.times.length, stepSec, prev }, signal)
        if (Array.isArray(body.labels) && body.labels.length === sheet.times.length) got = { labels: body.labels, names: body.names ?? [] }
        else { if (body.note) problems.add(body.note); break }
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
        const retry = e instanceof AiError ? e.retryAfter : undefined
        if (retry === undefined || attempt === MAX_TRIES) { problems.add((e as Error).message); break }
        const sec = Math.min(45, Math.max(2, Math.ceil(retry)))
        onStep(s, sheets.length, sec)
        await wait(sec * 1000, signal)
        onStep(s, sheets.length)
      }
    }
    results.push(got)
    if (got) {
      const last = got.labels[got.labels.length - 1] ?? 0
      prev = last > 0 ? (got.names.find((n) => n.ex === last)?.name ?? 'un exercice') : 'pas d\'exercice (introduction ou pause)'
    } else if (results.every((r) => r === null) && s >= 1) break // deux échecs d'entrée : inutile d'insister
  }
  while (results.length < sheets.length) results.push(null)
  const plan = sheets.map((x) => x.times)
  const { found, missing } = stitchSheets(plan, results, durationSec)
  const notes: string[] = []
  if (results.some((r) => r !== null) && missing.length) {
    notes.push(`L'IA n'a pas pu regarder ${missing.map(([a, b]) => `de ${fmt(a)} à ${fmt(b)}`).join(', ')} : vérifie ${missing.length > 1 ? 'ces passages' : 'ce passage'} à la main.`)
  }
  notes.push(...problems)
  return { found, notes }
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const round = (n: number) => Math.round(n * 10) / 10

/**
 * Transforme les exercices repérés en segments jointifs sur toute la vidéo : exercices gardés, trous en « Pause » retirées.
 * Chaque coupe posée par l'IA est « à vérifier » (la fin de la vidéo, elle, est sûre).
 */
export function buildSegments(found: Found[], durationSec: number): Segment[] {
  const items = found
    .filter((f) => Number.isFinite(f.start) && Number.isFinite(f.end))
    .map((f) => ({ ...f, start: Math.max(0, f.start), end: Math.min(durationSec, f.end) }))
    .sort((a, b) => a.start - b.start)
  const kept: Segment[] = []
  let cursor = 0
  for (const f of items) {
    const start = Math.max(f.start, cursor)
    if (f.end - start < MIN_SEGMENT_SEC) continue
    kept.push({ id: segId(), startSec: round(start), endSec: round(f.end), name: f.name.trim() || defaultName(kept.length), cue: clampCue(f.cue), tags: [], kept: true })
    cursor = f.end
  }
  if (!kept.length) return [{ id: segId(), startSec: 0, endSec: round(durationSec), name: 'Pause', cue: '', tags: [], kept: false }]
  const all = fillGaps(kept, durationSec, AI_MIN_GAP_SEC)
  return all.map((x, i) => ({ ...x, verify: i < all.length - 1 }))
}

/**
 * Cale les débuts et fins proposés par l'IA sur les changements d'image détectés localement (au plus `maxDist` s d'écart),
 * puis recolle les exercices qui s'enchaînent (début du suivant = fin du précédent).
 */
export function snapBoundaries(found: Found[], cuts: number[], maxDist = 1.5): Found[] {
  const snap = (t: number) => {
    let best = t
    let bd = maxDist + 1e-9
    for (const c of cuts) {
      const d = Math.abs(c - t)
      if (d < bd) { bd = d; best = c }
    }
    return best
  }
  const out = [...found].sort((a, b) => a.start - b.start).map((f) => ({ ...f, start: snap(f.start), end: snap(f.end) }))
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!
    const cur = out[i]!
    if (Math.abs(cur.start - prev.end) <= maxDist) cur.start = prev.end
  }
  return out.filter((f) => f.end > f.start)
}
