import type { AudioMode } from '../data/types'

let ctx: AudioContext | null = null

type AudioSessionNav = Navigator & { audioSession?: { type: string } }

/** À appeler depuis une touche (iOS l'exige) : crée et débloque le contexte audio. */
export async function unlockAudio(): Promise<void> {
  ctx ??= new AudioContext()
  await ctx.resume()
}

/** Règle la session audio d'iOS : « ambient » laisse Spotify jouer, « playback » prend la main (son de la vidéo). */
export function setAudioSession(mode: AudioMode): void {
  const api = (navigator as AudioSessionNav).audioSession
  if (!api) return
  try {
    api.type = mode === 'video' ? 'playback' : 'ambient'
  } catch {
    /* non géré par cette version de Safari */
  }
}

export type BeepKind = 'short' | 'long'

/** Un bip synthétisé, avec enveloppe de gain pour éviter les claquements. */
export async function playBeep(volume: number, kind: BeepKind | { freq: number; durationSec: number } = 'short'): Promise<void> {
  await unlockAudio()
  const c = ctx!
  const { freq, durationSec } = typeof kind === 'string' ? (kind === 'short' ? { freq: 880, durationSec: 0.14 } : { freq: 1320, durationSec: 0.45 }) : kind
  const osc = c.createOscillator()
  const gain = c.createGain()
  const t = c.currentTime
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.015)
  gain.gain.linearRampToValueAtTime(0, t + durationSec)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + durationSec + 0.02)
}

export function speak(text: string, voiceName?: string): void {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  const voice = speechSynthesis.getVoices().find((v) => v.name === voiceName)
  u.lang = voice?.lang ?? 'fr-FR'
  if (voice) u.voice = voice
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

export const modeHasBeeps = (m: AudioMode) => m !== 'music'
export const modeHasVoice = (m: AudioMode) => m === 'music+beeps+voice'
export const modeHasVideoSound = (m: AudioMode) => m === 'video'
