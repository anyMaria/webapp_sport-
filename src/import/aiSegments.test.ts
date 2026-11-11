import { describe, expect, it } from 'vitest'
import { buildSegments, PER_SHEET, sheetCount, sheetTimes, snapBoundaries, stitchSheets, type SheetMarks } from './aiSegments'

describe('repérage par IA : segments', () => {
  it('couvre toute la vidéo : exercices gardés, trous en pauses retirées, coupes à vérifier', () => {
    const s = buildSegments([{ start: 10, end: 40, name: 'Chat-vache', cue: 'Dos rond' }, { start: 50, end: 80, name: 'Fente', cue: '' }], 100)
    expect(s.map((x) => [x.name, x.startSec, x.endSec, x.kept])).toEqual([
      ['Pause', 0, 10, false], ['Chat-vache', 10, 40, true], ['Pause', 40, 50, false], ['Fente', 50, 80, true], ['Pause', 80, 100, false],
    ])
    expect(s.map((x) => !!x.verify)).toEqual([true, true, true, true, false])
  })
  it('ordonne, retire les chevauchements et referme les petits trous', () => {
    const s = buildSegments([{ start: 30.4, end: 60, name: 'B', cue: '' }, { start: 0, end: 30, name: 'A', cue: '' }], 60)
    expect(s.map((x) => [x.name, x.startSec, x.endSec])).toEqual([['A', 0, 30.4], ['B', 30.4, 60]])
  })
  it('sans résultat exploitable : une seule pause, rien de gardé', () => {
    const s = buildSegments([], 50)
    expect(s).toHaveLength(1)
    expect(s[0]!.kept).toBe(false)
  })
  it('cale les limites sur les changements d\'image proches et recolle les exercices qui s\'enchaînent', () => {
    const f = snapBoundaries([{ start: 0.4, end: 6.2, name: 'A', cue: '' }, { start: 6.9, end: 14, name: 'B', cue: '' }], [0, 5.5, 14.2], 1.5)
    expect(f.map((x) => [x.start, x.end])).toEqual([[0, 5.5], [5.5, 14.2]])
  })
  it('garde une limite sans changement d\'image proche', () => {
    expect(snapBoundaries([{ start: 3, end: 9, name: 'A', cue: '' }], [20, 30], 1.5)[0]).toMatchObject({ start: 3, end: 9 })
  })
})

describe('repérage par IA : planches', () => {
  it('deux images par seconde, dix planches au plus', () => {
    expect(sheetCount(3)).toBe(1)
    expect(sheetCount(29)).toBe(6)
    expect(sheetCount(900)).toBe(10)
  })
  it('deux planches voisines partagent une image', () => {
    const plan = sheetTimes(29)
    expect(plan).toHaveLength(6)
    expect(plan.every((t) => t.length === PER_SHEET)).toBe(true)
    for (let s = 1; s < plan.length; s++) expect(plan[s]![0]).toBe(plan[s - 1]![PER_SHEET - 1])
    const flat = plan.flat()
    expect(flat[0]).toBeGreaterThanOrEqual(0)
    expect(flat[flat.length - 1]).toBeLessThan(29)
  })
})

describe('repérage par IA : raccord des planches', () => {
  // Deux planches de 4 images, une image toutes les secondes ; l'image à 3,5 s est commune.
  const plan = [[0.5, 1.5, 2.5, 3.5], [3.5, 4.5, 5.5, 6.5]]
  const marks = (labels: number[], names: Record<number, string> = {}): SheetMarks => ({ labels, names: Object.entries(names).map(([ex, name]) => ({ ex: Number(ex), name, cue: '' })) })
  it('un exercice à cheval sur deux planches reste un seul exercice', () => {
    const { found } = stitchSheets(plan, [marks([0, 1, 1, 2], { 1: 'Pont', 2: 'Fente' }), marks([1, 1, 2, 2], { 1: 'Fente avant', 2: 'Planche' })], 7)
    expect(found.map((f) => [f.name, f.start, f.end])).toEqual([['Pont', 1, 3], ['Fente', 3, 5], ['Planche', 5, 7]])
  })
  it('sans raccord par l\'image commune, un même nom en début de planche raccorde quand même', () => {
    const { found } = stitchSheets(plan, [marks([1, 1, 1, 1], { 1: 'Chat-vache' }), marks([0, 3, 3, 3], { 3: 'chat vache' })], 7)
    expect(found.map((f) => [f.name, f.start, f.end])).toEqual([['Chat-vache', 0, 7]])
  })
  it('un numéro réutilisé par la planche suivante pour un autre exercice ne fusionne pas', () => {
    const { found } = stitchSheets(plan, [marks([1, 1, 1, 0], { 1: 'Pont' }), marks([0, 1, 1, 1], { 1: 'Fente' })], 7)
    expect(found.map((f) => f.name)).toEqual(['Pont', 'Fente'])
  })
  it('une planche sans réponse ne crée pas de coupe et est signalée', () => {
    const { found, missing } = stitchSheets(plan, [marks([1, 1, 1, 1], { 1: 'Pont' }), null], 7)
    expect(found.map((f) => [f.name, f.start, f.end])).toEqual([['Pont', 0, 7]])
    expect(missing).toEqual([[3.5, 7]])
  })
  it('à deux images par seconde, une image isolée est lissée', () => {
    const p = [[0.25, 0.75, 1.25, 1.75, 2.25, 2.75]]
    const { found } = stitchSheets(p, [marks([1, 1, 2, 1, 1, 1], { 1: 'Pont' })], 3)
    expect(found).toHaveLength(1)
  })
  it('sans nom : « Exercice N »', () => {
    expect(stitchSheets([[0.5, 1.5, 2.5, 3.5]], [marks([1, 1, 2, 2])], 4).found.map((f) => f.name)).toEqual(['Exercice 1', 'Exercice 2'])
  })
})
