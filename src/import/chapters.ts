import { segId, type Segment } from './segments'

const LINE = /^\s*[-–•]?\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–:|]?\s*(.*)$/

/** Repères copiés de la description YouTube (lignes du type « 2:15 Nom de l'exercice »). */
export function parseChapters(text: string, durationSec: number): Segment[] {
  const marks: { t: number; name: string }[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line)
    if (!m) continue
    const t = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
    if (t >= 0 && (durationSec <= 0 || t < durationSec)) marks.push({ t, name: (m[4] ?? '').trim() })
  }
  marks.sort((a, b) => a.t - b.t)
  const uniq = marks.filter((m, i) => i === 0 || m.t - marks[i - 1]!.t >= 1)
  const segs: Segment[] = []
  uniq.forEach((m, i) => {
    const end = uniq[i + 1]?.t ?? durationSec
    if (end - m.t < 1) return
    segs.push({ id: segId(), startSec: m.t, endSec: end, name: m.name || `Exercice ${segs.length + 1}`, cue: '', tags: [], kept: true })
  })
  return segs
}
