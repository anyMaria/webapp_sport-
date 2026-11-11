import { describe, expect, it } from 'vitest'
import { audioBoundaries, energyEnvelope, findBeeps, findSilences } from './audio'
import { mergeCandidates } from './merge'
import { rhythmBoundaries, rhythmSegments } from './rhythm'
import { adaptiveThreshold, frameMotion, histDistance, lumaHistogram, shotBoundaries } from './shots'
import type { Candidate } from './types'

const RATE = 16000
const tone = (freq: number, sec: number, amp = 0.5) => Float32Array.from({ length: Math.round(sec * RATE) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / RATE))
const silence = (sec: number) => new Float32Array(Math.round(sec * RATE))
const noise = (sec: number, amp = 0.1) => { let s = 1; return Float32Array.from({ length: Math.round(sec * RATE) }, () => { s = (s * 16807) % 2147483647; return amp * ((s / 2147483647) * 2 - 1) }) }
const concat = (...parts: Float32Array[]) => { const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length } return out }
const cand = (t: number, source: Candidate['source'], strength = 0.9): Candidate => ({ t, source, strength })

describe('changements de plan', () => {
  it('une image grise puis blanche : écart maximal', () => {
    const grey = new Uint8ClampedArray(64 * 36 * 4).fill(128)
    const white = new Uint8ClampedArray(64 * 36 * 4).fill(255)
    expect(histDistance(lumaHistogram(grey), lumaHistogram(grey))).toBe(0)
    expect(histDistance(lumaHistogram(grey), lumaHistogram(white))).toBeCloseTo(1)
    expect(frameMotion(grey, white)).toBeCloseTo(127 / 255, 1)
  })
  it('ne retient que les écarts au-dessus du seuil adaptatif', () => {
    const diffs = Array.from({ length: 60 }, (_, i) => (i === 20 ? 0.8 : i === 45 ? 0.2 : 0.02 + (i % 3) * 0.005))
    const b = shotBoundaries(diffs, 0.5)
    expect(b.map((x) => x.t)).toEqual([10.25, 22.75])
    expect(b[0]!.strength).toBeGreaterThan(b[1]!.strength)
  })
  it('un plan continu sans coupure ne donne aucune frontière', () => {
    expect(shotBoundaries(Array.from({ length: 100 }, (_, i) => 0.03 + (i % 4) * 0.004), 0.5)).toEqual([])
  })
  it('le plancher évite de prendre du bruit pour des coupures', () => {
    expect(adaptiveThreshold(Array(50).fill(0.001))).toBe(0.12)
  })
})

describe('bips et silences', () => {
  it('détecte un silence de 1 s au milieu d’un bruit', () => {
    const s = concat(noise(3), silence(1), noise(3))
    const sil = findSilences(energyEnvelope(s, RATE))
    expect(sil).toHaveLength(1)
    expect(sil[0]!.start).toBeCloseTo(3, 1)
    expect(sil[0]!.end).toBeCloseTo(4, 1)
  })
  it('ignore un creux plus court que 0,7 s', () => {
    expect(findSilences(energyEnvelope(concat(noise(3), silence(0.4), noise(3)), RATE))).toEqual([])
  })
  it('détecte un bip de 300 ms à 1 kHz dans du bruit, pas la parole simulée', () => {
    const s = concat(noise(2, 0.05), tone(1000, 0.3), noise(2, 0.05))
    const beeps = findBeeps(s, RATE, energyEnvelope(s, RATE))
    expect(beeps).toHaveLength(1)
    expect(beeps[0]!.start).toBeCloseTo(2, 1)
    expect(findBeeps(noise(5, 0.3), RATE, energyEnvelope(noise(5, 0.3), RATE))).toEqual([])
  })
  it('rejette un son trop long (> 600 ms) ou hors bande', () => {
    const long = concat(noise(1, 0.05), tone(1000, 1.5), noise(1, 0.05))
    expect(findBeeps(long, RATE, energyEnvelope(long, RATE))).toEqual([])
    const low = concat(noise(1, 0.05), tone(300, 0.3), noise(1, 0.05))
    expect(findBeeps(low, RATE, energyEnvelope(low, RATE))).toEqual([])
  })
  it('donne les frontières début et fin de silence et début de bip', () => {
    const s = concat(noise(3, 0.1), silence(1.2), tone(1200, 0.3), noise(3, 0.1))
    const b = audioBoundaries(s, RATE)
    expect(b.every((x) => x.source === 'audio')).toBe(true)
    expect(b.length).toBeGreaterThanOrEqual(3)
  })
})

