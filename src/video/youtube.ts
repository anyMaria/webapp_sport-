/** API IFrame officielle de YouTube. Le lecteur reste visible et non recouvert (règle du plan). */
export interface YTPlayer {
  getCurrentTime(): number
  getDuration(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setPlaybackRate(rate: number): void
  /** 1 = lecture, 2 = pause. */
  getPlayerState(): number
  playVideo(): void
  pauseVideo(): void
  mute(): void
  unMute(): void
  destroy(): void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width?: string
      height?: string
      playerVars?: Record<string, number | string>
      events?: { onReady?: () => void; onError?: (e: { data: number }) => void }
    },
  ) => YTPlayer
}

let loading: Promise<YTNamespace> | null = null

export function loadYT(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
  if (w.YT?.Player) return Promise.resolve(w.YT)
  loading ??= new Promise<YTNamespace>((resolve, reject) => {
    w.onYouTubeIframeAPIReady = () => resolve(w.YT as YTNamespace)
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.onerror = () => { loading = null; reject(new Error('Pas de réseau : YouTube est injoignable.')) }
    document.head.appendChild(tag)
  })
  return loading
}

/** Extrait l'identifiant d'un lien YouTube (watch, youtu.be, shorts, embed) ou d'un identifiant seul. */
export function parseYouTubeId(input: string): string | null {
  const t = input.trim()
  const m = t.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/)
  if (m?.[1]) return m[1]
  return /^[A-Za-z0-9_-]{11}$/.test(t) ? t : null
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

export async function createYTPlayer(host: HTMLElement, videoId: string, startSec = 0, timeoutMs = 12000): Promise<YTPlayer> {
  const YT = await loadYT()
  host.replaceChildren()
  const mount = document.createElement('div')
  host.appendChild(mount)
  return new Promise<YTPlayer>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Le lecteur YouTube ne répond pas. Vérifie le réseau.')), timeoutMs)
    const player = new YT.Player(mount, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, mute: 1, controls: 1, rel: 0, start: Math.floor(startSec) },
      events: {
        onReady: () => { window.clearTimeout(timer); player.mute(); resolve(player) },
        onError: (e) => { window.clearTimeout(timer); reject(new Error(`YouTube ne peut pas lire cette vidéo (code ${e.data}).`)) },
      },
    })
  })
}
