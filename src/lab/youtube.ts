/** Chargeur minimal de l'API IFrame officielle YouTube (lecteur visible, jamais masqué). */
export interface YTPlayer {
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  mute(): void
  destroy(): void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      playerVars?: Record<string, number | string>
      events?: { onReady?: () => void; onError?: (e: { data: number }) => void }
    },
  ) => YTPlayer
}

let loading: Promise<YTNamespace> | null = null

export function loadYT(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
  if (w.YT?.Player) return Promise.resolve(w.YT)
  loading ??= new Promise((resolve, reject) => {
    w.onYouTubeIframeAPIReady = () => resolve(w.YT as YTNamespace)
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.onerror = () => reject(new Error('API YouTube injoignable (réseau ?)'))
    document.head.appendChild(tag)
  })
  return loading
}

export function parseYouTubeId(input: string): string | null {
  const m = input.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  if (m?.[1]) return m[1]
  return /^[A-Za-z0-9_-]{11}$/.test(input.trim()) ? input.trim() : null
}

export async function createYTPlayer(
  host: HTMLElement,
  videoId: string,
  start?: number,
): Promise<YTPlayer> {
  const YT = await loadYT()
  host.replaceChildren()
  const mount = document.createElement('div')
  host.appendChild(mount)
  return new Promise((resolve, reject) => {
    const player = new YT.Player(mount, {
      videoId,
      playerVars: { playsinline: 1, mute: 1, controls: 1, rel: 0, start: start ?? 0 },
      events: {
        onReady: () => {
          player.mute()
          resolve(player)
        },
        onError: (e) => reject(new Error(`Erreur du lecteur YouTube (code ${e.data})`)),
      },
    })
  })
}
