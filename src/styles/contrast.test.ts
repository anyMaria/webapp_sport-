/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const tok = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1]!

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

// Paires réellement utilisées dans l'interface : texte, fond.
const PAIRS: [string, string][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['text', 'bg-deep'],
  ['text-muted', 'bg'], ['text-muted', 'surface'], ['text-muted', 'surface-2'], ['text-muted', 'bg-deep'],
  ['on-accent', 'effort'], ['on-accent', 'transition'],
  ['effort', 'bg'], ['effort', 'surface'], ['effort', 'surface-2'],
  ['transition', 'bg'], ['transition', 'surface'], ['transition', 'surface-2'],
  ['danger', 'bg'], ['danger', 'surface'],
]

describe('contraste du texte (4,5:1 au minimum)', () => {
  it.each(PAIRS)('%s sur %s', (fg, bg) => {
    expect(ratio(tok(fg), tok(bg))).toBeGreaterThanOrEqual(4.5)
  })
})
