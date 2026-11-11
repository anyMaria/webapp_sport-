import { useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '../lib/constants'
import { Btn, readRecord, TESTS } from './ui'
import { T1Beep } from './T1Beep'
import { T2Voice } from './T2Voice'
import { T3Video } from './T3Video'
import { T4WakeLock } from './T4WakeLock'
import { T5Storage } from './T5Storage'
import { T6Loop } from './T6Loop'
import { T7Analysis } from './T7Analysis'
import { PouchReveal } from '../stickers/PouchReveal'
import { WEEKLY_POOL } from '../stickers/catalog'
import s from './lab.module.css'

const yn = (b: boolean) => (b ? 'oui' : 'non')

function envInfo(): [string, string][] {
  const nav = navigator as Navigator & { standalone?: boolean; audioSession?: unknown }
  const standalone = nav.standalone === true || matchMedia('(display-mode: standalone)').matches
  return [
    ['App installée (écran d’accueil)', yn(standalone)],
    ['Navigateur', navigator.userAgent],
    ['audioSession', yn('audioSession' in navigator)],
    ['Wake Lock', yn('wakeLock' in navigator)],
    ['speechSynthesis', yn('speechSynthesis' in window)],
    ['OPFS (getDirectory)', yn(!!navigator.storage?.getDirectory)],
    ['requestVideoFrameCallback', yn('requestVideoFrameCallback' in HTMLVideoElement.prototype)],
    ['Réseau', navigator.onLine ? 'en ligne' : 'hors ligne'],
  ]
}

const VERDICT_TXT = { ok: 'RÉUSSI', mixed: 'MITIGÉ', ko: 'ÉCHEC' } as const

function buildReport(): string {
  const out = [`# Résultats phase 0 (${new Date().toLocaleString('fr-FR')})`, '']
  for (const [k, v] of envInfo()) out.push(`- ${k} : ${v}`)
  out.push('')
  for (const t of TESTS) {
    const r = readRecord(t.id)
    out.push(`## ${t.title}`, `Verdict : ${r.verdict ? VERDICT_TXT[r.verdict] : 'non testé'}`, r.note ? `Remarque : ${r.note}` : '', '')
  }
  return out.join('\n')
}

export function Lab() {
  const [report, setReport] = useState('')
  const [flash, setFlash] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  return (
    <main className={s.page}>
      <header className={s.head}>
        <Link to="/" style={{ color: 'var(--text-muted)' }}>Retour</Link>
        <h1>{APP_NAME} · Tests de faisabilité</h1>
        <p className={s.muted}>
          Phase 0. Ouvre cette page depuis l'app installée sur l'écran d'accueil de l'iPad, Spotify en lecture.
          Passe les sept tests dans l'ordre, donne un verdict à chacun, puis copie le rapport en bas de page.
        </p>
      </header>

      <dl className={s.env}>
        {envInfo().map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <T1Beep />
      <T2Voice />
      <T3Video />
      <T4WakeLock />
      <T5Storage />
      <T6Loop />
      <T7Analysis />

      <section className={s.card} aria-labelledby="rev-h">
        <h2 id="rev-h">Révélation d'une pochette (phase 7)</h2>
        <p className={s.muted}>Rejoue l'animation sans toucher à ta collection. Vérifie la fluidité sur l'iPad.</p>
        <div className={s.actions}>
          <Btn primary onClick={() => setPreview(WEEKLY_POOL[Math.floor(Math.random() * WEEKLY_POOL.length)]!)}>Rejouer (sticker courant)</Btn>
          <Btn onClick={() => setPreview('etoile-polaire')}>Rejouer (sticker rare)</Btn>
          <Btn onClick={() => setPreview('saturne:brillant')}>Rejouer (brillant)</Btn>
        </div>
      </section>
      {preview && <PouchReveal key={preview} stickerId={preview} volume={0.5} onDone={() => setPreview(null)} />}

      <section className={s.copy} aria-labelledby="rep-h">
        <h2 id="rep-h">Rapport</h2>
        <p className={s.muted}>Génère le rapport, copie-le et colle-le dans la conversation avec Claude Code.</p>
        <div className={s.actions}>
          <Btn primary onClick={() => setReport(buildReport())}>Générer le rapport</Btn>
          <Btn
            disabled={!report}
            onClick={() => void navigator.clipboard?.writeText(report).catch(() => undefined)}
          >
            Copier
          </Btn>
          <Btn onClick={() => { setFlash(true); window.setTimeout(() => setFlash(false), 600) }}>Test du flash plein écran</Btn>
        </div>
        {report && <pre className={s.log} style={{ maxHeight: 360 }}>{report}</pre>}
      </section>
      {flash && <div className={s.flash} aria-hidden="true" />}
    </main>
  )
}
