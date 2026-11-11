import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, Repeat2, SkipForward, X } from 'lucide-react'
import { db, loadSettings, saveSettings } from '../data/db'
import { DEFAULT_SETTINGS } from '../data/settings'
import { newId } from '../data/importFile'
import type { AudioMode } from '../data/types'
import { plannedSec, sessionCounts, type SessionEffect } from '../engine/session'
import { modeHasBeeps, modeHasVideoSound, modeHasVoice, playBeep, setAudioSession, speak, unlockAudio } from '../audio/beep'
import { LoopVideo } from '../video/LoopVideo'
import { LoopYT } from '../video/LoopYT'
import { youtubeThumb } from '../video/youtube'
import { useOpfsUrl } from '../video/useOpfsUrl'
import { buildPlan, type Clip, type Plan } from './plan'
import { useSessionStore } from './useSessionStore'
import { useWakeLock } from './useWakeLock'
import { Button } from '../ui/Button'
import { Screen } from '../app/Screen'
import { useMotivation } from '../motivation/useMotivation'
import { remainingThisWeek } from '../motivation/streak'
import s from './session.module.css'

const MODES: { id: AudioMode; label: string }[] = [
  { id: 'music', label: 'Ma musique' },
  { id: 'music+beeps', label: 'Musique + bips' },
  { id: 'music+beeps+voice', label: '+ consignes' },
  { id: 'video', label: 'Son de la vidéo' },
]

const fmt = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

function ClipLayer({ clip, active, paused, muted, dimmed }: { clip: Clip; active: boolean; paused: boolean; muted: boolean; dimmed: boolean }) {
  const { url, error } = useOpfsUrl(clip.kind === 'file' ? clip.opfsPath : undefined)
  if (clip.kind === 'youtube') {
    // Pas de préchargement caché : un lecteur YouTube n'est jamais masqué ni lancé hors de vue.
    return active ? <LoopYT key={clip.youtubeId + clip.startSec} videoId={clip.youtubeId} startSec={clip.startSec} endSec={clip.endSec} paused={paused} muted={muted} /> : null
  }
  if (clip.kind === 'missing' || error) return active ? <div className={s.placeholder}>Vidéo introuvable. Touche « Suivant » pour la passer.</div> : null
  if (!url) return null
  return <LoopVideo url={url} startSec={clip.startSec} endSec={clip.endSec} active={active} paused={paused} muted={muted} dimmed={dimmed} />
}

export function SessionScreen() {
  const { workoutId = '' } = useParams()
  const express = useSearchParams()[0].get('express') === '1'
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  useEffect(() => { void buildPlan(workoutId, express).then(setPlan) }, [workoutId, express])
  if (plan === undefined) return null
  if (plan === null || plan.items.length === 0) {
    return (
      <Screen title="Séance introuvable">
        <p style={{ color: 'var(--text-muted)' }}>Cette séance n'existe plus, ou tous ses exercices ont été supprimés.</p>
      </Screen>
    )
  }
  return <Player plan={plan} startedAtIso={new Date().toISOString()} />
}

