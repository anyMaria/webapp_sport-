import { describe, expect, it } from 'vitest'
import { buildSegments, frameCount, snapBoundaries } from './aiSegments'

describe('découpe par IA', () => {
  it('couvre toute la vidéo : exercices gardés, trous en pauses retirées', () => {
    const s = buildSegments([{ start: 10, end: 40, name: 'Chat-vache', cue: 'Dos rond' }, { start: 50, end: 80, name: 'Fente', cue: '' }], 100)
    expect(s.map((x) => [x.name, x.startSec, x.endSec, x.kept])).toEqual([
      ['Pause', 0, 10, false], ['Chat-vache', 10, 40, true], ['Pause', 40, 50, false], ['Fente', 50, 80, true], ['Pause', 80, 100, false],
    ])
    expect(s.filter((x) => x.kept).every((x) => x.verify)).toBe(true)
  })
  it('ordonne et retire les chevauchements', () => {
    const s = buildSegments([{ start: 30, end: 60, name: 'B', cue: '' }, { start: 0, end: 35, name: 'A', cue: '' }], 60)
    expect(s.map((x) => [x.name, x.startSec, x.endSec])).toEqual([['A', 0, 35], ['B', 35, 60]])
  })
  it('sans résultat exploitable : une seule pause, rien de gardé', () => {
    const s = buildSegments([], 50)
    expect(s).toHaveLength(1)
    expect(s[0]!.kept).toBe(false)
  })
  it('nombre d\'images : une par seconde, borné', () => {
    expect(frameCount(2)).toBe(8)
    expect(frameCount(29)).toBe(58)
    expect(frameCount(300)).toBe(100)
    expect(frameCount(100000)).toBe(100)
  })
  it('cale les limites sur les changements d\'image proches et recolle les exercices qui s\'enchaînent', () => {
    const f = snapBoundaries([{ start: 0.4, end: 6.2, name: 'A', cue: '' }, { start: 6.9, end: 14, name: 'B', cue: '' }], [0, 5.5, 14.2], 1.5)
    expect(f.map((x) => [x.start, x.end])).toEqual([[0, 5.5], [5.5, 14.2]])
  })
  it('garde une limite sans changement d\'image proche', () => {
    expect(snapBoundaries([{ start: 3, end: 9, name: 'A', cue: '' }], [20, 30], 1.5)[0]).toMatchObject({ start: 3, end: 9 })
  })
})
