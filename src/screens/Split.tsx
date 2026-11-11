import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronDown, ChevronLeft, FastForward, ListOrdered, Merge, Minus, Pause, Play, Plus, Rewind, RotateCcw, Scissors, Sparkles, Timer, Trash2 } from 'lucide-react'
import { db } from '../data/db'
import type { VideoSource } from '../data/types'
import { useOpfsUrl } from '../video/useOpfsUrl'
import { saveSegments } from '../import/saveExercises'
import {
  clampCue, CUE_MAX, durationOf, fillGaps, formatTime, keptSegments, mergeWithNext, MIN_SEGMENT_SEC, moveBoundary, renumber, splitAt, wholeVideo, type Segment,
} from '../import/segments'
import { Screen } from '../app/Screen'
import { Steps } from '../app/Steps'
import { createYTPlayer, fetchYouTubeChapters, youtubeChaptersEnabled, type YTPlayer } from '../video/youtube'
import { parseChapters } from '../import/chapters'
import { rhythmBoundaries } from '../import/detect/rhythm'
import { mergeCandidates } from '../import/detect/merge'
import { Timeline } from '../import/Timeline'
import { Stepper } from '../ui/Stepper'
import { getVideoFile } from '../data/opfs'
import { aiStatus, type AiStatus } from '../import/aiClient'
import { buildSegments, PER_SHEET, requestMarks, sampleSheets, sheetCount, snapBoundaries } from '../import/aiSegments'
import { analyzeShots } from '../import/detect/shots'
import { extractFrames, requestLabels, type Label } from '../import/aiLabels'
import { Button, IconButton } from '../ui/Button'
import ui from '../ui/ui.module.css'
import c from '../import/import.module.css'
import s from '../app/app.module.css'

export const TAGS = ['dos', 'épaules', 'hanches', 'nuque', 'jambes', 'poignets']
const RATES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10]
/** Le lecteur YouTube s'arrête à 2x : au-delà, on avance par petits sauts. */
const YT_MAX_RATE = 2
type Help = 'ai' | 'rhythm' | 'chapters' | null
const fmt = (n: number) => String(n).replace('.', ',')
const nowMs = () => performance.now()
/** Instant au dixième de seconde : « 1:05,4 ». */
const clock = (t: number) => {
  const m = Math.floor(t / 60)
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0').replace('.', ',')}`
}

export function Split() {
  const { sourceId = '' } = useParams()
  const source = useLiveQuery(() => db.sources.get(sourceId), [sourceId])
  if (source === undefined) return null
  if (source === null) return <Screen title="Vidéo introuvable"><p className={s.empty}>Cette vidéo n'est plus sur l'iPad.</p></Screen>
  return <SplitEditor source={source} />
}

