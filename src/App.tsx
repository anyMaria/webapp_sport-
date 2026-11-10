import { Link, Route, Routes } from 'react-router-dom'
import { APP_NAME } from './lib/constants'
import { Lab } from './lab/Lab'

function Home() {
  return (
    <main style={{ padding: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>{APP_NAME}</h1>
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>
        Phase 0 : l'app n'existe pas encore. Seule la page de tests est disponible.
      </p>
      <Link to="/lab" style={{ color: 'var(--effort)', fontWeight: 600 }}>
        Ouvrir la page de tests /lab
      </Link>
    </main>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lab" element={<Lab />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
