import { Route, Routes } from 'react-router-dom'
import { Lab } from './lab/Lab'
import { Home } from './screens/Home'
import { Settings } from './screens/Settings'
import { Rhythm } from './screens/Rhythm'
import { Collection } from './screens/Collection'
import { Demo } from './screens/Demo'
import { Import } from './screens/Import'
import { Split } from './screens/Split'
import { Library } from './library/Library'
import { Composer } from './library/Composer'
import { SessionScreen } from './player/SessionScreen'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/reglages" element={<Settings />} />
      <Route path="/bibliotheque" element={<Library />} />
      <Route path="/composer/:id" element={<Composer />} />
      <Route path="/import" element={<Import />} />
      <Route path="/decoupage/:sourceId" element={<Split />} />
      <Route path="/mon-rythme" element={<Rhythm />} />
      <Route path="/collection" element={<Collection />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/seance/:workoutId" element={<SessionScreen />} />
      <Route path="/lab" element={<Lab />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
