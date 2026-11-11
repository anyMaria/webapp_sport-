import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minus, Plus, Scissors, Merge, Play, Pause, Rewind, FastForward, RotateCcw } from 'lucide-react'
import { db } from '../data/db'
import type { VideoSource } from '../data/types'
import { useOpfsUrl } from '../video/useOpfsUrl'
import { saveSegments } from '../import/saveExercises'
import {
  adjust, clampCue, CUE_MAX, durationOf, formatTime, keptSegments, mergeWithNext, splitAt, wholeVideo, type Segment,
} from '../import/segments'
import { Screen } from '../app/Screen'
import { createYTPlayer, fetchYouTubeChapters, youtubeChaptersEnabled, type YTPlayer } from '../video/youtube'
import { parseChapters } from '../import/chapters'
import { rhythmBoundaries } from '../import/detect/rhythm'
import { mergeCandidates } from '../import/detect/merge'
import { Timeline } from '../import/Timeline'
import { Stepper } from '../ui/Stepper'
import { getVideoFile } from '../data/opfs'
import { aiStatus, type AiStatus } from '../import/aiClient'
import { buildSegments, requestSegments, sampleSheets, snapBoundaries } from '../import/aiSegments'
import { analyzeShots } from '../import/detect/shots'
import { extractFrames, requestLabels, type Label } from '../import/aiLabels'
import { Button, IconButton } from '../ui/Button'
import ui from '../ui/ui.module.css'
import c from '../import/import.module.css'
import s from '../app/app.module.css'