function Player({ plan, startedAtIso }: { plan: Plan; startedAtIso: string }) {
  const nav = useNavigate()
  const settings = useLiveQuery(() => loadSettings(), []) ?? DEFAULT_SETTINGS
  const { session, init, dispatch } = useSessionStore()
  const [confirmQuit, setConfirmQuit] = useState(false)
  const mot = useMotivation()
  const logged = useRef(false)

  useEffect(() => {
    init({ items: plan.items, countdownSec: settings.countdownSec, extendSec: settings.extendSec })
    // Une seule initialisation : changer le décompte en cours de séance n'affecte pas la séance démarrée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])

  const mode = settings.audioMode
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const run = useCallback((effects: SessionEffect[]) => {
    const st = settingsRef.current
    for (const e of effects) {
      if (e.type === 'beep' && modeHasBeeps(st.audioMode)) void playBeep(st.beepVolume, e.kind)
      if (e.type === 'speak' && modeHasVoice(st.audioMode)) speak(e.text, st.voiceName)
    }
  }, [])
  const send = useCallback((e: Parameters<typeof dispatch>[0]) => run(dispatch(e)), [dispatch, run])
  const now = () => performance.now()

  const phase = session?.phase ?? 'ready'
  const running = phase === 'exercise' || phase === 'transition'

  // Minuteur : un TICK toutes les 100 ms, le temps vient de l'horloge.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => send({ type: 'TICK', now: now() }), 100)
    return () => window.clearInterval(id)
  }, [running, send])

  // L'app passe en arrière-plan : pause. La reprise se fait toujours par une touche.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') send({ type: 'PAUSE', now: now() }) }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [send])

  useWakeLock(phase !== 'ready' && phase !== 'finished')

  // Fin de séance : on écrit le journal une seule fois.
  useEffect(() => {
    if (phase !== 'finished' || !session || logged.current) return
    logged.current = true
    void db.sessionLogs.put({
      id: newId(), workoutId: plan.workoutId, startedAt: startedAtIso, endedAt: new Date().toISOString(),
      activeSec: Math.round(session.activeMs / 1000), plannedSec: plannedSec(session.config),
      extensions: session.extensions, isExpress: plan.isExpress, counted: sessionCounts(session),
    })
  }, [phase, session, plan, startedAtIso])

  const toggleMode = (m: AudioMode) => {
    void saveSettings({ audioMode: m })
    setAudioSession(m)
  }

  const start = async () => {
    await unlockAudio()
    setAudioSession(mode)
    send({ type: 'START', now: now() })
  }

  const clips = plan.clips
  const cur = session?.index ?? 0
  const item = plan.items[cur]
  const nextItem = plan.items[cur + 1]
  const paused = phase === 'paused' || phase === 'ready'
  const toggle = () => send(phase === 'paused' ? { type: 'RESUME', now: now() } : { type: 'PAUSE', now: now() })

  const askQuit = () => { if (phase === 'exercise' || phase === 'transition') send({ type: 'PAUSE', now: now() }); setConfirmQuit(true) }

  const isYT = clips[cur]?.kind === 'youtube'
  const thumbUrls = useThumbUrls(plan.thumbIds, plan.thumbYt)

  const ring = useMemo(() => {
    if (!session || session.phase === 'ready') return 0
    return session.phaseMs ? 295 * (1 - session.remainingMs / session.phaseMs) : 0
  }, [session])

  if (!session) return null

  if (phase === 'finished') {
    const counted = sessionCounts(session)
    return (
      <main className={s.end}>
        <h1 style={{ fontSize: 34 }}>{session.partial ? 'Séance arrêtée' : 'Séance terminée'}</h1>
        <div className={s.stats}>
          <div className={s.stat}><span className={s.statNum}>{fmt(session.activeMs)}</span><span className={s.hint}>durée active</span></div>
          <div className={s.stat}><span className={s.statNum}>{session.partial ? Math.min(cur + 1, plan.items.length) : plan.items.length}</span><span className={s.hint}>exercices</span></div>
          <div className={s.stat}><span className={s.statNum}>{session.extensions}</span><span className={s.hint}>« Encore »</span></div>
        </div>
        <p className={s.hint}>{counted ? 'Cette séance compte pour ta semaine.' : 'Cette séance est trop courte pour compter. Pas de souci, on repart quand tu veux.'}</p>
        <p role="status" style={{ margin: 0, fontSize: 20, fontFamily: 'var(--font-title)', fontWeight: 600 }}>
          {mot.result.current.validated
            ? `${mot.result.current.count} / ${mot.settings.weeklyGoal}, semaine validée`
            : `${mot.result.current.count} / ${mot.settings.weeklyGoal} : encore ${remainingThisWeek(mot.result, mot.settings.weeklyGoal)} séance${remainingThisWeek(mot.result, mot.settings.weeklyGoal) > 1 ? 's' : ''} cette semaine`}
        </p>
        <div><Button variant="primary" onClick={() => nav('/')} style={{ minHeight: 64, fontSize: 20 }}>Terminer</Button></div>
      </main>
    )
  }

  const inTransition = phase === 'transition' || (phase === 'paused' && session.resumeTo === 'transition')
  const phaseLabel = phase === 'ready' ? 'Prêt' : phase === 'paused' ? 'Pause' : inTransition ? 'Transition' : 'Effort'
  const pillCls = [s.pill, phase === 'exercise' ? s.pillEffort : '', phase === 'transition' ? s.pillTransition : ''].join(' ')

  return (
    <div className={s.root}>
      <div className={s.stage}>
        <div className={[s.videoBox, isYT ? s.ytBox : ''].join(' ')}>
          {clips.map((c, i) => (i === cur || i === cur + 1) && (
            <ClipLayer key={i} clip={c} active={i === cur} paused={paused} muted={!modeHasVideoSound(mode)} dimmed={inTransition && !isYT} />
          ))}
          {phase !== 'ready' && !isYT && <button className={s.tapArea} aria-label={phase === 'paused' ? 'Reprendre' : 'Mettre en pause'} onClick={toggle} />}
        </div>

        <button className={[s.fab, s.quit].join(' ')} aria-label="Quitter la séance" onClick={askQuit}><X size={22} aria-hidden="true" /></button>
        {(phase === 'exercise' || phase === 'paused') && (
          <button className={[s.fab, s.pause].join(' ')} aria-label={phase === 'paused' ? 'Reprendre' : 'Mettre en pause'} onClick={toggle}>
            {phase === 'paused' ? <Play size={28} fill="currentColor" aria-hidden="true" /> : <Pause size={28} fill="currentColor" aria-hidden="true" />}
          </button>
        )}
        {clips[cur]?.kind === 'file' && phase !== 'ready' && <span className={s.origin}>Fichier · extrait {fmt(clips[cur]!.startSec * 1000)} – {fmt(clips[cur]!.endSec * 1000)}</span>}

        {phase === 'ready' && (
          <div className={[s.card, isYT ? '' : s.center].join(' ')} role="dialog" aria-label="Démarrer la séance">
            <span className={s.eyebrow}>Séance</span>
            <h1 className={s.nextTitle} style={{ fontSize: 40 }}>{plan.name}</h1>
            <span className={s.sub}>{plan.items.length} exercices · {Math.round(plannedSec(session.config) / 60) || 1} min</span>
            {plan.missing > 0 && <p className={s.warn}>{plan.missing} exercice{plan.missing > 1 ? 's' : ''} supprimé{plan.missing > 1 ? 's' : ''} : sauté{plan.missing > 1 ? 's' : ''}.</p>}
            <button className={[s.big, s.bigPrimary].join(' ')} onClick={() => void start()}><Play size={22} fill="currentColor" aria-hidden="true" />Commencer</button>
          </div>
        )}

        {phase === 'paused' && !confirmQuit && (
          <div className={[s.card, isYT ? '' : s.center].join(' ')} role="status">
            <span className={s.eyebrow}>En pause</span>
            <button className={[s.big, s.bigPrimary].join(' ')} onClick={toggle}><Play size={22} fill="currentColor" aria-hidden="true" />Reprendre</button>
          </div>
        )}

        {phase === 'transition' && nextItem && (
          <div className={s.card} role="group" aria-label="Fin d'exercice">
            <div className={s.cardRow}>
              <div className={s.ring}>
                <svg width="108" height="108" viewBox="0 0 108 108" role="img" aria-label={`Compte à rebours, ${Math.ceil(session.remainingMs / 1000)} secondes`}>
                  <circle cx="54" cy="54" r="47" fill="none" stroke="var(--line)" strokeWidth="10" />
                  <circle cx="54" cy="54" r="47" fill="none" stroke="var(--transition)" strokeWidth="10" strokeLinecap="round" strokeDasharray="295" strokeDashoffset={ring} transform="rotate(-90 54 54)" />
                </svg>
                <span className={s.ringNum}>{Math.ceil(session.remainingMs / 1000)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1 }}>
                <span className={[s.eyebrow, s.eyebrowT].join(' ')}>Suivant dans {Math.ceil(session.remainingMs / 1000)} secondes</span>
                <span className={s.nextTitle}>{nextItem.name}</span>
                <span className={s.sub}>{nextItem.durationSec} s{nextItem.cue ? ` · ${nextItem.cue}` : ''}</span>
              </div>
              {thumbUrls[cur + 1] && <img className={s.thumb} src={thumbUrls[cur + 1]} alt="" />}
            </div>
            <div className={s.btns}>
              <button className={[s.big, s.cardBtn].join(' ')} onClick={() => send({ type: 'EXTEND', now: now() })}><Repeat2 size={22} aria-hidden="true" />Encore {settings.extendSec} s</button>
              <button className={[s.big, s.cardBtn, s.bigTransition].join(' ')} onClick={() => send({ type: 'SKIP', now: now() })}>Passer maintenant<SkipForward size={22} fill="currentColor" aria-hidden="true" /></button>
            </div>
          </div>
        )}

        {confirmQuit && (
          <div className={[s.card, isYT ? '' : s.center].join(' ')} role="alertdialog" aria-label="Quitter la séance">
            <span className={s.nextTitle}>Quitter la séance ?</span>
            <div className={s.btns}>
              <button className={[s.big, s.cardBtn].join(' ')} onClick={() => setConfirmQuit(false)}>Continuer</button>
              <button className={[s.big, s.cardBtn, s.bigTransition].join(' ')} onClick={() => { setConfirmQuit(false); send({ type: 'QUIT', now: now() }) }}>Quitter</button>
            </div>
          </div>
        )}
      </div>

      <aside className={s.panel}>
        <div className={s.top}>
          <div className={s.topRow}>
            <span className={s.count}>Exercice {cur + 1} sur {plan.items.length}</span>
            <span className={pillCls}>{phaseLabel}</span>
          </div>
          <div className={s.bar} aria-hidden="true">
            {plan.items.map((_, i) => (
              <div key={i} className={[s.seg, i < cur || (i === cur && inTransition) ? s.segDone : '', i === cur && !inTransition && phase !== 'ready' ? s.segNow : '', i === cur + 1 && inTransition ? s.segTrans : ''].join(' ')} />
            ))}
          </div>
        </div>

        <div>
          <h1 className={s.name}>{item?.name}</h1>
          <div className={[s.timer, phase === 'exercise' ? s.timerEffort : '', inTransition || phase === 'ready' ? s.timerMuted : ''].join(' ')} aria-live="off">
            {phase === 'ready' ? fmt((item?.durationSec ?? 0) * 1000) : fmt(session.remainingMs)}
          </div>
          <span className={s.sub}>
            {inTransition ? 'Terminé. Un bip a signalé la fin.' : `sur ${fmt((item?.durationSec ?? 0) * 1000)}`}
          </span>
        </div>

        <div className={s.btns}>
          <button className={s.big} style={{ minHeight: 80 }} disabled={phase !== 'exercise'} onClick={() => send({ type: 'EXTEND', now: now() })}><Repeat2 size={22} aria-hidden="true" />Encore</button>
          <button className={[s.big, s.bigPrimary].join(' ')} style={{ minHeight: 80 }} disabled={phase === 'ready' || phase === 'paused'} onClick={() => send({ type: 'SKIP', now: now() })}>Suivant<SkipForward size={22} fill="currentColor" aria-hidden="true" /></button>
        </div>

        <div className={s.next} aria-label="Exercice suivant">
          {nextItem && thumbUrls[cur + 1] ? <img className={s.nextThumb} src={thumbUrls[cur + 1]} alt="" /> : <div className={s.nextThumb} aria-hidden="true" />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className={[s.eyebrow, s.eyebrowT].join(' ')}>Ensuite</span>
            <span className={s.nextName}>{nextItem ? `${nextItem.name} · ${nextItem.durationSec} s` : 'Dernier exercice'}</span>
          </div>
        </div>

        <div className={s.sound}>
          <span className={s.eyebrow}>Son</span>
          <div className={s.modes}>
            {MODES.map((m) => (
              <button key={m.id} className={[s.mode, mode === m.id ? s.modeOn : ''].join(' ')} aria-pressed={mode === m.id} onClick={() => toggleMode(m.id)}>{m.label}</button>
            ))}
          </div>
          {mode === 'video' && <p className={s.hint}>iOS va probablement mettre Spotify en pause avec le son de la vidéo.</p>}
        </div>
      </aside>
    </div>
  )
}

/** Vignettes des exercices : URL d'objet à partir de IndexedDB, révoquées au démontage. */
function useThumbUrls(ids: (string | undefined)[], yt: (string | undefined)[]): (string | undefined)[] {
  const [urls, setUrls] = useState<(string | undefined)[]>([])
  useEffect(() => {
    let alive = true
    const made: string[] = []
    void Promise.all(ids.map(async (id, i) => {
      const t = id ? await db.thumbs.get(id) : undefined
      if (!t) return yt[i] ? youtubeThumb(yt[i]!) : undefined
      const u = URL.createObjectURL(t.blob)
      made.push(u)
      return u
    })).then((r) => { if (alive) setUrls(r) })
    return () => { alive = false; made.forEach(URL.revokeObjectURL) }
  }, [ids, yt])
  return urls
}
