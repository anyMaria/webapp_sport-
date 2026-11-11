import { Route, Routes } from 'react-router-dom'
import { Lab } from './lab/Lab'
import { Home } from './screens/Home'
import { Settings } from './screens/Settings'
import { Soon } from './screens/Soon'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/reglages" element={<Settings />} />
      <Route path="/bibliotheque" element={<Soon title="Bibliothèque d'exercices" phase={3} text="Tes exercices et la composition de séances." />} />
      <Route path="/mon-rythme" element={<Soon title="Mon rythme" phase={6} text="Ta série, ton créneau et la séance express." />} />
      <Route path="/collection" element={<Soon title="Collection" phase={7} text="Tes stickers et la révélation des pochettes." />} />
      <Route path="/lab" element={<Lab />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
