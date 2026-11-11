import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles } from 'lucide-react'
import { db, loadSettings } from '../data/db'
import type { VideoSource } from '../data/types'
import { useOpfsUrl } from '../video/useOpfsUrl'
import { LoopVideo } from '../video/LoopVideo'
import { LoopYT } from '../video/LoopYT'
import { saveSegments } from '../import/saveExercises'
import { clampCue, CUE_MAX, defaultName, durationOf, fillGaps, formatTime, isDefaultName, keptSegments, renumber, wholeVideo, type Segment } from '../import/segments'
import { inVideoOrder } from '../library/workouts'
import { customEquipment } from '../library/equipment'
import { EquipmentPicker } from '../library/EquipmentPicker'
import { speechFor } from '../engine/session'
import { aiStatus, type AiStatus } from '../import/aiClient'
import { extractFrames, requestLabels } from '../import/aiLabels'
import { getVideoFile } from '../data/opfs'
import { Screen } from '../app/Screen'
import { Steps } from '../app/Steps'
import { Button, IconButton } from '../ui/Button'
import { TAGS } from './Split'
import ui from '../ui/ui.module.css'
import s from '../app/app.module.css'
import n from './naming.module.css'

const SHOW_REMOVED_KEY = 'nommer.retirees'
const readShowRemoved = () => { try { return localStorage.getItem(SHOW_REMOVED_KEY) === '1' } catch { return false } }
const writeShowRemoved = (v: boolean) => { try { localStorage.setItem(SHOW_REMOVED_KEY, v ? '1' : '0') } catch { /* stockage indisponible */ } }

/**
 * Étape « Nommer » : la vidéo de l'exercice sélectionné tourne en boucle à gauche, la liste des exercices est à droite.
 * Avant l'enregistrement, on travaille sur le brouillon du découpage ; après, directement sur les exercices enregistrés
 * (pour corriger un nom à tout moment).
 */
export function Naming() {
  const { sourceId = '' } = useParams()
  // Lu une seule fois à l'ouverture : ensuite l'écran modifie lui-même ces données (et les enregistre).
  const [initial, setInitial] = useState<{ source: VideoSource; items: Segment[]; saved: boolean } | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void (async () => {
      const source = await db.sources.get(sourceId)
      if (!source) { if (alive) setInitial(null); return }
      const exs = inVideoOrder(await db.exercises.where('sourceId').equals(sourceId).toArray())
      const saved = exs.length > 0
      const items = saved
        ? exs.map((e) => ({ id: e.id, startSec: e.startSec, endSec: e.endSec, name: e.name, cue: e.cue ?? '', tags: e.tags, kept: true }))
        : source.draftSegs ? fillGaps(source.draftSegs, source.durationSec) : source.durationSec ? wholeVideo(source.durationSec) : []
      if (alive) setInitial({ source, items, saved })
    })()
    return () => { alive = false }
  }, [sourceId])
  if (initial === undefined) return null
  if (initial === null) return <Screen title="Vidéo introuvable"><p className={s.empty}>Cette vidéo n'est plus sur l'iPad.</p></Screen>
  if (!initial.items.length) return <Screen title="Nommer les exercices"><p className={s.empty}>Découpe d'abord cette vidéo.</p></Screen>
  return <NamingEditor key={sourceId} source={initial.source} initial={initial.items} saved={initial.saved} />
}

