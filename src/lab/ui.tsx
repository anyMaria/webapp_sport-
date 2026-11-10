import { useCallback, useEffect, useState, type ReactNode } from 'react'
import s from './lab.module.css'

export type Verdict = 'ok' | 'mixed' | 'ko'
export interface TestRecord {
  verdict?: Verdict
  note: string
  at?: string
}

const VERDICT_LABEL: Record<Verdict, string> = { ok: 'Réussi', mixed: 'Mitigé', ko: 'Échec' }
export const TESTS: { id: string; title: string }[] = [
  { id: 't1', title: 'Bip par-dessus Spotify' },
  { id: 't2', title: 'Voix de synthèse par-dessus Spotify' },
  { id: 't3', title: 'Vidéo muette en boucle pendant Spotify' },
  { id: 't4', title: 'Écran allumé (Wake Lock)' },
  { id: 't5', title: 'Stockage OPFS' },
  { id: 't6', title: "Boucle sur un extrait" },
  { id: 't7', title: "Analyse d'une vidéo de 15 minutes" },
]

const key = (id: string) => `lab:${id}`

export function readRecord(id: string): TestRecord {
  try {
    const raw = localStorage.getItem(key(id))
    if (raw) return JSON.parse(raw) as TestRecord
  } catch {
    /* stockage indisponible */
  }
  return { note: '' }
}

function writeRecord(id: string, rec: TestRecord) {
  try {
    localStorage.setItem(key(id), JSON.stringify(rec))
  } catch {
    /* stockage indisponible */
  }
}

/** Journal affiché à l'écran : l'iPad n'a pas de console, tout doit se lire dans la page. */
export function useLog() {
  const [lines, setLines] = useState<string[]>([])
  const add = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString('fr-FR')
    setLines((l) => [...l.slice(-199), `${t}  ${msg}`])
  }, [])
  const clear = useCallback(() => setLines([]), [])
  return { lines, add, clear }
}

export function Log({ lines }: { lines: string[] }) {
  return (
    <pre className={s.log} aria-live="polite">
      {lines.length ? lines.join('\n') : 'Le résultat s’affichera ici.'}
    </pre>
  )
}

export function Btn(props: {
  onClick: () => void
  children: ReactNode
  primary?: boolean
  disabled?: boolean
  pressed?: boolean
}) {
  const cls = [s.btn, props.primary ? s.primary : '', props.pressed ? s.pressed : ''].join(' ')
  return (
    <button
      type="button"
      className={cls}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.pressed}
    >
      {props.children}
    </button>
  )
}

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className={s.field}>
      {props.label}
      {props.children}
    </label>
  )
}

export function TestCard(props: {
  id: string
  num: number
  title: string
  how: string
  passIf: string
  planB: string
  children: ReactNode
}) {
  const [rec, setRec] = useState<TestRecord>(() => readRecord(props.id))
  useEffect(() => writeRecord(props.id, rec), [props.id, rec])
  const setVerdict = (verdict: Verdict) =>
    setRec((r) => ({ ...r, verdict, at: new Date().toISOString() }))

  return (
    <section className={s.card} aria-labelledby={`${props.id}-h`}>
      <div>
        <span className={s.label}>Test {props.num}</span>
        <h2 id={`${props.id}-h`}>{props.title}</h2>
      </div>
      <p className={s.muted}>{props.how}</p>
      <div className={s.crit}>
        <div>
          <span className={s.label}>Réussi si</span>
          <p>{props.passIf}</p>
        </div>
        <div>
          <span className={s.label}>Plan B</span>
          <p>{props.planB}</p>
        </div>
      </div>
      {props.children}
      <div className={s.verdict}>
        <span className={s.label}>Ton verdict</span>
        <div className={s.actions}>
          {(['ok', 'mixed', 'ko'] as Verdict[]).map((v) => (
            <Btn key={v} pressed={rec.verdict === v} onClick={() => setVerdict(v)}>
              {VERDICT_LABEL[v]}
            </Btn>
          ))}
        </div>
        <textarea
          className={s.note}
          aria-label={`Remarque pour le test ${props.num}`}
          placeholder="Ce que tu as entendu ou vu (Spotify coupé ? bip audible ? délai ?)"
          value={rec.note}
          onChange={(e) => setRec((r) => ({ ...r, note: e.target.value }))}
        />
      </div>
    </section>
  )
}

export function fmtBytes(n: number) {
  if (n > 1e9) return `${(n / 1e9).toFixed(2)} Go`
  return `${(n / 1e6).toFixed(1)} Mo`
}

export function fmtSec(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`
}
