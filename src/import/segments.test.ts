import { describe, expect, it } from 'vitest'
import { adjust, mergeWithNext, splitAt, wholeVideo, type Segment } from './segments'

const seg = (id: string, startSec: number, endSec: number, extra: Partial<Segment> = {}): Segment => ({ id, startSec, endSec, name: id, cue: '', tags: [], kept: true, ...extra })

describe('découpage', () => {
  it('une vidéo entière donne un seul segment gardé', () => {
    const [s, ...rest] = wholeVideo(42.123)
    expect(rest).toEqual([])
    expect(s).toMatchObject({ startSec: 0, endSec: 42.12, kept: true })
  })

  it('coupe en deux au milieu, les moitiés se touchent', () => {
    const out = splitAt([seg('a', 0, 60)], 'a', 20)
    expect(out.map((s) => [s.startSec, s.endSec])).toEqual([[0, 20], [20, 60]])
  })

  it('refuse une coupe qui laisse moins d’une seconde', () => {
    const segs = [seg('a', 0, 60)]
    expect(splitAt(segs, 'a', 0.5)).toBe(segs)
    expect(splitAt(segs, 'a', 59.5)).toBe(segs)
  })

  it('fusionne avec le suivant en gardant le nom du premier', () => {
    const out = mergeWithNext([seg('a', 0, 10, { tags: ['dos'] }), seg('b', 10, 30, { kept: false, tags: ['dos', 'hanches'] })], 'a')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'a', startSec: 0, endSec: 30, kept: true, tags: ['dos', 'hanches'] })
  })

  it('fusionner le dernier segment ne fait rien', () => {
    const segs = [seg('a', 0, 10)]
    expect(mergeWithNext(segs, 'a')).toBe(segs)
  })

  it('déplacer une frontière commune bouge les deux segments', () => {
    const out = adjust([seg('a', 0, 20), seg('b', 20, 60)], 'a', 'end', 0.5, 60)
    expect(out.map((s) => [s.startSec, s.endSec])).toEqual([[0, 20.5], [20.5, 60]])
    const back = adjust(out, 'b', 'start', -0.5, 60)
    expect(back.map((s) => [s.startSec, s.endSec])).toEqual([[0, 20], [20, 60]])
  })

  it('ne dépasse ni le voisin ni la durée de la vidéo', () => {
    const segs = [seg('a', 0, 20), seg('b', 20, 22)]
    expect(adjust(segs, 'a', 'end', 5, 22)[1]!.startSec).toBe(21)
    expect(adjust([seg('a', 0, 10)], 'a', 'end', 5, 10)[0]!.endSec).toBe(10)
    expect(adjust([seg('a', 0, 10)], 'a', 'start', -5, 10)[0]!.startSec).toBe(0)
  })

  it('un segment isolé garde au moins une seconde', () => {
    expect(adjust([seg('a', 5, 10)], 'a', 'end', -10, 60)[0]!.endSec).toBe(6)
  })

  it('un trou entre deux segments n’est pas rempli', () => {
    const out = adjust([seg('a', 0, 10), seg('b', 15, 30)], 'a', 'end', 0.5, 30)
    expect(out[1]!.startSec).toBe(15)
  })
})