function NamingEditor({ source, initial, saved }: { source: VideoSource; initial: Segment[]; saved: boolean }) {
  const nav = useNavigate()
  const isYT = source.kind === 'youtube'
  const { url } = useOpfsUrl(source.opfsPath)
  const [items, setItems] = useState<Segment[]>(initial)
  const [showRemoved, setShowRemoved] = useState(readShowRemoved)
  const [selId, setSelId] = useState(() => (initial.find((x) => x.kept && isDefaultName(x.name)) ?? initial.find((x) => x.kept) ?? initial[0])!.id)
  const [paused, setPaused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [equipment, setEquipment] = useState<string[]>(source.equipment ?? [])
  const knownEquipment = customEquipment(useLiveQuery(() => db.sources.toArray(), [])?.map((x) => x.equipment) ?? [])
  const lang = useLiveQuery(() => loadSettings(), [])?.voiceLang ?? 'en'
  const [aiInfo, setAiInfo] = useState<AiStatus | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const listBox = useRef<HTMLOListElement>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  useEffect(() => { if (!isYT) void aiStatus().then(setAiInfo) }, [isYT])
  useEffect(() => () => abort.current?.abort(), [])

  // Enregistrement automatique : le brouillon du découpage, ou les exercices déjà enregistrés.
  const latest = useRef(items)
  const dirty = useRef(false)
  const flush = async () => {
    if (!dirty.current) return
    dirty.current = false
    const list = latest.current
    if (!saved) { await db.sources.update(source.id, { draftSegs: list }); return }
    await db.transaction('rw', db.exercises, async () => {
      for (const [i, x] of list.entries()) await db.exercises.update(x.id, { name: x.name.trim() || defaultName(i), cue: x.cue.trim() ? clampCue(x.cue.trim()) : undefined, tags: x.tags })
    })
  }
  useEffect(() => {
    latest.current = items
    const t = window.setTimeout(() => void flush(), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
  // En quittant l'écran : rien ne se perd.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => void flush(), [])
  const update = (next: Segment[]) => { dirty.current = true; setItems(next) }
  const patch = (id: string, p: Partial<Segment>) => update(items.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const visible = items.filter((x) => x.kept || showRemoved)
  const kept = keptSegments(items)
  const removedCount = items.length - kept.length
  const sel = items.find((x) => x.id === selId) ?? visible[0] ?? items[0]!
  const keptNo = kept.findIndex((x) => x.id === sel.id)
  const visIndex = visible.findIndex((x) => x.id === sel.id)
  const toName = kept.filter((x) => isDefaultName(x.name)).length

  // La ligne sélectionnée reste visible dans la liste (défilement de la liste seulement, jamais de la page).
  useEffect(() => {
    const box = listBox.current
    const row = rows.current.get(sel.id)
    if (!box || !row) return
    const top = row.offsetTop - box.offsetTop
    if (top < box.scrollTop) box.scrollTop = top - 8
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight + 8
  }, [sel.id, showRemoved])

  const select = (id: string) => { setSelId(id); setPaused(false) }
  const go = (delta: number) => {
    const next = visible[visIndex + delta]
    if (next) select(next.id)
  }
  // En passant au suivant pendant la saisie : le nom par défaut est sélectionné tout de suite, la première lettre tapée le remplace.
  useLayoutEffect(() => {
    const el = nameInput.current
    if (el && document.activeElement === el && isDefaultName(el.value)) el.select()
  }, [sel.id])
  const toggleKept = (x: Segment) => {
    const becomesKept = !x.kept
    let next = items.map((y) => (y.id === x.id ? { ...y, kept: becomesKept, name: becomesKept && y.name.trim() === 'Pause' ? 'Exercice 1' : y.name } : y))
    next = renumber(next)
    update(next)
    if (!becomesKept && !showRemoved) {
      const after = next.filter((y) => y.kept)
      const i = Math.min(Math.max(0, keptNo), after.length - 1)
      if (after[i]) setSelId(after[i]!.id)
    }
  }
  const changeShowRemoved = (v: boolean) => { setShowRemoved(v); writeShowRemoved(v); if (!v && !sel.kept) { const k = kept[0]; if (k) setSelId(k.id) } }

  const saveEquipment = (v: string[]) => { setEquipment(v); void db.sources.update(source.id, { equipment: v.length ? v : undefined }) }

  const proposeNames = async () => {
    if (!source.opfsPath) return
    setAiBusy(true); setAiMsg(null)
    const ctl = new AbortController()
    abort.current = ctl
    try {
      const file = await getVideoFile(source.opfsPath)
      const frames = await extractFrames(file, kept, ctl.signal)
      const labels = await requestLabels(frames, lang, ctl.signal)
      // Seuls les noms laissés par défaut sont remplacés : un nom qu'elle a écrit n'est jamais écrasé.
      let count = 0
      const next = latest.current.map((x) => {
        const l = labels.find((y) => y.id === x.id)
        if (!l || !isDefaultName(x.name)) return x
        count++
        return { ...x, name: l.name || x.name, cue: x.cue.trim() ? x.cue : clampCue(l.cue) }
      })
      update(next)
      setAiMsg(count ? { ok: true, text: `${count} nom${count > 1 ? 's' : ''} proposé${count > 1 ? 's' : ''}. Relis-les : tu peux tout corriger.` } : { ok: false, text: labels.length ? 'Tous les exercices ont déjà un nom : rien n\'a été changé.' : "L'IA n'a rien proposé." })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setAiMsg({ ok: false, text: (e as Error).message || "Le nommage par l'IA a échoué." })
    } finally {
      setAiBusy(false)
    }
  }

  const finish = async () => {
    setSaving(true)
    await flush()
    if (saved) { nav(-1); return }
    await saveSegments(source, latest.current)
    await db.sources.update(source.id, { draftSegs: undefined })
    nav(`/composer/nouvelle?video=${source.id}`)
  }
  const back = async () => { await flush(); if (saved) nav(-1); else nav(`/decoupage/${source.id}`) }

  return (
    <main className={n.page}>
      <header className={n.top}>
        <div className={n.title}>
          <IconButton label={saved ? 'Retour' : 'Revenir au découpage'} onClick={() => void back()}><ChevronLeft size={24} aria-hidden="true" /></IconButton>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 24 }}>Nommer les exercices</h1>
            <p className={s.sub}>{source.title} · {kept.length} exercice{kept.length > 1 ? 's' : ''}{toName ? ` · ${toName} à nommer` : ''}</p>
          </div>
        </div>
        {!saved && <Steps current={3} />}
        <Button variant="primary" disabled={saving || kept.length === 0} onClick={() => void finish()}>
          {saving ? 'Enregistrement…' : saved ? 'Terminé' : `Enregistrer ${kept.length} exercice${kept.length > 1 ? 's' : ''}`}
        </Button>
      </header>

      <div className={n.cols}>
        <section className={n.left} aria-label="Exercice sélectionné">
          <div className={n.player}>
            {isYT && source.youtubeId && <LoopYT videoId={source.youtubeId} startSec={sel.startSec} endSec={sel.endSec} paused={paused} muted />}
            {!isYT && url && <LoopVideo url={url} startSec={sel.startSec} endSec={sel.endSec} active paused={paused} muted />}
          </div>
          <div className={n.playRow}>
            <span className={n.which}>{sel.kept ? `Exercice ${keptNo + 1} sur ${kept.length}` : 'Partie retirée'} · {formatTime(sel.startSec)} – {formatTime(sel.endSec)} · {Math.round(durationOf(sel))} s</span>
            <Button onClick={() => setPaused(!paused)} aria-label={paused ? 'Lecture' : 'Pause'}>{paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}{paused ? 'Lecture' : 'Pause'}</Button>
          </div>

          {sel.kept ? (
            <>
              <div className={n.field}>
                <label htmlFor="nom-exercice">Nom, dit à voix haute</label>
                <div className={n.nameRow}>
                  <input
                    id="nom-exercice"
                    ref={nameInput}
                    className={n.nameInput}
                    value={sel.name}
                    enterKeyHint="next"
                    autoCapitalize="sentences"
                    onFocus={(e) => { if (isDefaultName(sel.name)) e.currentTarget.select() }}
                    onChange={(e) => patch(sel.id, { name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(1) } }}
                    placeholder={lang === 'en' ? 'Ex. Cat cow' : 'Ex. Chat-vache'}
                  />
                  <Button variant="primary" className={n.nextBtn} disabled={visIndex >= visible.length - 1} onClick={() => go(1)} aria-label="Exercice suivant">Suivant<ChevronRight size={20} aria-hidden="true" /></Button>
                </div>
              </div>
              <label className={n.field}>Consigne, facultative ({CUE_MAX} caractères au plus)
                <input value={sel.cue} maxLength={CUE_MAX} onChange={(e) => patch(sel.id, { cue: clampCue(e.target.value) })} placeholder={lang === 'en' ? 'Ex. Keep your back straight' : 'Ex. Dos droit'} />
              </label>
              <div className={n.tags} role="group" aria-label="Zone du corps">
                {TAGS.map((t) => {
                  const on = sel.tags.includes(t)
                  return <button key={t} type="button" aria-pressed={on} className={[n.tag, on ? n.tagOn : ''].join(' ')} onClick={() => patch(sel.id, { tags: on ? sel.tags.filter((x) => x !== t) : [...sel.tags, t] })}>{t}</button>
                })}
              </div>
              <p className={ui.hint} style={{ margin: 0 }}>La voix dira : « {speechFor({ name: sel.name.trim() || defaultName(keptNo), cue: sel.cue, durationSec: Math.round(durationOf(sel)) }, lang)} »</p>
            </>
          ) : (
            <p className={ui.hint} style={{ margin: 0 }}>Cette partie est retirée : elle ne sera pas enregistrée. Si c'est un exercice, garde-la pour pouvoir la nommer.</p>
          )}

          <div className={n.navRow}>
            <Button disabled={visIndex <= 0} onClick={() => go(-1)}><ChevronLeft size={20} aria-hidden="true" />Précédent</Button>
            {!saved && <Button onClick={() => toggleKept(sel)}>{sel.kept ? 'Retirer cette partie' : 'Garder cette partie'}</Button>}
            {!sel.kept && <Button variant="primary" disabled={visIndex >= visible.length - 1} onClick={() => go(1)}>Suivant<ChevronRight size={20} aria-hidden="true" /></Button>}
          </div>
        </section>

        <section className={n.right} aria-label="Exercices de la vidéo">
          <div className={n.listHead}>
            <span className={n.label}>Exercices</span>
            {!saved && removedCount > 0 && (
              <label className={n.switch}>
                <input type="checkbox" checked={showRemoved} onChange={(e) => changeShowRemoved(e.target.checked)} />
                Montrer les parties retirées ({removedCount})
              </label>
            )}
          </div>
          <ol ref={listBox} className={n.list}>
            {visible.map((x) => {
              const no = kept.findIndex((y) => y.id === x.id)
              const unnamed = x.kept && isDefaultName(x.name)
              return (
                <li key={x.id} ref={(el) => { if (el) rows.current.set(x.id, el); else rows.current.delete(x.id) }}>
                  <button type="button" className={[n.row, x.id === sel.id ? n.rowOn : '', x.kept ? '' : n.rowOff].join(' ')} aria-current={x.id === sel.id ? 'true' : undefined} onClick={() => select(x.id)}>
                    <span className={n.no} aria-hidden="true">{x.kept ? no + 1 : '–'}</span>
                    <span className={n.rowText}>
                      <span className={[n.rowName, unnamed ? n.muted : ''].join(' ')}>{x.name}</span>
                      <span className={n.rowMeta}>{Math.round(durationOf(x))} s{x.cue ? ` · ${x.cue}` : ''}{x.tags.length ? ` · ${x.tags.join(', ')}` : ''}</span>
                    </span>
                    {unnamed && <span className={n.badge}>À nommer</span>}
                    {!x.kept && <span className={n.badgeOff}>Retirée</span>}
                  </button>
                </li>
              )
            })}
          </ol>

          {!isYT && aiInfo?.enabled && (
            <div className={n.box}>
              <Button disabled={aiBusy || kept.length === 0} onClick={() => void proposeNames()}><Sparkles size={18} aria-hidden="true" />{aiBusy ? 'L\'IA regarde les exercices…' : "Proposer des noms avec l'IA"}</Button>
              {aiBusy && <Button onClick={() => abort.current?.abort()}>Annuler</Button>}
              <p className={ui.hint} style={{ margin: 0 }}>Remplit seulement les exercices pas encore nommés. 3 images par exercice partent chez {aiInfo.provider ?? "le service d'IA"}.</p>
              {aiMsg && <p role="status" className={[s.msg, aiMsg.ok ? s.msgOk : s.msgErr].join(' ')}>{aiMsg.text}</p>}
            </div>
          )}

          <div className={n.box}>
            <span className={n.label}>Équipement pour cette vidéo</span>
            <EquipmentPicker value={equipment} known={knownEquipment} onChange={saveEquipment} />
          </div>
        </section>
      </div>
    </main>
  )
}
