let ctx: AudioContext | null = null

/** Un bip synthétisé, avec enveloppe de gain pour éviter les claquements. À appeler depuis une touche. */
export async function playBeep(volume: number, opts: { freq?: number; durationSec?: number } = {}): Promise<void> {
  ctx ??= new AudioContext()
  await ctx.resume()
  const { freq = 880, durationSec = 0.2 } = opts
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const t = ctx.currentTime
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.02)
  gain.gain.linearRampToValueAtTime(0, t + durationSec)
  osc.connect(gain).connect(ctx.destination)
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
