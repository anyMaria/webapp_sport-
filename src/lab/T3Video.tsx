import { useEffect, useRef, useState } from 'react'
import { Btn, Field, Log, TestCard, useLog } from './ui'
import { createYTPlayer, parseYouTubeId, type YTPlayer } from './youtube'
import s from './lab.module.css'

export function T3Video() {
  const { lines, add, clear } = useLog()
  const [src, setSrc] = useState<string | null>(null)
  const [ytInput, setYtInput] = useState('')
  const ytHost = useRef<HTMLDivElement>(null)
  const ytPlayer = useRef<YTPlayer | null>(null)

  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])
  useEffect(() => () => ytPlayer.current?.destroy(), [])

  const pick = (f: File | undefined) => {
    if (!f) return
    setSrc(URL.createObjectURL(f))
    add(`Fichier choisi : ${f.name}. Lecture muette en boucle (muted playsinline).`)
  }

  const startYT = async () => {
    const id = parseYouTubeId(ytInput)
    if (!id || !ytHost.current) { add('Lien YouTube non reconnu.'); return }
    try {
      ytPlayer.current?.destroy()
      ytPlayer.current = await createYTPlayer(ytHost.current, id)
      ytPlayer.current.playVideo()
      add('Lecteur YouTube prêt, muet. Touche lecture dans le lecteur si besoin.')
    } catch (e) {
      add((e as Error).message)
    }
  }

  return (
    <TestCard
      id="t3"
      num={3}
      title="Vidéo muette pendant Spotify"
      how="Spotify en lecture. Choisis une vidéo locale (elle tourne muette en boucle), puis colle un lien YouTube. Vérifie que Spotify ne s'arrête dans aucun des deux cas."
      passIf="Spotify continue dans les deux cas."
      planB="Aucun : c'est un prérequis. Si ça échoue, le signaler avant d'aller plus loin."
    >
      <div className={s.row}>
        <Field label="Vidéo locale">
          <input type="file" accept="video/*" onChange={(e) => pick(e.target.files?.[0])} />
        </Field>
      </div>
      {src && <video className={s.video} src={src} muted loop playsInline autoPlay controls={false} />}
      <div className={s.row}>
        <Field label="Lien YouTube">
          <input value={ytInput} onChange={(e) => setYtInput(e.target.value)} placeholder="https://youtu.be/…" style={{ minWidth: 320 }} />
        </Field>
        <Btn primary onClick={startYT}>Afficher le lecteur</Btn>
        <Btn onClick={clear}>Effacer</Btn>
      </div>
      <div className={s.yt} ref={ytHost} />
      <Log lines={lines} />
    </TestCard>
  )
}
