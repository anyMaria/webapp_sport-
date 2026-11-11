import { describe, expect, it } from 'vitest'
import { customEquipment, equipmentText, mergeEquipment, NO_EQUIPMENT, toggleEquipment } from './equipment'

describe('équipement d\'une séance', () => {
  it('ajoute et retire', () => {
    const a = toggleEquipment([], 'Bandes élastiques')
    expect(toggleEquipment(a, 'Blocs de yoga')).toEqual(['Bandes élastiques', 'Blocs de yoga'])
    expect(toggleEquipment(a, 'bandes élastiques ')).toEqual([])
  })
  it('« Sans équipement » exclut le reste, et inversement', () => {
    expect(toggleEquipment(['Bandes élastiques', 'Tapis'], NO_EQUIPMENT)).toEqual([NO_EQUIPMENT])
    expect(toggleEquipment([NO_EQUIPMENT], 'Tapis')).toEqual(['Tapis'])
  })
  it('ignore un texte vide et coupe un texte trop long', () => {
    expect(toggleEquipment(['Tapis'], '   ')).toEqual(['Tapis'])
    expect(toggleEquipment([], 'x'.repeat(80))[0]).toHaveLength(40)
  })
  it('texte des cartes', () => {
    expect(equipmentText(['Bandes élastiques', 'Tapis'])).toBe('Bandes élastiques · Tapis')
    expect(equipmentText(undefined)).toBe('')
  })
  it('raccourcis : équipements écrits ailleurs, sans doublon ni choix courant', () => {
    expect(customEquipment([['Tapis', 'Blocs de yoga'], undefined, ['tapis', 'Haltères']])).toEqual(['Haltères', 'Tapis'])
  })
})

describe('équipement d\'une séance, d\'après ses vidéos', () => {
  it('réunit sans doublon ; « Sans équipement » s\'efface devant un vrai équipement', () => {
    expect(mergeEquipment([['Bandes élastiques'], [NO_EQUIPMENT], undefined, ['bandes élastiques', 'Blocs de yoga']])).toEqual(['Bandes élastiques', 'Blocs de yoga'])
    expect(mergeEquipment([[NO_EQUIPMENT], [NO_EQUIPMENT]])).toEqual([NO_EQUIPMENT])
    expect(mergeEquipment([undefined, []])).toEqual([])
  })
})
