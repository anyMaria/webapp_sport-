// Génère les dessins des séries « Énergie » et « Jardin » : formes simples, contour clair épais façon sticker.
// À remplacer par les illustrations de l'utilisatrice (mêmes noms de fichiers dans src/stickers/art/).
import { writeFileSync } from 'node:fs'

const OUT = '#F6F4EC'
const f = (d, fill, extra = '') => ({ kind: 'fill', d, fill, extra })
const st = (d, color, w) => ({ kind: 'stroke', d, color, w })
const circle = (cx, cy, r, fill) => f(`M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0Z`, fill)

const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]
const star = (cx, cy, R, r, n = 5) => {
  const pts = []
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 ? r : R, -90 + (i * 180) / n).map((v) => v.toFixed(1)).join(' '))
  return `M${pts.join(' L')}Z`
}

const art = {
  eclair: [f('M290 60 L150 280 L240 280 L210 450 L370 210 L275 210 Z', '#FFD84D')],
  flamme: [
    f('M256 60 C300 140 380 190 380 300 C380 390 320 450 256 450 C192 450 132 390 132 300 C132 250 160 210 190 180 C195 220 215 240 235 240 C230 170 240 110 256 60 Z', '#FF7A45'),
    f('M256 450 C215 450 190 420 190 380 C190 335 225 315 256 270 C290 315 322 335 322 380 C322 420 297 450 256 450Z', '#FFD84D'),
  ],
  fusee: [
    f('M182 300 L120 390 L196 372Z', '#FF5C8A'), f('M330 300 L392 390 L316 372Z', '#FF5C8A'),
    f('M226 335 L256 450 L286 335Z', '#FFB27A'),
    f('M256 50 C330 120 350 230 330 335 L182 335 C162 230 182 120 256 50Z', '#8C9BFF'),
    circle(256, 205, 36, '#E5F6FF'),
  ],
  soleil: [
    ...Array.from({ length: 8 }, (_, i) => { const [x1, y1] = polar(256, 256, 130, i * 45); const [x2, y2] = polar(256, 256, 190, i * 45); return st(`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`, '#FFB84D', 28) }),
    circle(256, 256, 100, '#FFD84D'),
  ],
  etoile: [f(star(256, 270, 200, 90), '#FFD84D')],
  coeur: [f('M256 440 C110 330 90 230 120 170 C155 100 235 110 256 170 C277 110 357 100 392 170 C422 230 402 330 256 440Z', '#FF5C8A')],
  diamant: [f('M150 170 L210 90 L302 90 L362 170 L256 440Z', '#5CE0FF'), st('M150 170 H362 M210 90 L256 170 L302 90 M256 170 V440', '#E5FBFF', 10)],
  trophee: [
    st('M170 130 C100 130 100 230 190 250', '#FFC94D', 26), st('M342 130 C412 130 412 230 322 250', '#FFC94D', 26),
    f('M170 90 H342 V200 C342 270 300 310 256 310 C212 310 170 270 170 200Z', '#FFC94D'),
    f('M236 310 H276 V380 H236Z', '#E0A82E'), f('M190 380 H322 V430 H190Z', '#FFC94D'),
  ],
  fleur: [
    ...Array.from({ length: 6 }, (_, i) => { const [x, y] = polar(256, 256, 95, i * 60); return circle(+x.toFixed(1), +y.toFixed(1), 62, '#FF8FC7') }),
    circle(256, 256, 48, '#FFD84D'),
  ],
  feuille: [f('M120 400 C110 230 220 90 400 90 C410 270 320 400 120 400Z', '#5FD068'), st('M130 390 C200 290 280 210 380 110', '#C8F5CC', 12)],
  goutte: [f('M256 70 C330 190 380 250 380 320 C380 392 325 445 256 445 C187 445 132 392 132 320 C132 250 182 190 256 70Z', '#5CC8FF'), st('M200 330 C205 370 230 390 260 392', '#E5F6FF', 14)],
  papillon: [
    f('M256 250 C170 110 70 150 95 250 C108 320 205 330 256 270Z', '#B58CFF'), f('M256 250 C342 110 442 150 417 250 C404 320 307 330 256 270Z', '#B58CFF'),
    f('M256 280 C190 300 130 380 190 420 C230 440 256 360 256 300Z', '#FF8FC7'), f('M256 280 C322 300 382 380 322 420 C282 440 256 360 256 300Z', '#FF8FC7'),
    f('M244 150 H268 V420 H244Z', '#2B3A35'),
  ],
  champignon: [
    f('M205 270 H307 V400 C307 440 205 440 205 400Z', '#F6E7D0'),
    f('M80 280 C80 150 165 80 256 80 C347 80 432 150 432 280Z', '#FF5C5C'),
    circle(190, 200, 30, '#FFFFFF'), circle(300, 160, 24, '#FFFFFF'), circle(350, 235, 20, '#FFFFFF'),
  ],
  cactus: [
    f('M170 400 H342 L322 460 H190Z', '#E08A5C'),
    f('M216 400 V150 C216 100 296 100 296 150 V400Z', '#4FC27A'),
    st('M216 300 H160 V230', '#4FC27A', 44), st('M296 260 H352 V190', '#4FC27A', 44),
  ],
  arcenciel: [
    st('M70 390 A186 186 0 0 1 442 390', '#FF5C5C', 36), st('M106 390 A150 150 0 0 1 406 390', '#FFC94D', 36), st('M142 390 A114 114 0 0 1 370 390', '#5FD068', 36), st('M178 390 A78 78 0 0 1 334 390', '#5CC8FF', 36),
  ],
  nuage: [
    f('M150 400 C80 400 70 300 140 290 C140 200 260 170 300 250 C380 220 440 290 410 350 C440 400 400 400 380 400Z', '#E5F6FF'),
    circle(180, 300, 20, '#BFE3F7'),
  ],
}

for (const [name, shapes] of Object.entries(art)) {
  const under = shapes.map((s) => (s.kind === 'fill'
    ? `<path d="${s.d}" fill="${OUT}" stroke="${OUT}" stroke-width="44" stroke-linejoin="round" />`
    : `<path d="${s.d}" fill="none" stroke="${OUT}" stroke-width="${s.w + 44}" stroke-linecap="round" stroke-linejoin="round" />`)).join('\n')
  const over = shapes.map((s) => (s.kind === 'fill'
    ? `<path d="${s.d}" fill="${s.fill}" />`
    : `<path d="${s.d}" fill="none" stroke="${s.color}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round" />`)).join('\n')
  writeFileSync(new URL(`../src/stickers/art/${name}.svg`, import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n<g>\n${under}\n</g>\n<g>\n${over}\n</g>\n</svg>\n`)
}
console.log(Object.keys(art).length, 'dessins')
