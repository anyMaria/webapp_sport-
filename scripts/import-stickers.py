#!/usr/bin/env python3
"""Importe les stickers de l'utilisatrice : un sous-dossier par catégorie, PNG ou JPEG.

Usage : python3 scripts/import-stickers.py DOSSIER_SOURCE [DOSSIER_SOURCE ...]
- JPEG (fond blanc ou gris clair) : le fond relié aux bords devient transparent.
- Recadrage serré, contour clair épais, 400 px au plus, WebP avec transparence -> src/stickers/art/{id}.webp
- Écrit src/stickers/mine.ts (identifiants, noms, séries).
"""
import re, sys, unicodedata, json
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src/stickers/art'
MAX = 400

# Catégorie (nom du dossier) -> nom de la série affichée
SERIES = {
    'weird': 'Weird', 'characters': 'Personnages', 'bibel': 'Bibel', 'mouse': 'Souris',
    'capybara': 'Capybaras', 'cats': 'Chats', 'girly': 'Girly',
}
# Petites corrections de noms (fautes de frappe)
FIX = {'thylbs up mouse': 'thumbs up mouse', 'cappy summer': 'capy summer', 'it ll be alright': "it'll be alright",
       'brorlellqbhcsbvlf': 'lizard', 'poney twitching': 'pony twitching', 'poney lovey': 'pony lovey', 'poney shy': 'pony shy',
       'mousi kurimi': 'mouse kurimi'}

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def remove_background(im):
    """Rend transparent le fond clair relié aux bords de l'image."""
    a = np.asarray(im.convert('RGB')).astype(int)
    h, w, _ = a.shape
    light = (a.min(axis=2) >= 205) & ((a.max(axis=2) - a.min(axis=2)) <= 18)
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    rgba = np.dstack([a.astype(np.uint8), np.where(seen, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')

def with_outline(im, px=7):
    """Contour clair épais façon sticker découpé : visible sur fond sombre, même pour un dessin noir."""
    pad = px + 2
    big = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big.paste(im, (pad, pad))
    mask = big.getchannel('A').point(lambda v: 255 if v > 8 else 0).filter(ImageFilter.MaxFilter(2 * px + 1)).filter(ImageFilter.GaussianBlur(1))
    white = Image.new('RGBA', big.size, (246, 244, 236, 255))
    white.putalpha(mask)
    white.alpha_composite(big)
    return white

def main(srcs):
    ART.mkdir(parents=True, exist_ok=True)
    out = []
    for src in srcs:
        for cat_dir in sorted(p for p in Path(src).rglob('*') if p.is_dir() and p.name in SERIES):
            for f in sorted(cat_dir.iterdir()):
                if f.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
                im = Image.open(f)
                im = im.convert('RGBA') if 'A' in im.getbands() else remove_background(im)
                bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
                if bbox: im = im.crop(bbox)
                im.thumbnail((MAX - 24, MAX - 24), Image.LANCZOS)
                im = with_outline(im)
                raw = FIX.get(f.stem.lower(), f.stem.lower()).strip()
                sid = f'{cat_dir.name}-{slug(raw)}'
                im.save(ART / f'{sid}.webp', 'WEBP', quality=80, method=4)
                out.append({'id': sid, 'name': raw[:1].upper() + raw[1:], 'series': cat_dir.name})
    ts = ["/** Stickers de l'utilisatrice, générés par scripts/import-stickers.py. */",
          'export interface MineDef { id: string; name: string; series: string }', '',
          'export const MINE_SERIES = ' + json.dumps([{'id': k, 'name': v} for k, v in SERIES.items()], ensure_ascii=False, indent=2) + ' as const', '',
          'export const MINE: MineDef[] = ' + json.dumps(out, ensure_ascii=False, indent=2), '']
    (ROOT / 'src/stickers/mine.ts').write_text('\n'.join(ts))
    print(len(out), 'stickers')

main(sys.argv[1:])
