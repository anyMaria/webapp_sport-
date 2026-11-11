import { Component, type ReactNode } from 'react'

/** Dernier filet : un message clair plutôt qu'un écran blanc, avec une sortie. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ fontSize: 30 }}>Quelque chose s'est mal passé</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Tes données sont intactes. Recharge l'app ; si ça recommence, fais une sauvegarde dans les Réglages dès que possible.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => location.assign('/')} style={{ minHeight: 52, padding: '0 24px', borderRadius: 20, border: 'none', background: 'var(--effort)', color: 'var(--on-accent)', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Retour à l'accueil</button>
        </div>
      </main>
    )
  }
}
