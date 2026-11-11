import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minus, Plus, Scissors, Merge } from 'lucide-react'
import { db } from '../data/db'
import type { VideoSource } from '../data/types'
import { useOpfsUrl } from '../video/useOpfsUrl'
import { saveSegments } from '../import/saveExercises'
import {
  adjust, clampCue, CUE_MAX, durationOf, formatTime, keptSegments, mergeWithNext, splitAt, STEP_SEC, wholeVideo, type Segment,
} from '../import/segments'
import { Screen } from '../app/Screen'
import { Switch } from '../ui/Switch'
import { Stepper } from '../ui/Stepper'
import { analyzeVideo } from '../import/detect/analyze'
import { getVideoFile } from '../data/opfs'
import { Button, IconButton } from '../ui/Button'
import ui from '../ui/ui.module.css'
import c from '../import/import.module.css'
import s from '../app/app.module.css'

export const TAGS = ['dos', 'épaules', 'hanches', 'nuque', 'jambes', 'poignets']

export function Split() {
  const { sourceId = '' } = useParams()
  const source = useLiveQuery(() => db.sources.get(sourceId), [sourceId])
  if (source === undefined) return null
  if (source === null) return <Screen title="Vidéo introuvable"><p className={s.empty}>Cette vidéo n'est plus sur l'iPad.</p></Screen>
  return <SplitEditor source={source} />
}