describe('rythme régulier', () => {
  it('génère effort/pause et cale sur une frontière détectée proche', () => {
    const b = rhythmBoundaries({ effortSec: 30, restSec: 10, startSec: 5 }, 100, [cand(35.8, 'shots')])
    expect(b.map((x) => x.t)).toEqual([5, 35.8, 45, 75, 85])
    expect(b.find((x) => x.t === 35.8)!.strength).toBe(0.8)
    expect(b.find((x) => x.t === 45)!.strength).toBe(0.4)
  })
  it('durées nulles : rien', () => {
    expect(rhythmBoundaries({ effortSec: 0, restSec: 0, startSec: 0 }, 100, [])).toEqual([])
  })
})

describe('fusion', () => {
  it('sans frontière : un seul segment gardé', () => {
    const s = mergeCandidates([], 120)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ startSec: 0, endSec: 120, kept: true, name: 'Exercice 1' })
  })
  it('regroupe les frontières à moins de 1 s', () => {
    const s = mergeCandidates([cand(40, 'shots'), cand(40.6, 'audio')], 100)
    expect(s.map((x) => [x.startSec, x.endSec])).toEqual([[0, 40.3], [40.3, 100]])
  })
  it('rattache un segment de moins de 8 s à son voisin', () => {
    const s = mergeCandidates([cand(30, 'shots'), cand(34, 'audio')], 100)
    expect(s).toHaveLength(2)
    expect(s.every((x) => x.endSec - x.startSec >= 8)).toBe(true)
  })
  it('un segment de 8 à 15 s entre deux longs devient « Pause », retiré', () => {
    const s = mergeCandidates([cand(40, 'shots'), cand(52, 'audio')], 100)
    const mid = s[1]!
    expect(mid).toMatchObject({ name: 'Pause', kept: false })
    expect(s[0]!.kept && s[2]!.kept).toBe(true)
  })
  it('deux détecteurs d’accord : confiance haute ; un seul faible : « Fin à vérifier »', () => {
    const s = mergeCandidates([cand(30, 'shots', 0.9), cand(30.2, 'audio', 0.9), cand(60, 'shots', 0.9), cand(60.3, 'audio', 0.9), cand(90, 'shots', 0.4)], 120)
    expect(s).toHaveLength(4)
    expect(s[1]!.verify).toBe(false)
    expect(s[2]!.verify).toBe(true)
  })
  it('intro sans mouvement retirée, segment actif du bord gardé et à vérifier', () => {
    const values = Array.from({ length: 240 }, (_, i) => (i < 40 ? 0.001 : 0.1))
    const s = mergeCandidates([cand(20, 'shots'), cand(60, 'shots'), cand(100, 'audio')], 120, { stepSec: 0.5, values })
    expect(s[0]).toMatchObject({ name: 'Intro', kept: false })
    expect(s[s.length - 1]!.kept).toBe(true)
    expect(s[s.length - 1]!.verify).toBe(true)
  })
  it('ignore les frontières collées aux extrémités', () => {
    expect(mergeCandidates([cand(0.4, 'shots'), cand(119.5, 'shots')], 120)).toHaveLength(1)
  })
})

describe('rythme régulier, découpage direct', () => {
  const view = (s: ReturnType<typeof rhythmSegments>) => s.map((x) => [x.name, x.startSec, x.endSec, x.kept])
  it('effort = exercice gardé, pause = pause retirée, même très courts', () => {
    expect(view(rhythmSegments({ effortSec: 5, restSec: 3, startSec: 0 }, 16))).toEqual([
      ['Exercice 1', 0, 5, true], ['Pause', 5, 8, false], ['Exercice 2', 8, 13, true], ['Pause', 13, 16, false],
    ])
  })
  it('avant le début : une intro retirée ; bout final de moins de 1 s rattaché', () => {
    expect(view(rhythmSegments({ effortSec: 30, restSec: 10, startSec: 4 }, 74.5))).toEqual([
      ['Intro', 0, 4, false], ['Exercice 1', 4, 34, true], ['Pause', 34, 44, false], ['Exercice 2', 44, 74.5, true],
    ])
  })
  it('sans pause : exercices bout à bout', () => {
    expect(view(rhythmSegments({ effortSec: 10, restSec: 0, startSec: 0 }, 25))).toEqual([
      ['Exercice 1', 0, 10, true], ['Exercice 2', 10, 20, true], ['Exercice 3', 20, 25, true],
    ])
  })
  it('effort nul : rien', () => { expect(rhythmSegments({ effortSec: 0, restSec: 5, startSec: 0 }, 30)).toEqual([]) })
})
