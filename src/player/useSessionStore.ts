import { create } from 'zustand'
import { createSession, reduce, type SessionConfig, type SessionEffect, type SessionEvent, type SessionState } from '../engine/session'

interface Store {
  session: SessionState | null
  init: (config: SessionConfig) => void
  /** Applique un événement et renvoie les effets à exécuter (bip, voix…). */
  dispatch: (e: SessionEvent) => SessionEffect[]
}

export const useSessionStore = create<Store>((set, get) => ({
  session: null,
  init: (config) => set({ session: createSession(config) }),
  dispatch: (e) => {
    const cur = get().session
    if (!cur) return []
    const step = reduce(cur, e)
    if (step.state !== cur) set({ session: step.state })
    return step.effects
  },
}))