/** Une aide repliable de la carte « Aides ». */
function HelpToggle({ open, onToggle, icon, title, sub, children }: { open: boolean; onToggle: () => void; icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <div className={[c.help, open ? c.helpOpen : ''].join(' ')}>
      <button type="button" className={c.helpHead} aria-expanded={open} onClick={onToggle}>
        <span className={c.helpIcon}>{icon}</span>
        <span className={c.helpText}><strong>{title}</strong><span>{sub}</span></span>
        <ChevronDown size={22} aria-hidden="true" className={open ? c.chevOpen : ''} />
      </button>
      {open && <div className={c.helpBody}>{children}</div>}
    </div>
  )
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
  const [segs, setSegs] = useState<Segment[]>(() => {
    if (isYT && !source.durationSec) return source.draftSegs ?? []
    return source.draftSegs ? fillGaps(source.draftSegs, source.durationSec) : wholeVideo(source.durationSec)
  })
  const segsRef = useRef<Segment[]>([])
  const [selId, setSelId] = useState(() => segs[0]?.id ?? '')
  const [cutSel, setCutSel] = useState<number | null>(null)
  const [pos, setPos] = useState(0)
  const [saving, setSaving] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const mini = useRef<HTMLVideoElement>(null)
  const [rate, setRate] = useState(1)
  const rateRef = useRef(1)
  const [playing, setPlaying] = useState(false)
  /** Largeur / hauteur de la vidéo : une vidéo en hauteur (TikTok) se place à côté des commandes, pas au-dessus. */
  const [aspect, setAspect] = useState<number | null>(null)
  const [cutMsg, setCutMsg] = useState<string | null>(null)
  const [help, setHelp] = useState<Help>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [chaptersOn, setChaptersOn] = useState(false)
  const [chaptersBusy, setChaptersBusy] = useState(false)
  const [effort, setEffort] = useState(30)
  const [rest, setRest] = useState(10)
  const [rhythmStart, setRhythmStart] = useState(0)
  const [progress, setProgress] = useState<{ label: string; ratio: number | null } | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiProposals, setAiProposals] = useState<Label[] | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiInfo, setAiInfo] = useState<AiStatus | null>(null) // null : vérification en cours
  const aiOn = aiInfo?.enabled === true
  useEffect(() => { void aiStatus().then(setAiInfo) }, [])
  const abort = useRef<AbortController | null>(null)
  /** Dernier instant demandé pendant un glissement, quand la vidéo n'a pas fini le saut précédent. */
  const pendingSeek = useRef<number | null>(null)
  const ytSeekTimer = useRef(0)
  const ytSeekAt = useRef(0)
  const movedAt = useRef(0)

  // Brouillon : le découpage en cours s'enregistre tout seul.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (saving) return
    const t = window.setTimeout(() => { void db.sources.update(source.id, { draftSegs: segs }) }, 400)
    return () => window.clearTimeout(t)
  }, [segs, saving, source.id])
  useEffect(() => { if (isYT) void youtubeChaptersEnabled().then(setChaptersOn) }, [isYT])

  useEffect(() => () => { abort.current?.abort(); window.clearTimeout(ytSeekTimer.current) }, [])

  useEffect(() => { segsRef.current = segs }, [segs])
  const sel = segs.find((x) => x.id === selId)
  const selIndex = segs.findIndex((x) => x.id === selId)
  const duration = isYT ? ytDur : source.durationSec
  const getTime = () => (isYT ? ytRef.current?.getCurrentTime() : video.current?.currentTime) ?? pos
  const cutSeg = cutSel !== null && segs[cutSel + 1] ? segs[cutSel] : undefined
  const toVerify = segs.slice(0, -1).filter((x) => x.verify).length

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
            if (cur.length) return fillGaps(cur, d)
            const w = wholeVideo(d)
            setSelId(w[0]!.id)
            return w
          })
        }
      })
      .catch((e: Error) => alive && setYtError(e.message))
    return () => { alive = false; ytRef.current?.destroy(); ytRef.current = null }
  }, [isYT, source.youtubeId, source.id])

  // Position de lecture, lue régulièrement (la vidéo défile sur toute sa durée). Juste après un déplacement demandé
  // par l'écran, on laisse la vidéo arriver avant de relire sa position : sinon la tête de lecture tremble.
  useEffect(() => {
    const id = window.setInterval(() => {
      const settled = nowMs() - movedAt.current > 600
      if (isYT) {
        const p = ytRef.current
        if (!p) return
        try {
          const on = p.getPlayerState() === 1
          setPlaying(on)
          if (on || settled) setPos(p.getCurrentTime())
        } catch { /* pas prêt */ }
      } else if (video.current) {
        const v = video.current
        if (v.paused && !settled) return
        const t = v.currentTime
        setPos(t)
        // Pendant la lecture, l'exercice sélectionné suit la tête de lecture.
        if (!v.paused) {
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

  // Aperçu de l'exercice sélectionné, en boucle, dans la petite fenêtre à côté de son nom.
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

  /**
   * Place la vidéo à un instant. Appelée en rafale pendant un glissement : pour un fichier, on attend la fin du saut
   * en cours avant le suivant ; pour YouTube, quatre sauts par seconde au plus, et toujours le dernier.
   */
  const moveVideo = (t: number) => {
    setPos(t)
    movedAt.current = nowMs()
    if (isYT) {
      const go = () => { ytSeekAt.current = nowMs(); try { ytRef.current?.seekTo(t, true) } catch { /* pas prêt */ } }
      window.clearTimeout(ytSeekTimer.current)
      if (nowMs() - ytSeekAt.current > 250) go()
      else ytSeekTimer.current = window.setTimeout(go, 250)
      return
    }
    const v = video.current
    if (!v) return
    if (v.seeking) pendingSeek.current = t
    else { pendingSeek.current = null; v.currentTime = t }
  }

  const seekTo = (t0: number) => {
    const t = Math.min(Math.max(0, t0), duration || t0)
    moveVideo(t)
    const host = segsRef.current.find((x) => t >= x.startSec && t < x.endSec)
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

  const pause = () => {
    if (isYT) { try { ytRef.current?.pauseVideo() } catch { /* pas prêt */ } } else video.current?.pause()
  }
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
    if (!host) { setCutMsg('Place la lecture à l’intérieur d’un exercice.'); return }
    const cut = splitAt(segs, host.id, t)
    const next = renumber(cut)
    if (cut === segs) { setCutMsg('Trop près d’une autre coupe : il faut au moins 1 s entre deux coupes.'); return }
    setCutMsg(null)
    setSegs(next)
    const i = next.findIndex((x) => x.id === host.id)
    setSelId(next[i + 1]!.id)
    setCutSel(i)
  }

  /** Déplace une coupe (glissée sur la frise, ou poussée par les boutons) : la vidéo montre l'image à cet instant. */
  const moveCut = (index: number, t: number) => {
    const a = segsRef.current[index]
    const b = segsRef.current[index + 1]
    if (!a || !b) return
    const at = Math.min(b.endSec - MIN_SEGMENT_SEC, Math.max(a.startSec + MIN_SEGMENT_SEC, t))
    setSegs((l) => moveBoundary(l, index, at))
    moveVideo(at)
  }
  const selectCut = (index: number | null) => {
    setCutSel(index)
    const a = index === null ? undefined : segs[index]
    if (a && segs[index! + 1]) { pause(); moveVideo(a.endSec); setSelId(a.id) }
  }
  const removeCut = (index: number) => {
    const a = segs[index]
    if (!a) return
    setSegs(renumber(mergeWithNext(segs, a.id)))
    setSelId(a.id)
    setCutSel(null)
  }

  const runAiMarks = async () => {
    if (!source.opfsPath) return
    setNotes([])
    const ctl = new AbortController()
    abort.current = ctl
    setProgress({ label: 'Préparation des images', ratio: 0 })
    try {
      const file = await getVideoFile(source.opfsPath)
      // Changements d'image détectés sur l'appareil (vidéos de moins de 5 min) : les repères de l'IA sont calés dessus.
      let shots: number[] = []
      if (source.durationSec <= 300) {
        try { shots = (await analyzeShots(file, source.durationSec, (ratio) => setProgress({ label: 'Préparation des images', ratio: ratio / 2 }), ctl.signal)).boundaries.map((b) => b.t) } catch (e) { if ((e as Error).name === 'AbortError') throw e }
      }
      const sheets = await sampleSheets(file, source.durationSec, ctl.signal, (ratio) => setProgress({ label: 'Préparation des images', ratio: 0.5 + ratio / 2 }))
      const { found, notes: problems } = await requestMarks(sheets, source.durationSec, ctl.signal, (done, total, waitSec) => setProgress({
        label: waitSec ? `Le service d'IA demande une pause de ${waitSec} s, puis ça reprend` : `L'IA regarde la vidéo (partie ${done + 1} sur ${total})`,
        ratio: done / total,
      }))
      const stepSec = source.durationSec / Math.max(1, sheets.length * (PER_SHEET - 1))
      const next = buildSegments(snapBoundaries(found, shots, Math.min(1.5, Math.max(0.5, stepSec))), source.durationSec)
      const n = next.filter((x) => x.kept).length
      if (!n) setNotes(["L'IA n'a repéré aucun exercice.", ...problems, 'Tu peux couper à la main avec « Couper ici ».'])
      else {
        setSegs(next); setSelId(next.find((x) => x.kept)?.id ?? next[0]!.id); setCutSel(null)
        setNotes([`${n} exercice${n > 1 ? 's' : ''} repéré${n > 1 ? 's' : ''}. Les traits orange sont des propositions : attrape-les sur la frise pour les ajuster.`, ...problems])
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNotes([(e as Error).message || "Le repérage par l'IA a échoué."])
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  const runAiNames = async () => {
    if (!source.opfsPath) return
    setAiBusy(true); setAiError(null)
    const ctl = new AbortController()
    abort.current = ctl
    try {
      const file = await getVideoFile(source.opfsPath)
      const frames = await extractFrames(file, keptSegments(segs), ctl.signal)
      const labels = await requestLabels(frames, ctl.signal)
      if (!labels.length) setAiError("L'IA n'a rien proposé. Nomme les exercices à la main.")
      else setAiProposals(labels)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setAiError((e as Error).message || "Le nommage par l'IA a échoué.")
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
    // Étape suivante : la séance, déjà remplie avec cette vidéo.
    nav(`/composer/nouvelle?video=${source.id}`)
  }

  if (error) return <Screen title="Vidéo introuvable"><p className={s.empty}>Cette vidéo n'est plus sur l'iPad.</p></Screen>

  const replaceAll = (next: Segment[], note: string) => {
    const full = renumber(fillGaps(next, duration))
    setSegs(full); setSelId(full[0]?.id ?? ''); setCutSel(null); setNotes([note])
  }
  const resetAll = () => {
    if (!duration) return
    const w = wholeVideo(duration)
    setSegs(w); setSelId(w[0]!.id); setCutSel(null); setNotes([])
  }
  const toggleHelp = (h: Help) => { setHelp(help === h ? null : h); setNotes([]) }
  const rateIndex = RATES.indexOf(rate)
  const cutLabel = isYT ? 'Marquer ici' : 'Couper ici'
  const portrait = !isYT && aspect !== null && aspect < 0.9

  return (
    <main className={c.page}>
      <header className={c.top}>
        <div className={c.topTitle}>
          <IconButton label="Retour à mes vidéos" onClick={() => nav('/videos')}><ChevronLeft size={24} aria-hidden="true" /></IconButton>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 26 }}>Découper la vidéo</h1>
            <p className={s.sub}>{source.title} · {duration ? formatTime(duration) : 'durée inconnue'}</p>
          </div>
        </div>
        <Steps current={2} />
        <Button variant="primary" disabled={keptCount === 0 || saving} onClick={() => void save()}>
          {saving ? 'Enregistrement…' : `Enregistrer ${keptCount} exercice${keptCount > 1 ? 's' : ''}`}
        </Button>
      </header>

      <div className={c.cols}>
        <div className={c.stage}>
          <div className={[c.watch, portrait ? c.watchPortrait : ''].join(' ')}>
            <div className={c.preview} style={portrait ? { aspectRatio: String(aspect) } : undefined}>
              {isYT && <div ref={ytHost} style={{ position: 'absolute', inset: 0 }} />}
              {ytError && <span role="alert" style={{ position: 'absolute', padding: 16, color: 'var(--transition)', textAlign: 'center' }}>{ytError}</span>}
              {!isYT && url && (
                <video
                  ref={video}
                  src={url}
                  muted
                  playsInline
                  aria-label="Vidéo à découper"
                  onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight) }}
                  onLoadedData={(e) => { e.currentTarget.playbackRate = rateRef.current; void e.currentTarget.play().catch(() => undefined) }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  onSeeked={(e) => { const t = pendingSeek.current; if (t !== null) { pendingSeek.current = null; e.currentTarget.currentTime = t } }}
                />
              )}
            </div>

            <div className={c.controls}>
              <div className={c.transport} role="group" aria-label="Lecture">
                <Button className={c.jump} onClick={() => seekTo(getTime() - 5)} aria-label="Reculer de 5 secondes"><Rewind size={20} aria-hidden="true" />5 s</Button>
                <Button className={c.jump} onClick={() => seekTo(getTime() - 1)} aria-label="Reculer de 1 seconde"><Rewind size={20} aria-hidden="true" />1 s</Button>
                <Button variant="primary" className={c.playBtn} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Lecture'}>
                  {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}{playing ? 'Pause' : 'Lecture'}
                </Button>
                <Button className={c.jump} onClick={() => seekTo(getTime() + 1)} aria-label="Avancer de 1 seconde">1 s<FastForward size={20} aria-hidden="true" /></Button>
                <Button className={c.jump} onClick={() => seekTo(getTime() + 5)} aria-label="Avancer de 5 secondes">5 s<FastForward size={20} aria-hidden="true" /></Button>
              </div>
              <div className={c.speed} role="group" aria-label="Vitesse de lecture">
                <span className={c.label}>Vitesse</span>
                <IconButton label="Lecture plus lente" disabled={rateIndex <= 0} onClick={() => changeRate(RATES[rateIndex - 1]!)}><Minus size={20} aria-hidden="true" /></IconButton>
                <strong aria-live="polite">{fmt(rate)}x</strong>
                <IconButton label="Lecture plus rapide" disabled={rateIndex >= RATES.length - 1} onClick={() => changeRate(RATES[rateIndex + 1]!)}><Plus size={20} aria-hidden="true" /></IconButton>
              </div>
              <Button variant="primary" className={c.cut} disabled={!duration} onClick={cutHere}>
                <Scissors size={24} aria-hidden="true" />{cutLabel} · {clock(pos)}
              </Button>
              {cutMsg && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{cutMsg}</p>}
            </div>
          </div>

          <Timeline segs={segs} duration={duration} pos={pos} selId={selId} cutSel={cutSel} playing={playing} onSeek={seekTo} onSelectCut={selectCut} onCutGrab={(i) => { pause(); setCutSel(i) }} onMoveCut={moveCut}>
            {cutSeg && cutSel !== null ? (
              <div className={c.cutBar} role="group" aria-label="Coupe sélectionnée">
                <span className={c.cutBarText}><strong>Coupe à {clock(cutSeg.endSec)}</strong><span>entre « {cutSeg.name} » et « {segs[cutSel + 1]!.name} »</span></span>
                <div className={c.nudges}>
                  {[-1, -0.1, 0.1, 1].map((d) => (
                    <button key={d} type="button" className={c.nudge} aria-label={`Déplacer la coupe de ${fmt(Math.abs(d))} seconde ${d < 0 ? 'plus tôt' : 'plus tard'}`} onClick={() => moveCut(cutSel, cutSeg.endSec + d)}>{d < 0 ? '−' : '+'}{fmt(Math.abs(d))} s</button>
                  ))}
                </div>
                {cutSeg.verify && <Button onClick={() => patch(cutSeg.id, { verify: false })}><Check size={18} aria-hidden="true" />C'est bon</Button>}
                <Button variant="danger" onClick={() => removeCut(cutSel)}><Trash2 size={18} aria-hidden="true" />Retirer la coupe</Button>
              </div>
            ) : toVerify > 0 ? (
              <div className={c.cutBar}>
                <span className={c.cutBarText}><strong>{toVerify} coupe{toVerify > 1 ? 's' : ''} à vérifier</strong><span>Touche un trait orange pour le régler, ou glisse-le.</span></span>
                <Button onClick={() => setSegs((l) => l.map((x) => (x.verify ? { ...x, verify: false } : x)))}><Check size={18} aria-hidden="true" />Tout est bon</Button>
              </div>
            ) : segs.length <= 1 ? (
              <p className={c.tlHint}>Lance la lecture et touche « {cutLabel} » à chaque changement d'exercice. Chaque coupe devient un trait sur la frise : attrape-le pour l'ajuster. Glisse sur la règle du haut pour te déplacer dans la vidéo.</p>
            ) : null}
          </Timeline>

          <section className={c.list} aria-label="Exercices">
            <div className={c.listHead}>
              <span className={c.label}>Exercices · {keptCount} gardé{keptCount > 1 ? 's' : ''} sur {segs.length}</span>
              <span className={s.sub}>Passe sur « Retiré » l'introduction et les pauses : elles ne seront pas enregistrées.</span>
            </div>
            {segs.map((x, i) => (
              <div key={x.id} className={[c.row, !x.kept ? c.rowOff : '', x.id === selId ? c.rowSel : ''].join(' ')} onClick={() => { setCutSel(null); seekTo(x.startSec); setSelId(x.id) }}>
                <span className={c.rowNo} aria-hidden="true">{i + 1}</span>
                <div className={c.rowMain}>
                  <input className={c.rowName} value={x.name} aria-label={`Nom de l'exercice ${i + 1}`} onFocus={() => setSelId(x.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => patch(x.id, { name: e.target.value })} />
                  <span className={c.rowTime}>{formatTime(x.startSec)} – {formatTime(x.endSec)} · {Math.round(durationOf(x))} s</span>
                </div>
                {x.verify && i < segs.length - 1 && <span className={c.verify}>Fin à vérifier</span>}
                <button type="button" className={[c.keep, x.kept ? '' : c.keepOff].join(' ')} aria-pressed={x.kept} aria-label={`${x.name} : ${x.kept ? 'gardé' : 'retiré'}`} onClick={(e) => { e.stopPropagation(); patch(x.id, { kept: !x.kept }) }}>{x.kept ? 'Gardé' : 'Retiré'}</button>
              </div>
            ))}
          </section>
        </div>

        <div className={c.side}>
          <div className={c.card}>
            <span className={c.label}>Aides pour aller plus vite</span>

            <HelpToggle open={help === 'ai'} onToggle={() => toggleHelp('ai')} icon={<Sparkles size={22} aria-hidden="true" />} title="Repérer avec l'IA" sub="Elle regarde la vidéo et pose les coupes.">
              {isYT ? (
                <p className={ui.hint} style={{ margin: 0 }}>L'IA a besoin des images de la vidéo, et le lecteur YouTube ne les donne pas. Pour l'utiliser, importe le fichier de la vidéo si tu l'as déjà. Ici, marque à la main ou utilise les autres aides.</p>
              ) : aiInfo === null ? (
                <p className={ui.hint} style={{ margin: 0 }}>Vérification du service d'IA…</p>
              ) : !aiOn ? (
                <p role="status" className={ui.hint} style={{ margin: 0, color: 'var(--transition)' }}>
                  {aiInfo.hasKey ? `L'IA n'est pas disponible : ${aiInfo.reason ?? "aucun modèle qui lit les images n'est choisi."}` : "L'IA n'est pas disponible : le service n'est pas joignable ou n'a pas de clé. Si tu viens de le configurer, ferme complètement l'app et rouvre-la."}
                </p>
              ) : progress ? (
                <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className={s.msg}>{progress.label}…</span>
                  <progress max={1} {...(progress.ratio === null ? {} : { value: progress.ratio })} style={{ width: '100%', height: 12 }} aria-label="Repérage en cours" />
                  <Button onClick={() => abort.current?.abort()}>Annuler</Button>
                </div>
              ) : (
                <>
                  <p className={ui.hint} style={{ margin: 0 }}>
                    L'IA pose des repères, à toi de les ajuster ensuite sur la frise. Pour cela, environ {sheetCount(source.durationSec) * PER_SHEET} petites images de cette vidéo quittent l'iPad et sont envoyées à {aiInfo.provider ?? "un service d'IA"}. Elles ne sont pas enregistrées dans l'app.
                    {segs.length > 1 && ' Tes coupes actuelles seront remplacées.'}
                  </p>
                  <Button variant="primary" disabled={!source.durationSec || aiBusy} onClick={() => void runAiMarks()}><Sparkles size={18} aria-hidden="true" />Envoyer les images et repérer</Button>
                  {!aiProposals && <Button disabled={aiBusy || keptCount === 0} onClick={() => void runAiNames()}>{aiBusy ? 'Nommage en cours…' : "Nommer les exercices avec l'IA"}</Button>}
                  {!aiProposals && <p className={ui.hint} style={{ margin: 0 }}>Le nommage garde tes coupes et envoie 3 images par exercice gardé.</p>}
                  {aiError && <p role="alert" className={[s.msg, s.msgErr].join(' ')}>{aiError}</p>}
                </>
              )}
              {!isYT && notes.map((n) => <p key={n} role="status" className={ui.hint} style={{ margin: 0 }}>{n}</p>)}
              {aiProposals && (
                <div role="group" aria-label="Noms proposés par l'IA" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className={c.label}>Noms proposés : vérifie et corrige</span>
                  {aiProposals.map((p) => (
                    <div key={p.id} className={c.field}>
                      <input aria-label="Nom proposé" value={p.name} onChange={(e) => setAiProposals(aiProposals.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                      <input aria-label="Consigne proposée" maxLength={CUE_MAX} value={p.cue} onChange={(e) => setAiProposals(aiProposals.map((x) => (x.id === p.id ? { ...x, cue: clampCue(e.target.value) } : x)))} />
                    </div>
                  ))}
                  <div className={s.actions}>
                    <Button variant="primary" onClick={() => { setSegs((l) => l.map((x) => { const p = aiProposals.find((y) => y.id === x.id); return p ? { ...x, name: p.name, cue: p.cue } : x })); setAiProposals(null) }}>Valider ces noms</Button>
                    <Button onClick={() => setAiProposals(null)}>Ignorer</Button>
                  </div>
                </div>
              )}
            </HelpToggle>

            <HelpToggle open={help === 'rhythm'} onToggle={() => toggleHelp('rhythm')} icon={<Timer size={22} aria-hidden="true" />} title="Rythme régulier" sub="Quand chaque exercice dure pareil.">
              <p className={ui.hint} style={{ margin: 0 }}>Pose une coupe à intervalles réguliers. Remplace les coupes actuelles.</p>
              <div className={c.line}><span>Effort</span><Stepper label="Durée d'effort" value={effort} min={5} max={120} step={5} unit="s" onChange={setEffort} /></div>
              <div className={c.line}><span>Pause</span><Stepper label="Durée de pause" value={rest} min={0} max={60} step={5} unit="s" onChange={setRest} /></div>
              <div className={c.line}><span>Début</span><Stepper label="Début du rythme" value={rhythmStart} min={0} max={Math.max(0, Math.floor(duration) - 5)} step={1} unit="s" onChange={setRhythmStart} /></div>
              <Button disabled={!duration} onClick={() => setRhythmStart(Math.min(Math.max(0, Math.floor(getTime())), Math.max(0, Math.floor(duration) - 5)))}>Début = là où en est la lecture ({pos.toFixed(0)} s)</Button>
              <Button variant="primary" disabled={!duration} onClick={() => replaceAll(mergeCandidates(rhythmBoundaries({ effortSec: effort, restSec: rest, startSec: rhythmStart }, duration, []), duration), 'Rythme régulier appliqué. Ajuste les traits sur la frise si besoin.')}>Appliquer le rythme</Button>
              {notes.map((n) => <p key={n} role="status" className={ui.hint} style={{ margin: 0 }}>{n}</p>)}
            </HelpToggle>

            {isYT && (
              <HelpToggle open={help === 'chapters'} onToggle={() => toggleHelp('chapters')} icon={<ListOrdered size={22} aria-hidden="true" />} title="Repères de la description" sub="Les chapitres écrits sous la vidéo YouTube.">
                {chaptersOn && source.youtubeId && (
                  <Button disabled={chaptersBusy} onClick={async () => {
                    setChaptersBusy(true); setNotes([])
                    try {
                      const d = await fetchYouTubeChapters(source.youtubeId!)
                      setChapterText(d)
                      setNotes([parseChapters(d, duration || 1).length ? 'Repères récupérés. Vérifie-les, puis touche « Poser ces repères ».' : 'Cette vidéo n’a pas de repères dans sa description.'])
                    } catch (e) { setNotes([(e as Error).message]) }
                    setChaptersBusy(false)
                  }}>{chaptersBusy ? 'Lecture…' : 'Récupérer les repères de YouTube'}</Button>
                )}
                <label className={c.field}>Une ligne par exercice, par exemple « 2:15 Chat-vache »
                  <textarea value={chapterText} onChange={(e) => setChapterText(e.target.value)} rows={4} />
                </label>
                <Button variant="primary" disabled={!duration || !chapterText.trim()} onClick={() => {
                  const r = parseChapters(chapterText, duration)
                  if (!r.length) { setNotes(['Aucun repère reconnu. Format attendu : « 2:15 Nom ».']); return }
                  replaceAll(r, `${r.length} repères posés. Remplace les coupes d'avant.`)
                }}>Poser ces repères</Button>
                {notes.map((n) => <p key={n} role="status" className={ui.hint} style={{ margin: 0 }}>{n}</p>)}
              </HelpToggle>
            )}

            {confirmReset ? (
              <div role="alertdialog" aria-label="Tout remettre à zéro" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className={s.msg}>Effacer toutes les coupes et repartir de la vidéo entière ?</p>
                <div className={s.actions}>
                  <Button variant="danger" onClick={() => { resetAll(); setConfirmReset(false) }}>Oui, tout effacer</Button>
                  <Button onClick={() => setConfirmReset(false)}>Annuler</Button>
                </div>
              </div>
            ) : segs.length > 1 && (
              <Button variant="danger" onClick={() => setConfirmReset(true)}><RotateCcw size={18} aria-hidden="true" />Tout remettre à zéro</Button>
            )}
          </div>

          {sel && (
            <div className={c.card}>
              <span className={c.label}>Exercice {selIndex + 1} sur {segs.length}</span>
              <div className={c.selInfo}>
                {!isYT && url && <div className={c.mini}><video ref={mini} src={url} muted playsInline aria-label="Aperçu en boucle de l'exercice sélectionné" /></div>}
                <div className={c.selText}>
                  <label className={c.field}>Nom, dit à voix haute
                    <input value={sel.name} onChange={(e) => patch(sel.id, { name: e.target.value })} />
                  </label>
                  <span className={ui.hint}>{clock(sel.startSec)} – {clock(sel.endSec)} · {Math.round(durationOf(sel))} s</span>
                </div>
              </div>
              <div className={c.pair}>
                <button type="button" className={[c.keep, sel.kept ? '' : c.keepOff].join(' ')} aria-pressed={sel.kept} onClick={() => patch(sel.id, { kept: !sel.kept })}>{sel.kept ? 'Gardé' : 'Retiré'}</button>
                <Button disabled={selIndex >= segs.length - 1} onClick={() => removeCut(selIndex)}><Merge size={18} aria-hidden="true" />Fusionner</Button>
              </div>
              <div className={c.pair}>
                <Button disabled={selIndex <= 0} onClick={() => selectCut(selIndex - 1)}>Régler le début</Button>
                <Button disabled={selIndex >= segs.length - 1} onClick={() => selectCut(selIndex)}>Régler la fin</Button>
              </div>
              <hr className={c.sep} />
              <label className={c.field}>Précision, facultative ({CUE_MAX} caractères au plus)
                <input value={sel.cue} maxLength={CUE_MAX} onChange={(e) => patch(sel.id, { cue: clampCue(e.target.value) })} placeholder="Assise, dos droit" />
              </label>
              <p className={ui.hint} style={{ margin: 0 }}>La voix dira : « Ensuite : {sel.name.trim() || 'sans nom'}, {Math.round(durationOf(sel))} secondes.{sel.cue ? ` ${sel.cue}` : ''} »</p>
              <div className={c.tags} role="group" aria-label="Zone du corps">
                {TAGS.map((t) => {
                  const on = sel.tags.includes(t)
                  return <button key={t} type="button" aria-pressed={on} className={[c.tag, on ? c.tagOn : ''].join(' ')} onClick={() => patch(sel.id, { tags: on ? sel.tags.filter((x) => x !== t) : [...sel.tags, t] })}>{t}</button>
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
