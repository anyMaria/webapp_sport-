import { describe, expect, it } from 'vitest'
import { createSession, reduce, sessionCounts, type SessionConfig, type SessionEffect, type SessionEvent, type SessionState } from './session'

const item = (n: number, durationSec = 10, restAfterSec = 0) => ({ exerciseId: `e${n}`, name: `Ex ${n}`, durationSec, restAfterSec })
const cfg = (n = 3, extra: Partial<SessionConfig> = {}): SessionConfig => ({ items: Array.from({ length: n }, (_, i) => item(i + 1)), countdownSec: 5, extendSec: 30, ...extra })

function run(state: SessionState, events: SessionEvent[]) {
  const effects: SessionEffect[] = []
  for (const e of events) {
    const step = reduce(state, e)
    state = step.state
    effects.push(...step.effects)
  }
  return { state, effects }
}

describe('moteur de séance', () => {
  it('démarre sur le premier exercice', () => {
    const { state, effects } = run(createSession(cfg()), [{ type: 'START', now: 0 }])
    expect(state.phase).toBe('exercise')
    expect(state.remainingMs).toBe(10_000)
    expect(effects).toEqual([{ type: 'showItem', index: 0 }])
  })

  it('passe en transition à zéro, annonce le suivant, puis enchaîne seul', () => {
    const { state, effects } = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }])
    expect(state.phase).toBe('transition')
    expect(state.remainingMs).toBe(5000)
    expect(effects).toContainEqual({ type: 'speak', text: 'Ensuite : Ex 2, 10 secondes.' })
    const next = run(state, [{ type: 'TICK', now: 15_000 }])
    expect(next.state.phase).toBe('exercise')
    expect(next.state.index).toBe(1)
  })

  it('émet les bips à 3, 2, 1 puis un bip long à zéro', () => {
    const { effects } = run(createSession(cfg(2)), [{ type: 'START', now: 0 }, ...[1000, 4000, 7000, 8000, 9000, 10_000].map((now) => ({ type: 'TICK' as const, now }))])
    const beeps = effects.filter((e) => e.type === 'beep')
    expect(beeps).toEqual([{ type: 'beep', kind: 'short' }, { type: 'beep', kind: 'short' }, { type: 'beep', kind: 'short' }, { type: 'beep', kind: 'long' }])
  })

  it('un long écart entre deux TICK ne perd ni temps ni bips (horloge, pas intervalles)', () => {
    const { state, effects } = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 9500 }])
    expect(state.remainingMs).toBe(500)
    expect(effects.filter((e) => e.type === 'beep').length).toBe(3)
  })

  it('« Encore » ajoute 30 s pendant l’exercice', () => {
    const { state } = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 4000 }, { type: 'EXTEND', now: 4000 }])
    expect(state.remainingMs).toBe(36_000)
    expect(state.extensions).toBe(1)
  })

  it('« Encore 30 s » en transition relance le même exercice', () => {
    const r = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }, { type: 'EXTEND', now: 11_000 }])
    expect(r.state.phase).toBe('exercise')
    expect(r.state.index).toBe(0)
    expect(r.state.remainingMs).toBe(30_000)
    expect(r.effects).toContainEqual({ type: 'showItem', index: 0 })
  })

  it('« Suivant » saute sans décompte', () => {
    const { state } = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'SKIP', now: 1000 }])
    expect(state.phase).toBe('exercise')
    expect(state.index).toBe(1)
    expect(state.remainingMs).toBe(10_000)
  })

  it('« Passer maintenant » pendant la transition', () => {
    const { state } = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }, { type: 'SKIP', now: 11_000 }])
    expect(state.phase).toBe('exercise')
    expect(state.index).toBe(1)
  })

  it('la pause fige le minuteur, et la reprise ne compte pas la pause', () => {
    const { state } = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 3000 }, { type: 'PAUSE', now: 3000 }, { type: 'TICK', now: 60_000 }, { type: 'RESUME', now: 60_000 }, { type: 'TICK', now: 61_000 }])
    expect(state.phase).toBe('exercise')
    expect(state.remainingMs).toBe(6000)
    expect(state.activeMs).toBe(4000)
  })

  it('la pause d’une transition reprend en transition', () => {
    const { state } = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }, { type: 'PAUSE', now: 12_000 }, { type: 'RESUME', now: 20_000 }])
    expect(state.phase).toBe('transition')
    expect(state.remainingMs).toBe(3000)
  })

  it('RESUME hors pause est ignoré', () => {
    const s = createSession(cfg())
    expect(reduce(s, { type: 'RESUME', now: 5 }).state).toBe(s)
  })

  it('le dernier exercice mène directement à la fin, sans transition', () => {
    const r = run(createSession(cfg(1)), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }])
    expect(r.state.phase).toBe('finished')
    expect(r.effects).toContainEqual({ type: 'finished' })
    expect(sessionCounts(r.state)).toBe(true)
  })

  it('« Suivant » sur le dernier exercice termine la séance', () => {
    const r = run(createSession(cfg(1)), [{ type: 'START', now: 0 }, { type: 'SKIP', now: 1000 }])
    expect(r.state.phase).toBe('finished')
  })

  it('une pause de repos plus longue que le décompte allonge la transition', () => {
    const c: SessionConfig = { ...cfg(2), items: [item(1, 10, 20), item(2)] }
    const r = run(createSession(c), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }])
    expect(r.state.remainingMs).toBe(20_000)
  })

  it('quitter donne une séance partielle, comptée seulement à 80 % du temps prévu', () => {
    const short = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }, { type: 'QUIT', now: 15_000 }])
    expect(short.state.partial).toBe(true)
    expect(sessionCounts(short.state)).toBe(false)
    // 3 × 10 s prévus : 24 s actives = 80 %.
    const long = run(createSession(cfg()), [{ type: 'START', now: 0 }, { type: 'TICK', now: 10_000 }, { type: 'TICK', now: 15_000 }, { type: 'TICK', now: 25_000 }, { type: 'TICK', now: 30_000 }, { type: 'TICK', now: 34_000 }, { type: 'QUIT', now: 34_000 }])
    expect(long.state.activeMs).toBe(24_000)
    expect(sessionCounts(long.state)).toBe(true)
  })

  it('séance vide : START ne fait rien', () => {
    const s = createSession(cfg(0))
    expect(reduce(s, { type: 'START', now: 0 }).state.phase).toBe('ready')
  })
})
