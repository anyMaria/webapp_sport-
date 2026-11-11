import { useEffect, useState } from 'react'
import { db } from '../data/db'

/** Vignette d'exercice stockée dans IndexedDB ; bloc neutre s'il n'y en a pas. */
export function Thumb({ id, className }: { id?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    let alive = true
    let made: string | null = null
    void db.thumbs.get(id).then((t) => {
      if (!alive || !t) return
      made = URL.createObjectURL(t.blob)
      setUrl(made)
    })
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [id])
  return url ? <img className={className} src={url} alt="" /> : <div className={className} aria-hidden="true" />
}
