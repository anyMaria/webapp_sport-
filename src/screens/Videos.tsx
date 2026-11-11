import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Screen } from '../app/Screen'
import { Card } from '../ui/Card'
import { db } from '../data/db'
import { VideoItem } from './VideoItem'
import s from '../app/app.module.css'
import c from './importScreen.module.css'

/** Toutes les vidéos : brouillons à terminer, vidéos sans découpage, vidéos découpées. */
export function Videos() {
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? []
  const counts = useLiveQuery(async () => {
    const map: Record<string, number> = {}
    for (const e of await db.exercises.toArray()) map[e.sourceId] = (map[e.sourceId] ?? 0) + 1
    return map
  }, []) ?? {}
  const sorted = [...sources].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const drafts = sorted.filter((x) => !counts[x.id] && x.draftSegs)
  const todo = sorted.filter((x) => !counts[x.id] && !x.draftSegs)
  const done = sorted.filter((x) => counts[x.id])
  const group = (title: string, list: typeof sorted) => list.length > 0 && (
    <Card title={`${title} · ${list.length}`}>
      <div className={c.list}>{list.map((src) => <VideoItem key={src.id} src={src} exerciseCount={counts[src.id] ?? 0} />)}</div>
    </Card>
  )
  return (
    <Screen title="Mes vidéos" subtitle="Toutes tes vidéos. Un découpage commencé s'enregistre tout seul : tu peux le reprendre plus tard.">
      <div className={s.actions}><Link to="/import" className={c.importLink}>Importer une vidéo</Link></div>
      {sorted.length === 0 && <p className={s.empty}>Aucune vidéo pour l'instant.</p>}
      {group('Brouillons à terminer', drafts)}
      {group('Pas encore découpées', todo)}
      {group('Découpées', done)}
    </Screen>
  )
}
