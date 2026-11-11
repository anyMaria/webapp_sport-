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

/** Titre et créateur, via le service public oEmbed de YouTube (sans clé). Renvoie null hors connexion ou en cas d'échec. */
export async function fetchYouTubeInfo(id: string): Promise<{ title: string; author: string } | null> {
  try {
    const ctl = new AbortController()
    const t = window.setTimeout(() => ctl.abort(), 6000)
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { signal: ctl.signal })
    window.clearTimeout(t)
    if (!r.ok) return null
    const j = (await r.json()) as { title?: string; author_name?: string }
    return j.title ? { title: j.title, author: j.author_name ?? '' } : null
  } catch {
    return null
  }
}

/** Repères (chapitres) de la description, via la fonction serveur facultative. Voir api/youtube-chapters.ts. */
export async function youtubeChaptersEnabled(): Promise<boolean> {
  try {
    const r = await fetch('/api/youtube-chapters')
    return r.ok && ((await r.json()) as { enabled?: boolean }).enabled === true
  } catch {
    return false
  }
}

export async function fetchYouTubeChapters(id: string): Promise<string> {
  const r = await fetch(`/api/youtube-chapters?id=${encodeURIComponent(id)}`)
  const j = (await r.json().catch(() => ({}))) as { description?: string; error?: string }
  if (!r.ok) throw new Error(j.error ?? 'Impossible de lire la description de la vidéo.')
  return j.description ?? ''
}
