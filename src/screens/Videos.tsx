import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Screen } from '../app/Screen'
import { Card } from '../ui/Card'
import { db } from '../data/db'
import { useVideoStats } from '../data/useVideoStats'
import { VideoItem } from './VideoItem'
import s from '../app/app.module.css'
import c from './importScreen.module.css'

/** Toutes les vidéos : brouillons à terminer, vidéos sans découpage, vidéos découpées. */
export function Videos() {
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? []
  const { counts, thumbs } = useVideoStats()
  const sorted = [...sources].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const drafts = sorted.filter((x) => !counts[x.id] && x.draftSegs)
  const todo = sorted.filter((x) => !counts[x.id] && !x.draftSegs)
  const done = sorted.filter((x) => counts[x.id])
  const group = (title: string, list: typeof sorted) => list.length > 0 && (
    <Card title={`${title} · ${list.length}`}>
      <div className={c.list}>{list.map((src) => <VideoItem key={src.id} src={src} exerciseCount={counts[src.id] ?? 0} thumbId={thumbs[src.id]} />)}</div>
    </Card>
  )
  return (
    <Screen title="Mes vidéos" subtitle="Un découpage commencé s'enregistre tout seul : tu peux le reprendre plus tard.">
      <div className={s.actions}><Link to="/import" className={c.importLink}>Importer une vidéo</Link></div>
      {sorted.length === 0 && <p className={s.empty}>Aucune vidéo pour l'instant.</p>}
      {group('Découpage à terminer', drafts)}
      {group('À découper', todo)}
      {group('Prêtes pour une séance', done)}
    </Screen>
  )
}
