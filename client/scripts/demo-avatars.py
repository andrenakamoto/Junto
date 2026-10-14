#!/usr/bin/env python3
# Avatars dessinés des personnes fictives de la démo (public/demo/avatars/<pseudo>.svg) : pas de vrais visages.
# python3 client/scripts/demo-avatars.py   (depuis la racine du repo)
# Deux personnes gardent leurs initiales (paul_r, max_g), pour montrer les deux cas.
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'demo', 'avatars')
os.makedirs(OUT, exist_ok=True)

SKIN = ['#f5d0b5', '#e8b48f', '#c98e66', '#8d5a3b', '#f1c6a6', '#b97a52']
HAIR = ['#2b1d14', '#5a3a22', '#a0672e', '#d9a441', '#1f1f24', '#7a2e1f', '#8a8a8a']
BG = ['#fde2d4', '#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#fce7f3', '#cffafe', '#fee2e2']
SHIRT = ['#ea5a2b', '#2563eb', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#ca8a04', '#334155']

# pseudo : (peau, cheveux, fond, haut, coiffure, lunettes)
PEOPLE = {
    'alex': (0, 1, 0, 0, 'short', False), 'lea_m': (4, 3, 5, 5, 'long', False), 'tom_b': (1, 0, 1, 1, 'curly', False),
    'chloe_s': (0, 5, 4, 3, 'bun', True), 'emma_v': (2, 2, 3, 6, 'long', False), 'lucas_d': (5, 4, 2, 2, 'short', True),
    'noah_p': (3, 4, 6, 4, 'curly', False), 'julie_r': (4, 1, 7, 7, 'bob', False), 'sarah_k': (2, 0, 2, 5, 'long', True),
    'marc_l': (0, 6, 1, 7, 'bald', True), 'ines_b': (5, 0, 4, 0, 'bun', False), 'karim_a': (3, 0, 3, 1, 'short', False),
    'nadia_f': (1, 5, 6, 3, 'bob', False), 'zoe_m': (4, 2, 0, 4, 'long', False),
}

def hair(style, c):
    if style == 'short':
        return f'<path d="M30 52c0-20 14-32 34-32s34 12 34 32c-6-8-18-12-34-12s-28 4-34 12z" fill="{c}"/>'
    if style == 'long':
        return (f'<path d="M26 58c0-24 16-38 38-38s38 14 38 38v34c-6 4-12 4-16 0V60c-6-8-14-12-22-12s-16 4-22 12v32c-4 4-10 4-16 0z" fill="{c}"/>')
    if style == 'curly':
        return ''.join(f'<circle cx="{x}" cy="{y}" r="10" fill="{c}"/>' for x, y in [(38, 40), (50, 30), (64, 27), (78, 30), (90, 40), (32, 52), (96, 52)])
    if style == 'bun':
        return (f'<circle cx="64" cy="20" r="11" fill="{c}"/>'
                f'<path d="M30 54c0-20 14-32 34-32s34 12 34 32c-8-10-20-14-34-14s-26 4-34 14z" fill="{c}"/>')
    if style == 'bob':
        return f'<path d="M28 60c0-24 15-38 36-38s36 14 36 38v14c-4 2-8 2-10 0V58c-8-8-16-12-26-12s-18 4-26 12v16c-2 2-6 2-10 0z" fill="{c}"/>'
    return ''  # bald

for pseudo, (s, h, b, sh, style, glasses) in PEOPLE.items():
    skin, hc, bg, shirt = SKIN[s], HAIR[h], BG[b], SHIRT[sh]
    g = ('<g fill="none" stroke="#1f2937" stroke-width="2.5"><circle cx="52" cy="60" r="8"/><circle cx="76" cy="60" r="8"/>'
         '<path d="M60 60h8"/></g>') if glasses else ''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<rect width="128" height="128" fill="{bg}"/>
<path d="M18 128c4-26 22-38 46-38s42 12 46 38z" fill="{shirt}"/>
<rect x="56" y="78" width="16" height="16" rx="6" fill="{skin}"/>
<ellipse cx="64" cy="58" rx="26" ry="29" fill="{skin}"/>
{hair(style, hc)}
<circle cx="52" cy="60" r="3" fill="#1f2937"/><circle cx="76" cy="60" r="3" fill="#1f2937"/>
{g}
<path d="M54 73c6 6 14 6 20 0" fill="none" stroke="#7c2d12" stroke-width="3" stroke-linecap="round"/>
<circle cx="45" cy="70" r="4" fill="#f87171" opacity=".25"/><circle cx="83" cy="70" r="4" fill="#f87171" opacity=".25"/>
</svg>
'''
    with open(os.path.join(OUT, f'{pseudo}.svg'), 'w') as f:
        f.write(svg)
print(f'{len(PEOPLE)} avatars → {OUT}')