function SplitEditor({ source }: { source: VideoSource }) {
  const nav = useNavigate()
  const { url, error } = useOpfsUrl(source.opfsPath)
  const [segs, setSegs] = useState<Segment[]>(() => wholeVideo(source.durationSec))
  const [selId, setSelId] = useState(() => segs[0]?.id ?? '')
  const [pos, setPos] = useState(0)
  const [saving, setSaving] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const [useShots, setUseShots] = useState(true)
  const [useAudio, setUseAudio] = useState(true)
  const [useRhythm, setUseRhythm] = useState(false)
  const [effort, setEffort] = useState(30)
  const [rest, setRest] = useState(10)
  const [rhythmStart, setRhythmStart] = useState(0)
  const [progress, setProgress] = useState<{ label: string; ratio: number | null } | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const abort = useRef<AbortController | null>(null)
  const autoRan = useRef(false)

  const analyze = async () => {
    if (!source.opfsPath) return
    const ctl = new AbortController()
    abort.current = ctl
    setNotes([])
    setProgress({ label: 'Préparation', ratio: null })
    try {
      const file = await getVideoFile(source.opfsPath)
      const r = await analyzeVideo(file, source.durationSec, { shots: useShots, audio: useAudio, rhythm: useRhythm ? { effortSec: effort, restSec: rest, startSec: rhythmStart } : null }, (label, ratio) => setProgress({ label, ratio }), ctl.signal)
      setSegs(r.segments)
      setSelId(r.segments[0]?.id ?? '')
      setNotes(r.notes)
    } catch (e) {
      // Annulation : on garde les segments actuels. Autre échec : un seul segment à couper à la main.
      if ((e as Error).name !== 'AbortError') {
        const w = wholeVideo(source.durationSec)
        setSegs(w)
        setSelId(w[0]!.id)
        setNotes([`L'analyse a échoué (${(e as Error).message}). Coupe la vidéo à la main.`])
      }
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  // Fichier de plus de 90 s : l'analyse démarre toute seule à l'ouverture.
  useEffect(() => {
    if (autoRan.current || source.durationSec < 90) return
    autoRan.current = true
    void analyze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => abort.current?.abort(), [])

  const sel = segs.find((x) => x.id === selId)
  const selIndex = segs.findIndex((x) => x.id === selId)
  const duration = source.durationSec

  // Aperçu du segment sélectionné, en boucle.
  const start = sel?.startSec
  const end = sel?.endSec
  useEffect(() => {
    const v = video.current
    if (!v || start === undefined || end === undefined || !url) return
    const toStart = () => { try { v.currentTime = start } catch { /* pas prêt */ } }
    toStart()
    void v.play().catch(() => undefined)
    let stop = false
    let h = 0
    const loop = () => {
      if (stop) return
      if (v.currentTime >= end - 0.05 || v.currentTime < start - 0.3) toStart()
      h = requestAnimationFrame(loop)
    }
    h = requestAnimationFrame(loop)
    const id = window.setInterval(() => setPos(v.currentTime), 250)
    return () => { stop = true; cancelAnimationFrame(h); window.clearInterval(id) }
  }, [start, end, url])

  const patch = (id: string, p: Partial<Segment>) => setSegs((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const keptCount = keptSegments(segs).length

  const save = async () => {
    setSaving(true)
    await saveSegments(source, segs)
    nav('/bibliotheque')
  }

  if (error) return <Screen title="Vidéo introuvable"><p className={s.empty}>Cette vidéo n'est plus sur l'iPad.</p></Screen>

  return (
    <main className={c.page}>
      <header className={c.top}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <IconButton label="Retour à l'import" onClick={() => nav('/import')}><span aria-hidden="true">‹</span></IconButton>
          <div>
            <h1 style={{ fontSize: 26 }}>Découper la vidéo</h1>
            <p className={s.sub}>{source.title} · {formatTime(duration)} · {segs.length} segment{segs.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button variant="primary" disabled={keptCount === 0 || saving} onClick={() => void save()}>
          {saving ? 'Enregistrement…' : `Enregistrer ${keptCount} exercice${keptCount > 1 ? 's' : ''}`}
        </Button>
      </header>

      <div className={c.cols}>
        <div className={c.left}>
          <div className={c.preview}>
            {url && <video ref={video} src={url} muted playsInline aria-label="Aperçu du segment sélectionné" />}
            {sel && <span className={c.time}>{formatTime(sel.startSec)} – {formatTime(sel.endSec)}</span>}
          </div>

          <div className={c.card}>
            <span className={c.label}>Pré-marquage automatique</span>
            <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Changements de plan</span><Switch on={useShots} onChange={setUseShots} label="Changements de plan" /></div>
            <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Bips et silences</span><Switch on={useAudio} onChange={setUseAudio} label="Bips et silences" /></div>
            <div className={s.actions} style={{ justifyContent: 'space-between' }}>
              <span>Rythme régulier<br /><span className={ui.hint}>{effort} s d'effort, {rest} s de pause</span></span>
              <Switch on={useRhythm} onChange={setUseRhythm} label="Rythme régulier" />
            </div>
            {useRhythm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Effort</span><Stepper label="Durée d'effort" value={effort} min={5} max={120} step={5} unit="s" onChange={setEffort} /></div>
                <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Pause</span><Stepper label="Durée de pause" value={rest} min={0} max={60} step={5} unit="s" onChange={setRest} /></div>
                <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Premier exercice à</span><Stepper label="Début du premier exercice" value={rhythmStart} min={0} max={Math.max(0, Math.floor(source.durationSec) - 5)} step={5} unit="s" onChange={setRhythmStart} /></div>
              </div>
            )}
            {progress ? (
              <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className={s.msg}>{progress.label}…</span>
                <progress max={1} {...(progress.ratio === null ? {} : { value: progress.ratio })} style={{ width: '100%', height: 12 }} aria-label="Analyse en cours" />
                <Button onClick={() => abort.current?.abort()}>Annuler l'analyse</Button>
              </div>
            ) : (
              <div className={s.actions}>
                <Button onClick={() => void analyze()} disabled={!useShots && !useAudio && !useRhythm}>Analyser</Button>
                <Button onClick={() => { const w = wholeVideo(source.durationSec); setSegs(w); setSelId(w[0]!.id); setNotes([]) }}>Tout remettre à zéro</Button>
              </div>
            )}
            {notes.map((n) => <p key={n} className={ui.hint} style={{ margin: 0 }}>{n}</p>)}
          </div>

          {sel && (
            <div className={c.card}>
              <span className={c.label}>Segment sélectionné</span>
              <input type="range" className={c.scrub} min={sel.startSec} max={sel.endSec} step={0.1} value={Math.min(Math.max(pos, sel.startSec), sel.endSec)} aria-label="Position dans le segment" onChange={(e) => { if (video.current) video.current.currentTime = Number(e.target.value); setPos(Number(e.target.value)) }} />
              <div className={c.adjust} role="group" aria-label="Début">
                <span className={c.label} style={{ width: 56 }}>Début</span>
                <IconButton label="Début 0,5 s plus tôt" onClick={() => setSegs(adjust(segs, sel.id, 'start', -STEP_SEC, duration))}><Minus size={20} aria-hidden="true" /></IconButton>
                <strong>{sel.startSec.toFixed(1)} s</strong>
                <IconButton label="Début 0,5 s plus tard" onClick={() => setSegs(adjust(segs, sel.id, 'start', STEP_SEC, duration))}><Plus size={20} aria-hidden="true" /></IconButton>
              </div>
              <div className={c.adjust} role="group" aria-label="Fin">
                <span className={c.label} style={{ width: 56 }}>Fin</span>
                <IconButton label="Fin 0,5 s plus tôt" onClick={() => setSegs(adjust(segs, sel.id, 'end', -STEP_SEC, duration))}><Minus size={20} aria-hidden="true" /></IconButton>
                <strong>{sel.endSec.toFixed(1)} s</strong>
                <IconButton label="Fin 0,5 s plus tard" onClick={() => setSegs(adjust(segs, sel.id, 'end', STEP_SEC, duration))}><Plus size={20} aria-hidden="true" /></IconButton>
              </div>
              <div className={s.actions}>
                <Button onClick={() => { const next = splitAt(segs, sel.id, video.current?.currentTime ?? pos); setSegs(next) }}><Scissors size={18} aria-hidden="true" />Couper ici</Button>
                <Button disabled={selIndex >= segs.length - 1} onClick={() => setSegs(mergeWithNext(segs, sel.id))}><Merge size={18} aria-hidden="true" />Fusionner avec le suivant</Button>
              </div>
              <label className={c.field}>Consigne (lue par la voix, {CUE_MAX} caractères au plus)
                <input value={sel.cue} maxLength={CUE_MAX} onChange={(e) => patch(sel.id, { cue: clampCue(e.target.value) })} placeholder="Assise, dos droit" />
              </label>
              <div className={c.tags} role="group" aria-label="Zone du corps">
                {TAGS.map((t) => {
                  const on = sel.tags.includes(t)
                  return <button key={t} type="button" aria-pressed={on} className={[c.tag, on ? c.tagOn : ''].join(' ')} onClick={() => patch(sel.id, { tags: on ? sel.tags.filter((x) => x !== t) : [...sel.tags, t] })}>{t}</button>
                })}
              </div>
            </div>
          )}
        </div>

        <section className={c.list} aria-label="Segments">
          <div className={c.listHead}>
            <span className={c.label}>Segments</span>
            <span className={s.sub}>Touche un segment pour ajuster ses bornes</span>
          </div>
          {segs.map((x, i) => (
            <div key={x.id} className={[c.row, !x.kept ? c.rowOff : '', x.id === selId ? c.rowSel : ''].join(' ')} onClick={() => setSelId(x.id)}>
              <div className={c.rowThumb} aria-hidden="true" />
              <div className={c.rowMain}>
                <input className={c.rowName} style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', padding: 0, minHeight: 28 }} value={x.name} aria-label={`Nom du segment ${i + 1}`} onFocus={() => setSelId(x.id)} onChange={(e) => patch(x.id, { name: e.target.value })} />
                <span className={c.rowTime}>{formatTime(x.startSec)} – {formatTime(x.endSec)} · {Math.round(durationOf(x))} s</span>
              </div>
              {x.verify && <span className={c.verify}>Fin à vérifier</span>}
              <button type="button" className={[c.keep, x.kept ? '' : c.keepOff].join(' ')} aria-pressed={x.kept} aria-label={`${x.name} : ${x.kept ? 'gardé' : 'retiré'}`} onClick={(e) => { e.stopPropagation(); patch(x.id, { kept: !x.kept }) }}>{x.kept ? 'Gardé' : 'Retiré'}</button>
            </div>
          ))}
        </section>
      </div>

      <section className={c.timeline} aria-label="Toute la vidéo">
        <div className={s.actions} style={{ justifyContent: 'space-between' }}>
          <span className={c.label}>Toute la vidéo</span>
          <div className={c.legend}>
            <span><span className={c.dot} style={{ background: 'var(--effort)' }} />Gardé</span>
            <span><span className={c.dot} style={{ background: 'var(--transition)' }} />À vérifier</span>
            <span><span className={c.dot} style={{ background: 'var(--line)' }} />Retiré</span>
          </div>
        </div>
        <div className={c.bar} role="group" aria-label={`Frise de la vidéo découpée en ${segs.length} segments`}>
          {segs.map((x, i) => (
            <button key={x.id} type="button" className={[c.barSeg, x.id === selId ? c.barSel : ''].join(' ')} style={{ flex: Math.max(1, durationOf(x)), background: !x.kept ? 'var(--line)' : x.verify ? 'var(--transition)' : 'var(--effort)' }} aria-label={`Segment ${i + 1} : ${x.kept ? 'gardé' : 'retiré'}`} aria-pressed={x.id === selId} onClick={() => setSelId(x.id)} />
          ))}
        </div>
        <span className={ui.hint} style={{ display: 'flex', justifyContent: 'space-between' }}><span>0:00</span><span>{formatTime(duration)}</span></span>
      </section>
    </main>
  )
}
