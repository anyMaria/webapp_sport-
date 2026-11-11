import { describe, expect, it } from 'vitest'
import { parseChapters } from './chapters'
import { parseYouTubeId } from '../video/youtube'

describe('repères de description', () => {
  it('lit les lignes « m:ss Nom » et ferme le dernier à la durée', () => {
    const s = parseChapters('0:00 Intro\n2:15 Chat-vache\n4:05 Posture de l’enfant', 300)
    expect(s.map((x) => [x.startSec, x.endSec, x.name])).toEqual([[0, 135, 'Intro'], [135, 245, 'Chat-vache'], [245, 300, 'Posture de l’enfant']])
  })
  it('accepte h:mm:ss, tirets, lignes sans repère ignorées, désordre trié', () => {
    const s = parseChapters('Au programme :\n- 1:00:05 - Fin\n0:30: Début', 4000)
    expect(s.map((x) => x.name)).toEqual(['Début', 'Fin'])
    expect(s[1]!.startSec).toBe(3605)
  })
  it('ignore un repère au-delà de la durée et nomme les repères sans titre', () => {
    const s = parseChapters('0:10\n9:99 trop loin', 60)
    expect(s).toHaveLength(1)
    expect(s[0]!.name).toBe('Exercice 1')
  })
  it('aucun repère : liste vide', () => {
    expect(parseChapters('rien ici', 100)).toEqual([])
  })
})

describe('liens YouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s', (input, id) => expect(parseYouTubeId(input)).toBe(id))
  it('refuse le reste', () => {
    expect(parseYouTubeId('https://example.com/x')).toBeNull()
    expect(parseYouTubeId('')).toBeNull()
  })
})
