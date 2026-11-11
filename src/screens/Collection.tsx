import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Screen } from '../app/Screen'
import { SpaceNav } from './SpaceNav'
import { Button } from '../ui/Button'
import { db, loadSettings } from '../data/db'
import { DEFAULT_SETTINGS } from '../data/settings'
import { SERIES, STICKERS, artUrl, baseIdOf, isShiny, stickerById, type StickerDef } from '../stickers/catalog'
import { PouchReveal } from '../stickers/PouchReveal'
import { markRevealed } from '../stickers/sync'
import { distinctOwned } from '../stickers/unlock'
import type { StickerUnlock } from '../data/types'
import { useMotivation } from '../motivation/useMotivation'
import c from './collection.module.css'
import s from '../app/app.module.css'

const NONE: StickerUnlock[] = []

/** Collection : une planche par série, emplacements vides en silhouette avec leur condition. */
export function Collection() {
  useMotivation() // lance le calcul des déblocages
  const owned = useLiveQuery(() => db.stickerUnlocks.toArray(), []) ?? NONE
  const settings = useLiveQuery(() => loadSettings(), []) ?? DEFAULT_SETTINGS
  const [reveal, setReveal] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const slotEls = useRef(new Map<string, HTMLElement>())

  const pending = useMemo(() => owned.filter((u) => !u.revealed).sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt)), [owned])
  const have = useMemo(() => new Set(owned.filter((u) => u.revealed).map((u) => baseIdOf(u.stickerId))), [owned])
  const shinyCount = (id: string) => owned.filter((u) => u.revealed && isShiny(u.stickerId) && baseIdOf(u.stickerId) === id).length
  const total = STICKERS.length
  const got = distinctOwned(owned.filter((u) => u.revealed))

  return (
    <Screen title="Collection" subtitle={`${got} sur ${total} stickers`}>
      <SpaceNav />
      {pending.length > 0 && (
        <div className={c.banner} role="status">
          <span>{pending.length === 1 ? 'Une pochette t\'attend.' : `${pending.length} pochettes t'attendent.`}</span>
          <Button variant="primary" onClick={() => setReveal(pending[0]!.stickerId)}>Ouvrir ma pochette</Button>
        </div>
      )}
      {SERIES.map((ser) => {
        const list = STICKERS.filter((x) => x.series === ser.id)
        const n = list.filter((x) => have.has(x.id)).length
        return (
          <section key={ser.id} className={c.board} aria-label={ser.name}>
            <div className={c.boardHead}><h2>{ser.name}</h2><span className={s.sub}>{n} sur {list.length}</span></div>
            <div className={c.grid}>
              {list.map((st: StickerDef) => {
                const ok = have.has(st.id)
                const shiny = shinyCount(st.id)
                return (
                  <div key={st.id} className={c.slot}>
                    {ok ? (
                      <button type="button" className={[c.slotBtn, st.rarity === 'rare' ? c.rare : ''].join(' ')} ref={(el) => { if (el) slotEls.current.set(st.id, el) }} data-sticker-slot={st.id} aria-label={`${st.name}${shiny ? `, ${shiny} brillant${shiny > 1 ? 's' : ''}` : ''}, agrandir`} onClick={() => setZoom(st.id)}>
                        <img src={artUrl(st.id)} alt="" draggable={false} />
                        {shiny > 0 && <span className={c.badge}>Brillant{shiny > 1 ? ` ×${shiny}` : ''}</span>}
                      </button>
                    ) : (
                      <div className={c.empty} ref={(el) => { if (el) slotEls.current.set(st.id, el) }} data-sticker-slot={st.id}>
                        <img src={artUrl(st.id)} alt="" className={c.silhouette} draggable={false} />
                      </div>
                    )}
                    <span className={c.name}>{ok ? st.name : 'À débloquer'}</span>
                    {!ok && <span className={c.cond}>{ser.condition(st)}</span>}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {reveal && (
        <PouchReveal
          key={reveal}
          stickerId={reveal}
          volume={settings.beepVolume}
          slotRect={() => slotEls.current.get(baseIdOf(reveal))?.getBoundingClientRect() ?? null}
          onDone={(opened) => { if (opened) void markRevealed(reveal); setReveal(null) }}
        />
      )}
      {zoom && stickerById.get(zoom) && (
        <PouchReveal key={`z-${zoom}`} stickerId={zoom} volume={settings.beepVolume} zoomOnly onDone={() => setZoom(null)} />
      )}
    </Screen>
  )
}
