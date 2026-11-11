import { describe, expect, it } from 'vitest'
import { buildSegments, frameCount } from './aiSegments'

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
  it('nombre d\'images borné', () => {
    expect(frameCount(10)).toBe(8)
    expect(frameCount(300)).toBe(60)
    expect(frameCount(90)).toBe(30)
  })
})
