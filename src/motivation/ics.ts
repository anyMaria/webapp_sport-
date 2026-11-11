import type { Settings } from '../data/types'

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] // index = getDay()

const pad = (n: number) => String(n).padStart(2, '0')
const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`

const escapeText = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Plie une ligne à 75 octets comme l'exige RFC 5545 (continuation : CRLF + espace). */
export function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let bytes = 0
  const limit = () => (out.length === 0 ? 75 : 74)
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > limit()) { out.push(cur); cur = ''; bytes = 0 }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** Premier jour correspondant à la récurrence, à partir d'aujourd'hui (aujourd'hui compris si l'heure n'est pas passée). */
export function firstOccurrence(days: number[], time: string, now: Date): Date {
  const [h, m] = time.split(':').map(Number)
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h ?? 19, m ?? 0)
    if (days.includes(d.getDay()) && d.getTime() > now.getTime()) return d
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h ?? 19, m ?? 0)
}

export interface IcsInput {
  slot: Settings['slot']
  reminder: boolean
  appName: string
  appUrl: string
  now: Date
}

/** Événement récurrent hebdomadaire en heure locale flottante, avec alarme 10 minutes avant et l'adresse de l'app dans URL. */
export function buildIcs({ slot, reminder, appName, appUrl, now }: IcsInput): string {
  const start = firstOccurrence(slot.days, slot.time, now)
  const end = new Date(start.getTime() + slot.durationMin * 60000)
  const byday = [...slot.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => BYDAY[d]).join(',')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeText(appName)}//Creneau//FR`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:creneau-${byday.toLowerCase().replace(/,/g, '')}-${slot.time.replace(':', '')}@webapp-sport`,
    `DTSTAMP:${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    `SUMMARY:${escapeText(`${appName} : ton créneau`)}`,
    `URL:${appUrl}`,
  ]
  if (reminder) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(`${appName} dans 10 minutes`)}`, 'TRIGGER:-PT10M', 'END:VALARM')
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Clé du créneau : sert à repérer qu'il a changé depuis le dernier export. */
export const slotKey = (slot: Settings['slot']) => `${[...slot.days].sort().join('')}|${slot.time}|${slot.durationMin}`

/**
 * Propose le fichier au calendrier. Sur iPad en mode installé, le téléchargement direct ne propose pas toujours
 * l'ajout au calendrier : on passe d'abord par la feuille de partage quand elle accepte un fichier.
 */
export async function deliverIcs(ics: string, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([ics], filename, { type: 'text/calendar' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return 'downloaded'
}
