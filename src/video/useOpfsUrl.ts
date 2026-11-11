import { useEffect, useState } from 'react'
import { getVideoFile } from '../data/opfs'

/** URL d'objet pour un fichier OPFS (lu par getFile, jamais en entier en mémoire). Révoquée au démontage. */
export function useOpfsUrl(path: string | undefined): { url: string | null; error: boolean } {
  const [state, setState] = useState<{ path?: string; url: string | null; error: boolean }>({ url: null, error: false })
  useEffect(() => {
    if (!path) return
    let revoked = false
    let created: string | null = null
    getVideoFile(path)
      .then((f) => {
        if (revoked) return
        created = URL.createObjectURL(f)
        setState({ path, url: created, error: false })
      })
      .catch(() => !revoked && setState({ path, url: null, error: true }))
    return () => {
      revoked = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [path])
  return state.path === path ? { url: state.url, error: state.error } : { url: null, error: false }
}