export const TAGS = ['dos', 'épaules', 'hanches', 'nuque', 'jambes', 'poignets']
const RATES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10]
/** Le lecteur YouTube s'arrête à 2x : au-delà, on avance par petits sauts (voir `useYtFastScan`). */
const YT_MAX_RATE = 2
type Mode = 'manual' | 'rhythm' | 'ai' | 'youtube'
const STEPS = [0.5, 1, 3, 5]
const fmt = (n: number) => String(n).replace('.', ',')

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
  const isYT = source.kind === 'youtube'
  const [ytDur, setYtDur] = useState(source.durationSec)
  const [ytError, setYtError] = useState<string | null>(null)
  const [chapterText, setChapterText] = useState('')
  const ytHost = useRef<HTMLDivElement>(null)
  const ytRef = useRef<YTPlayer | null>(null)
  const [segs, setSegs] = useState<Segment[]>(() => source.draftSegs ?? (isYT && !source.durationSec ? [] : wholeVideo(source.durationSec)))
  const segsRef = useRef<Segment[]>([])
  const [selId, setSelId] = useState(() => segs[0]?.id ?? '')
  const [pos, setPos] = useState(0)
  const [saving, setSaving] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const mini = useRef<HTMLVideoElement>(null)
  const [rate, setRate] = useState(1)
  const rateRef = useRef(1)
  const [step, setStep] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [cutMsg, setCutMsg] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(isYT ? 'youtube' : 'manual')
  const [confirmReset, setConfirmReset] = useState(false)
  const [chaptersOn, setChaptersOn] = useState(false)
  const [chaptersBusy, setChaptersBusy] = useState(false)
  const [effort, setEffort] = useState(30)
  const [rest, setRest] = useState(10)
  const [rhythmStart, setRhythmStart] = useState(0)
  const [progress, setProgress] = useState<{ label: string; ratio: number | null } | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [aiOn, setAiOn] = useState(false)
  const [aiConfirm, setAiConfirm] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiProposals, setAiProposals] = useState<Label[] | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiInfo, setAiInfo] = useState<AiStatus | null>(null) // null : vérification en cours
  const aiSegOn = aiInfo?.enabled === true
  const [aiSegConfirm, setAiSegConfirm] = useState(false)
  useEffect(() => { void aiStatus().then((st) => { setAiInfo(st); setAiOn(st.enabled && source.kind === 'file') }) }, [source.kind])
  const abort = useRef<AbortController | null>(null)

  // Brouillon : le découpage en cours s'enregistre tout seul.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (saving) return
    const t = window.setTimeout(() => { void db.sources.update(source.id, { draftSegs: segs }) }, 400)
    return () => window.clearTimeout(t)
  }, [segs, saving, source.id])
  useEffect(() => { if (isYT) void youtubeChaptersEnabled().then(setChaptersOn) }, [isYT])

  useEffect(() => () => abort.current?.abort(), [])

  useEffect(() => { segsRef.current = segs }, [segs])
  const sel = segs.find((x) => x.id === selId)
  const selIndex = segs.findIndex((x) => x.id === selId)
  const duration = isYT ? ytDur : source.durationSec
  const getTime = () => (isYT ? ytRef.current?.getCurrentTime() : video.current?.currentTime) ?? pos

  const start = sel?.startSec
  const end = sel?.endSec

  // YouTube : lecteur visible et piloté, créé une seule fois.
  useEffect(() => {
    if (!isYT || !source.youtubeId || !ytHost.current) return
    let alive = true
    createYTPlayer(ytHost.current, source.youtubeId)
      .then((p) => {
        if (!alive) { p.destroy(); return }
        ytRef.current = p
        try { p.setPlaybackRate(Math.min(rateRef.current, YT_MAX_RATE)) } catch { /* pas prêt */ }
        const d = Math.floor(p.getDuration())
        if (d > 0) {
          setYtDur(d)
          void db.sources.update(source.id, { durationSec: d })
          setSegs((cur) => {
            if (cur.length) return cur
            const w = wholeVideo(d)
            setSelId(w[0]!.id)
            return w
          })
        }
      })
      .catch((e: Error) => alive && setYtError(e.message))
    return () => { alive = false; ytRef.current?.destroy(); ytRef.current = null }
  }, [isYT, source.youtubeId, source.id])

  // Position de lecture, lue régulièrement (la vidéo n'est plus bouclée : elle défile sur toute sa durée).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (isYT) {
        const p = ytRef.current
        if (!p) return
        try { setPos(p.getCurrentTime()); setPlaying(p.getPlayerState() === 1) } catch { /* pas prêt */ }
      } else if (video.current) {
        const t = video.current.currentTime
        setPos(t)
        // Pendant la lecture, le segment sélectionné suit la tête de lecture.
        if (!video.current.paused) {
          const host = segsRef.current.find((x) => t >= x.startSec && t < x.endSec)
          if (host) setSelId(host.id)
        }
      }
    }, isYT ? 250 : 100)
    return () => window.clearInterval(id)
  }, [isYT])

  const changeRate = (r: number) => {
    setRate(r)
    rateRef.current = r
    if (video.current) video.current.playbackRate = r
    try { ytRef.current?.setPlaybackRate(Math.min(r, YT_MAX_RATE)) } catch { /* pas prêt */ }
  }

  // Aperçu du segment sélectionné, en boucle, dans la petite fenêtre à côté des réglages.
  useEffect(() => {
    const v = mini.current
    if (isYT || !v || start === undefined || end === undefined || !url) return
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
    return () => { stop = true; cancelAnimationFrame(h) }
  }, [start, end, url, isYT])

  const seekTo = (t0: number) => {
    const t = Math.min(Math.max(0, t0), duration || t0)
    if (isYT) ytRef.current?.seekTo(t, true)
    else if (video.current) video.current.currentTime = t
    setPos(t)
    const host = segs.find((x) => t >= x.startSec && t < x.endSec)
    if (host) setSelId(host.id)
  }

  // YouTube au-delà de 2x : le lecteur joue à 2x et on ajoute un petit saut en avant toutes les 500 ms.
  useEffect(() => {
    if (!isYT || rate <= YT_MAX_RATE || !playing) return
    const id = window.setInterval(() => {
      const p = ytRef.current
      if (!p) return
      try { p.seekTo(p.getCurrentTime() + (rate - YT_MAX_RATE) * 0.5, true) } catch { /* pas prêt */ }
    }, 500)
    return () => window.clearInterval(id)
  }, [isYT, rate, playing])

  const togglePlay = () => {
    if (isYT) {
      const p = ytRef.current
      if (!p) return
      if (p.getPlayerState() === 1) p.pauseVideo(); else p.playVideo()
      return
    }
    const v = video.current
    if (!v) return
    if (v.paused) void v.play().catch(() => undefined); else v.pause()
  }

  const cutHere = () => {
    const t = getTime()
    const host = segs.find((x) => t > x.startSec && t < x.endSec)
    if (!host) { setCutMsg('Place la lecture à l’intérieur d’un segment.'); return }
    const next = splitAt(segs, host.id, t)
    if (next === segs) { setCutMsg('Trop près d’une coupe : un segment dure au moins 1 s.'); return }
    setCutMsg(null)
    setSegs(next)
    const i = next.findIndex((x) => x.id === host.id)
    setSelId(next[i + 1]!.id)
  }

  const runAiSegments = async () => {
    if (!source.opfsPath) return
    setAiSegConfirm(false); setNotes([])
    const ctl = new AbortController()
    abort.current = ctl
    setProgress({ label: 'Images de la vidéo', ratio: 0 })
    try {
      const file = await getVideoFile(source.opfsPath)
      // Changements d'image détectés sur l'appareil (vidéos de moins de 5 min) : l'IA s'en sert pour placer les coupes.
      let cuts: number[] = []
      if (source.durationSec <= 300) {
        setProgress({ label: "Changements d'image", ratio: 0 })
        try { cuts = (await analyzeShots(file, source.durationSec, (ratio) => setProgress({ label: "Changements d'image", ratio }), ctl.signal)).boundaries.map((b) => b.t) } catch (e) { if ((e as Error).name === 'AbortError') throw e }
      }
      const sheets = await sampleSheets(file, source.durationSec, ctl.signal, (ratio) => setProgress({ label: 'Images de la vidéo', ratio }))
      setProgress({ label: 'Réflexion de l\'IA', ratio: null })
      const { exercises: found, note } = await requestSegments(sheets, source.durationSec, cuts, ctl.signal)
      const next = buildSegments(snapBoundaries(found, cuts), source.durationSec)
      if (!next.some((x) => x.kept)) setNotes(["L'IA n'a repéré aucun exercice.", ...(note ? [note] : []), 'Coupe à la main, ou essaie « Rythme régulier ».'])
      else {
        setSegs(next); setSelId(next.find((x) => x.kept)?.id ?? next[0]!.id)
        setNotes([`${next.filter((x) => x.kept).length} exercices proposés. Les coupes sont approximatives (à quelques secondes près) : vérifie-les dans « Coupes manuelles ».`])
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNotes([(e as Error).message || 'La découpe par IA a échoué.'])
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  const runAi = async () => {
    if (!source.opfsPath) return
    setAiConfirm(false); setAiBusy(true); setAiError(null)
    const ctl = new AbortController()
    abort.current = ctl
    try {
      const file = await getVideoFile(source.opfsPath)
      const frames = await extractFrames(file, keptSegments(segs), ctl.signal)
      const labels = await requestLabels(frames, ctl.signal)
      if (!labels.length) setAiError("L'IA n'a rien proposé. Nomme les exercices à la main.")
      else setAiProposals(labels)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setAiError((e as Error).message || 'Le nommage par IA a échoué.')
    } finally {
      setAiBusy(false)
    }
  }

  const patch = (id: string, p: Partial<Segment>) => setSegs((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const keptCount = keptSegments(segs).length

  const save = async () => {
    setSaving(true)
    await saveSegments(source, segs)
    await db.sources.update(source.id, { draftSegs: undefined })
    nav('/bibliotheque')
  }


  if (error) return <Screen title="Vidéo introuvable"><p className={s.empty}>Cette vidéo n'est plus sur l'iPad.</p></Screen>

  const resetAll = () => {
    if (!duration) return
    const w = wholeVideo(duration)
    setSegs(w); setSelId(w[0]!.id); setNotes([])
  }

  return (
    <main className={c.page}>
      <header className={c.top}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <IconButton label="Retour à l'import" onClick={() => nav('/import')}><span aria-hidden="true">‹</span></IconButton>
          <div>
            <h1 style={{ fontSize: 26 }}>Découper la vidéo</h1>
            <p className={s.sub}>{source.title} · {duration ? formatTime(duration) : 'durée inconnue'} · {segs.length} segment{segs.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button variant="primary" disabled={keptCount === 0 || saving} onClick={() => void save()}>
          {saving ? 'Enregistrement…' : `Enregistrer ${keptCount} exercice${keptCount > 1 ? 's' : ''}`}
        </Button>
      </header>

      <div className={c.cols}>
        <div className={c.stage}>
          <div className={c.preview}>
            {isYT && <div ref={ytHost} style={{ position: 'absolute', inset: 0 }} />}
            {ytError && <span role="alert" style={{ position: 'absolute', padding: 16, color: 'var(--transition)', textAlign: 'center' }}>{ytError}</span>}
            {!isYT && url && (
              <video
                ref={video}
                src={url}
                muted
                playsInline
                aria-label="Vidéo à découper"
                onLoadedData={(e) => { e.currentTarget.playbackRate = rateRef.current; void e.currentTarget.play().catch(() => undefined) }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
            )}
          </div>

          <div className={c.transport} role="group" aria-label="Lecture">
            <Button onClick={() => seekTo(getTime() - step)} aria-label={`Reculer de ${fmt(step)} secondes`}><Rewind size={20} aria-hidden="true" />{fmt(step)} s</Button>
            <Button variant="primary" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Lecture'}>
              {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}{playing ? 'Pause' : 'Lecture'}
            </Button>
            <Button onClick={() => seekTo(getTime() + step)} aria-label={`Avancer de ${fmt(step)} secondes`}>{fmt(step)} s<FastForward size={20} aria-hidden="true" /></Button>
            <div className={c.speeds} role="group" aria-label="Vitesse de lecture">
              {RATES.map((r) => (
                <button key={r} type="button" className={[c.pick, rate === r ? c.pickOn : ''].join(' ')} aria-pressed={rate === r} onClick={() => changeRate(r)}>{fmt(r)}x</button>
              ))}
            </div>
          </div>

          <Timeline segs={segs} duration={duration} pos={pos} selId={selId} step={step} onSeek={seekTo} />

          <section className={c.list} aria-label="Segments">
          <div className={c.listHead}>
            <span className={c.label}>Segments</span>
            <span className={s.sub}>Touche un segment pour y aller</span>
          </div>
          {segs.map((x, i) => (
            <div key={x.id} className={[c.row, !x.kept ? c.rowOff : '', x.id === selId ? c.rowSel : ''].join(' ')} onClick={() => { setSelId(x.id); seekTo(x.startSec) }}>
              <div className={c.rowMain}>
                <input className={c.rowName} style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', padding: 0, minHeight: 28 }} value={x.name} aria-label={`Nom du segment ${i + 1}`} onFocus={() => setSelId(x.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => patch(x.id, { name: e.target.value })} />
                <span className={c.rowTime}>{formatTime(x.startSec)} – {formatTime(x.endSec)} · {Math.round(durationOf(x))} s</span>
              </div>
              {x.verify && <span className={c.verify}>Fin à vérifier</span>}
              <button type="button" className={[c.keep, x.kept ? '' : c.keepOff].join(' ')} aria-pressed={x.kept} aria-label={`${x.name} : ${x.kept ? 'gardé' : 'retiré'}`} onClick={(e) => { e.stopPropagation(); patch(x.id, { kept: !x.kept }) }}>{x.kept ? 'Gardé' : 'Retiré'}</button>
            </div>
          ))}
        </section>
        </div>

        <div className={c.side}>
          <div className={c.card}>
            <span className={c.label}>Mode de découpe</span>
            <div className={c.pickRow} role="group" aria-label="Mode de découpe">
              <button type="button" className={[c.pick, mode === 'manual' ? c.pickOn : ''].join(' ')} aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>Coupes manuelles</button>
              <button type="button" className={[c.pick, mode === 'rhythm' ? c.pickOn : ''].join(' ')} aria-pressed={mode === 'rhythm'} onClick={() => setMode('rhythm')}>Rythme régulier</button>
              <button type="button" className={[c.pick, mode === 'ai' ? c.pickOn : ''].join(' ')} aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>Découpe IA</button>
              {isYT && <button type="button" className={[c.pick, mode === 'youtube' ? c.pickOn : ''].join(' ')} aria-pressed={mode === 'youtube'} onClick={() => setMode('youtube')}>Marquage YouTube</button>}
            </div>
          </div>

          {mode === 'manual' && (
          <div className={c.card}>
            <span className={c.label}>Coupes manuelles</span>
            <Button variant="primary" className={c.cut} disabled={!duration} onClick={cutHere}>
              <Scissors size={22} aria-hidden="true" />Couper ici · {pos.toFixed(1)} s
            </Button>
            {cutMsg && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{cutMsg}</p>}
            <div role="group" aria-label="Pas d'ajustement" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className={ui.hint}>Pas d'ajustement (aussi pour reculer et avancer)</span>
              <div className={c.pickRow}>
                {STEPS.map((v) => (
                  <button key={v} type="button" className={[c.pick, step === v ? c.pickOn : ''].join(' ')} aria-pressed={step === v} onClick={() => setStep(v)}>{fmt(v)} s</button>
                ))}
              </div>
            </div>
            {sel ? (
              <>
                <div className={c.selInfo}>
                  {!isYT && url && <div className={c.mini}><video ref={mini} src={url} muted playsInline aria-label="Aperçu du segment sélectionné" /></div>}
                  <div className={c.selText}>
                    <strong>{sel.name}</strong>
                    <span className={ui.hint}>{formatTime(sel.startSec)} – {formatTime(sel.endSec)} · {Math.round(durationOf(sel))} s</span>
                    <Button disabled={selIndex >= segs.length - 1} onClick={() => setSegs(mergeWithNext(segs, sel.id))}><Merge size={18} aria-hidden="true" />Fusionner</Button>
                  </div>
                </div>
                <div className={c.adjust} role="group" aria-label="Début">
                  <span className={c.label} style={{ width: 56 }}>Début</span>
                  <IconButton label={`Début ${fmt(step)} s plus tôt`} onClick={() => setSegs(adjust(segs, sel.id, 'start', -step, duration))}><Minus size={20} aria-hidden="true" /></IconButton>
                  <strong>{sel.startSec.toFixed(1)} s</strong>
                  <IconButton label={`Début ${fmt(step)} s plus tard`} onClick={() => setSegs(adjust(segs, sel.id, 'start', step, duration))}><Plus size={20} aria-hidden="true" /></IconButton>
                </div>
                <div className={c.adjust} role="group" aria-label="Fin">
                  <span className={c.label} style={{ width: 56 }}>Fin</span>
                  <IconButton label={`Fin ${fmt(step)} s plus tôt`} onClick={() => setSegs(adjust(segs, sel.id, 'end', -step, duration))}><Minus size={20} aria-hidden="true" /></IconButton>
                  <strong>{sel.endSec.toFixed(1)} s</strong>
                  <IconButton label={`Fin ${fmt(step)} s plus tard`} onClick={() => setSegs(adjust(segs, sel.id, 'end', step, duration))}><Plus size={20} aria-hidden="true" /></IconButton>
                </div>
              </>
            ) : (
              <p className={ui.hint} style={{ margin: 0 }}>Lance la lecture et touche « Couper ici » à chaque changement d'exercice.</p>
            )}
            <hr className={c.sep} />
            {confirmReset ? (
              <div role="alertdialog" aria-label="Tout remettre à zéro" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className={s.msg}>Effacer toutes les coupes et recommencer avec un seul segment ?</p>
                <div className={s.actions}>
                  <Button variant="danger" onClick={() => { resetAll(); setConfirmReset(false) }}>Oui, tout effacer</Button>
                  <Button onClick={() => setConfirmReset(false)}>Annuler</Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" disabled={!duration || segs.length < 2} onClick={() => setConfirmReset(true)}><RotateCcw size={18} aria-hidden="true" />Tout remettre à zéro</Button>
            )}
          </div>
          )}

          {mode === 'rhythm' && (
            <div className={c.card}>
              <span className={c.label}>Rythme régulier</span>
              <p className={ui.hint} style={{ margin: 0 }}>Pour une vidéo où chaque exercice dure pareil. Remplace les coupes actuelles.</p>
              <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Effort</span><Stepper label="Durée d'effort" value={effort} min={5} max={120} step={5} unit="s" onChange={setEffort} /></div>
              <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Pause</span><Stepper label="Durée de pause" value={rest} min={0} max={60} step={5} unit="s" onChange={setRest} /></div>
              <div className={s.actions} style={{ justifyContent: 'space-between' }}><span>Début du rythme</span><Stepper label="Début du rythme" value={rhythmStart} min={0} max={Math.max(0, Math.floor(duration) - 5)} step={1} unit="s" onChange={setRhythmStart} /></div>
              <p className={ui.hint} style={{ margin: 0 }}>S'il y a une introduction, place le début après elle.</p>
              <div className={s.actions}>
                <Button disabled={!duration} onClick={() => setRhythmStart(Math.min(Math.max(0, Math.floor(getTime())), Math.max(0, Math.floor(duration) - 5)))}>Début = position de lecture ({pos.toFixed(0)} s)</Button>
                <Button variant="primary" disabled={!duration} onClick={() => {
                  const r = mergeCandidates(rhythmBoundaries({ effortSec: effort, restSec: rest, startSec: rhythmStart }, duration, []), duration)
                  setSegs(r); setSelId(r[0]?.id ?? ''); setNotes(['Rythme régulier appliqué.'])
                }}>Appliquer le rythme régulier</Button>
              </div>
              {notes.map((n) => <p key={n} className={ui.hint} style={{ margin: 0 }}>{n}</p>)}
            </div>
          )}


          {sel && (
            <div className={c.card}>
              <span className={c.label}>Consigne et zone du corps</span>
              <p className={ui.hint} style={{ margin: 0 }}>Dit à voix haute : « Ensuite : {sel.name.trim() || 'sans nom'}, {Math.round(durationOf(sel))} secondes.{sel.cue ? ` ${sel.cue}` : ''} »</p>
              <label className={c.field}>Précision, facultative (dite après le nom, {CUE_MAX} caractères au plus)
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

          {isYT && mode === 'youtube' && (
            <div className={c.card}>
              <span className={c.label}>Marquage YouTube</span>
              <p className={ui.hint} style={{ margin: 0 }}>Touche « Marquer ici » à chaque changement d'exercice pendant la lecture, ou utilise les repères de la description. L'analyse automatique n'est pas possible avec le lecteur YouTube.</p>
              <Button variant="primary" className={c.cut} disabled={!duration} onClick={cutHere}><Scissors size={22} aria-hidden="true" />Marquer ici · {pos.toFixed(1)} s</Button>
              {cutMsg && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{cutMsg}</p>}
              {chaptersOn && source.youtubeId && (
                <Button disabled={chaptersBusy} onClick={async () => {
                  setChaptersBusy(true); setNotes([])
                  try {
                    const d = await fetchYouTubeChapters(source.youtubeId!)
                    setChapterText(d)
                    setNotes([parseChapters(d, duration || 1).length ? 'Repères récupérés dans la description. Vérifie-les, puis touche « Importer les repères ».' : 'Cette vidéo n’a pas de repères dans sa description.'])
                  } catch (e) { setNotes([(e as Error).message]) }
                  setChaptersBusy(false)
                }}>{chaptersBusy ? 'Lecture…' : 'Récupérer les repères de YouTube'}</Button>
              )}
              <label className={c.field}>Repères de la description (une ligne par exercice, ex. « 2:15 Chat-vache »)
                <textarea value={chapterText} onChange={(e) => setChapterText(e.target.value)} rows={4} style={{ borderRadius: 14, border: '2px solid var(--border)', background: 'var(--bg-deep)', padding: 10, color: 'inherit', font: 'inherit' }} />
              </label>
              <div className={s.actions}>
                <Button disabled={!duration || !chapterText.trim()} onClick={() => {
                  const r = parseChapters(chapterText, duration)
                  if (!r.length) { setNotes(['Aucun repère reconnu. Format attendu : « 2:15 Nom ».']); return }
                  setSegs(r); setSelId(r[0]!.id); setNotes([`${r.length} repères importés.`])
                }}>Importer les repères</Button>
              </div>
              {notes.map((n) => <p key={n} className={ui.hint} style={{ margin: 0 }}>{n}</p>)}
            </div>
          )}

          {isYT && mode === 'ai' && (
            <div className={c.card}>
              <span className={c.label}>Découpe IA</span>
              <p className={ui.hint} style={{ margin: 0 }}>L'IA a besoin des images de la vidéo, et le lecteur YouTube ne les donne pas. Pour utiliser l'IA, importe le fichier vidéo (« Importer une vidéo » puis YouTube, « Choisir des fichiers »). Ici, utilise « Marquage YouTube » ou « Rythme régulier ».</p>
            </div>
          )}

          {!isYT && mode === 'ai' && (
            <div className={c.card}>
              <span className={c.label}>Découpe IA</span>
              <p className={ui.hint} style={{ margin: 0 }}>Une IA regarde des images de la vidéo et propose les coupes. Les coupes sont approximatives : vérifie-les et corrige-les dans « Coupes manuelles ».</p>
              {aiInfo === null && <p className={ui.hint} style={{ margin: 0 }}>Vérification du service d'IA…</p>}
              {aiInfo !== null && !aiSegOn && (
                <p role="status" className={ui.hint} style={{ margin: 0, color: 'var(--transition)' }}>
                  {aiInfo.hasKey ? `Le bouton « Découper avec l'IA » est caché : ${aiInfo.reason ?? "aucun modèle de vision n'est choisi (variable XAI_MODEL)."}` : "Le bouton « Découper avec l'IA » est caché : le service d'IA n'est pas joignable ou n'a pas de clé. Si tu viens de le configurer, ferme complètement l'app et rouvre-la pour charger la dernière version."}
                </p>
              )}
              {aiSegOn && !progress && (
                aiSegConfirm ? (
                  <div role="alertdialog" aria-label="Envoyer des images au service d'IA" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p className={s.msg}>Jusqu'à une centaine d'images de cette vidéo vont quitter l'iPad pour être envoyées à {aiInfo?.provider ?? "un service d'IA"}, qui les analyse. Elles ne sont pas enregistrées dans l'app.</p>
                    <div className={s.actions}><Button variant="primary" onClick={() => void runAiSegments()}>Envoyer les images</Button><Button onClick={() => setAiSegConfirm(false)}>Annuler</Button></div>
                  </div>
                ) : (
                  <Button variant="primary" disabled={!source.durationSec} onClick={() => setAiSegConfirm(true)}>Découper avec l'IA</Button>
                )
              )}
              {progress && (
                <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className={s.msg}>{progress.label}…</span>
                  <progress max={1} {...(progress.ratio === null ? {} : { value: progress.ratio })} style={{ width: '100%', height: 12 }} aria-label="Analyse en cours" />
                  <Button onClick={() => abort.current?.abort()}>Annuler</Button>
                </div>
              )}
              {notes.map((n) => <p key={n} className={ui.hint} style={{ margin: 0 }}>{n}</p>)}
              {aiOn && !aiProposals && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aiConfirm ? (
                    <div role="alertdialog" aria-label="Envoyer des images à un service d'IA" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p className={s.msg}>Des images de cette vidéo (3 par exercice gardé) vont quitter l'iPad pour être envoyées à {aiInfo?.provider ?? "un service d'IA"}, qui les analyse. Elles ne sont pas enregistrées dans l'app.</p>
                      <div className={s.actions}><Button variant="primary" onClick={() => void runAi()}>Envoyer les images</Button><Button onClick={() => setAiConfirm(false)}>Annuler</Button></div>
                    </div>
                  ) : (
                    <Button disabled={aiBusy || keptCount === 0} onClick={() => setAiConfirm(true)}>{aiBusy ? 'Nommage en cours…' : "Nommer les exercices avec l'IA"}</Button>
                  )}
                  {aiError && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{aiError}</p>}
                </div>
              )}
              {aiProposals && (
                <div role="group" aria-label="Propositions de l'IA" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className={c.label}>Propositions : vérifie et corrige</span>
                  {aiProposals.map((p) => (
                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input aria-label="Nom proposé" value={p.name} onChange={(e) => setAiProposals(aiProposals.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} style={{ minHeight: 48, borderRadius: 14, border: '2px solid var(--border)', background: 'var(--bg-deep)', padding: '0 12px', color: 'inherit' }} />
                      <input aria-label="Consigne proposée" maxLength={CUE_MAX} value={p.cue} onChange={(e) => setAiProposals(aiProposals.map((x) => (x.id === p.id ? { ...x, cue: clampCue(e.target.value) } : x)))} style={{ minHeight: 48, borderRadius: 14, border: '2px solid var(--border)', background: 'var(--bg-deep)', padding: '0 12px', color: 'inherit' }} />
                    </div>
                  ))}
                  <div className={s.actions}>
                    <Button variant="primary" onClick={() => { setSegs((l) => l.map((x) => { const p = aiProposals.find((y) => y.id === x.id); return p ? { ...x, name: p.name, cue: p.cue } : x })); setAiProposals(null) }}>Valider ces noms</Button>
                    <Button onClick={() => setAiProposals(null)}>Ignorer</Button>
                  </div>
                  <p className={ui.hint} style={{ margin: 0 }}>Rien n'est enregistré tant que tu n'as pas validé, puis enregistré les exercices.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
