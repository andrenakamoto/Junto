# Photos des Cercles de la démo : illustrations 1200 × 600 (format 2:1 des photos de Cercle), sans texte.
# Lancer : python3 client/scripts/demo-circles.py → client/public/demo/circles/<code>.svg
import os, random

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'demo', 'circles')
W, H = 1200, 600

def svg(body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>{defs}</defs>{body}</svg>'

def grad(id, c1, c2, vertical=True):
    xy = 'x1="0" y1="0" x2="0" y2="1"' if vertical else 'x1="0" y1="0" x2="1" y2="0"'
    return f'<linearGradient id="{id}" {xy}><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>'

def bunting(y0, sag, colors, x0=-20, x1=1220, n=16):
    out = [f'<path d="M{x0},{y0} Q600,{y0+sag*2} {x1},{y0}" fill="none" stroke="#334155" stroke-width="3"/>']
    for i in range(n):
        t = (i + 0.5) / n
        x = (1-t)**2*x0 + 2*(1-t)*t*600 + t**2*x1
        y = (1-t)**2*y0 + 2*(1-t)*t*(y0+sag*2) + t**2*y0
        c = colors[i % len(colors)]
        out.append(f'<polygon points="{x-22:.0f},{y:.0f} {x+22:.0f},{y:.0f} {x:.0f},{y+42:.0f}" fill="{c}"/>')
    return ''.join(out)

def stars(n, seed, ymax):
    r = random.Random(seed)
    return ''.join(f'<circle cx="{r.randint(0,W)}" cy="{r.randint(0,ymax)}" r="{r.choice([1.5,2,2.5,3])}" fill="#fff" opacity="{r.choice([0.5,0.7,0.9])}"/>' for _ in range(n))

def person(x, y, s, color):
    # silhouette simple : tête + épaules
    return (f'<circle cx="{x}" cy="{y}" r="{18*s}" fill="{color}"/>'
            f'<path d="M{x-34*s},{y+70*s} Q{x-34*s},{y+22*s} {x},{y+22*s} Q{x+34*s},{y+22*s} {x+34*s},{y+70*s} Z" fill="{color}"/>')

# 1. Studio Danse Arc-en-Ciel : salle de danse, miroirs, barre, boule à facettes, couple qui danse
def village():
    d = grad('bg', '#7dd3fc', '#fef3c7') + grad('gravel', '#d6c7a1', '#a8977a')
    b = ['<rect width="1200" height="600" fill="url(#bg)"/>', '<circle cx="980" cy="120" r="55" fill="#fde047"/>']
    b.append('<polygon points="0,330 180,170 330,300 520,140 720,310 900,190 1200,330 1200,600 0,600" fill="#a5b4fc"/>')
    b.append('<polygon points="520,140 560,175 500,180" fill="#fff"/><polygon points="180,170 215,200 150,198" fill="#fff"/><polygon points="900,190 935,220 868,218" fill="#fff"/>')
    b.append('<path d="M0,380 Q300,300 600,370 T1200,350 L1200,600 L0,600 Z" fill="#4ade80"/>')
    b.append('<path d="M0,440 Q350,390 700,440 T1200,430 L1200,600 L0,600 Z" fill="#16a34a"/>')
    houses = [(180, 345, 90, '#fde68a'), (290, 355, 80, '#fecaca'), (720, 350, 95, '#fef9c3'), (840, 360, 85, '#fed7aa'), (950, 350, 90, '#e0f2fe')]
    for x, y, w, col in houses:
        b.append(f'<rect x="{x}" y="{y}" width="{w}" height="70" fill="{col}"/>')
        b.append(f'<polygon points="{x-10},{y} {x+w/2},{y-45} {x+w+10},{y}" fill="#b45309"/>')
        b.append(f'<rect x="{x+15}" y="{y+18}" width="18" height="18" fill="#475569"/><rect x="{x+w-33}" y="{y+18}" width="18" height="18" fill="#475569"/>')
    b.append('<rect x="480" y="300" width="110" height="125" fill="#f8fafc"/>')
    b.append('<rect x="505" y="190" width="60" height="110" fill="#f1f5f9"/>')
    b.append('<polygon points="500,190 535,95 570,190" fill="#475569"/>')
    b.append('<circle cx="535" cy="230" r="14" fill="#fbbf24"/><rect x="520" y="370" width="30" height="55" rx="15" fill="#78350f"/>')
    b.append('<polygon points="470,300 535,255 600,300" fill="#64748b"/>')
    b.append('<rect y="500" width="1200" height="100" fill="url(#gravel)"/>')
    for x, y, r, col in [(470, 545, 26, '#94a3b8'), (540, 560, 26, '#64748b'), (640, 548, 26, '#94a3b8'), (590, 530, 9, '#ef4444')]:
        b.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}"/><circle cx="{x-r*0.35}" cy="{y-r*0.35}" r="{r*0.3}" fill="#fff" opacity="0.5"/>')
    b.append(bunting(20, 40, ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#f97316']))
    return svg(''.join(b), d)

# 4. Best collègues : afterwork sur une terrasse au coucher du soleil, ville, verres qui trinquent
def collegues():
    d = grad('bg', '#1e3a8a', '#fb923c') + grad('beer', '#fbbf24', '#d97706')
    b = ['<rect width="1200" height="600" fill="url(#bg)"/>']
    r = random.Random(4)
    x = 0
    while x < 1200:
        w = r.randint(60, 120); h = r.randint(140, 320)
        b.append(f'<rect x="{x}" y="{430-h}" width="{w}" height="{h+20}" fill="#1e293b"/>')
        for wy in range(430-h+20, 420, 30):
            for wx in range(x+12, x+w-15, 24):
                if r.random() < 0.45:
                    b.append(f'<rect x="{wx}" y="{wy}" width="10" height="14" fill="#fde68a" opacity="0.85"/>')
        x += w + r.randint(4, 14)
    b.append('<rect y="440" width="1200" height="160" fill="#334155"/>')
    b.append('<rect y="430" width="1200" height="14" fill="#94a3b8"/>')
    for gx, rot in [(520, 12), (680, -12)]:
        b.append(f'<g transform="rotate({rot} {gx} 420)">'
                 f'<path d="M{gx-55},280 L{gx+55},280 L{gx+48},470 Q{gx},485 {gx-48},470 Z" fill="url(#beer)" opacity="0.95"/>'
                 f'<path d="M{gx-60},285 Q{gx-40},245 {gx-10},262 Q{gx+15},235 {gx+35},258 Q{gx+60},245 {gx+62},285 Z" fill="#fff"/>'
                 f'<path d="M{gx+52},320 Q{gx+100},325 {gx+95},380 Q{gx+92},420 {gx+50},420" stroke="#fef3c7" stroke-width="14" fill="none" opacity="0.8"/>'
                 f'<circle cx="{gx-15}" cy="380" r="5" fill="#fff" opacity="0.6"/><circle cx="{gx+10}" cy="340" r="4" fill="#fff" opacity="0.6"/></g>')
    import math
    for a in (-150, -120, -90, -60, -30):  # éclat du « santé ! »
        c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
        b.append(f'<line x1="{600+c*45:.0f}" y1="{235+s_*45:.0f}" x2="{600+c*80:.0f}" y2="{235+s_*80:.0f}" stroke="#fef9c3" stroke-width="6" stroke-linecap="round"/>')
    return svg(''.join(b), d)

# 5. Famille Rochat : maison, grand arbre, table dressée avec gâteau d'anniversaire
def famille():
    d = grad('bg', '#bae6fd', '#fef9c3')
    b = ['<rect width="1200" height="600" fill="url(#bg)"/>', '<circle cx="1050" cy="100" r="50" fill="#fde047"/>']
    b.append('<path d="M0,400 Q600,340 1200,400 L1200,600 L0,600 Z" fill="#86efac"/>')
    b.append('<rect x="90" y="210" width="300" height="220" fill="#fef3c7"/>')
    b.append('<polygon points="60,215 240,90 420,215" fill="#b91c1c"/>')
    b.append('<rect x="210" y="320" width="60" height="110" fill="#92400e"/><circle cx="258" cy="378" r="5" fill="#fde047"/>')
    for wx in (120, 310):
        b.append(f'<rect x="{wx}" y="260" width="55" height="55" fill="#7dd3fc" stroke="#f8fafc" stroke-width="6"/>')
    b.append('<rect x="290" y="120" width="35" height="60" fill="#78350f"/>')
    b.append('<rect x="960" y="270" width="40" height="190" fill="#78350f"/>')
    for cx, cy, rr in [(980, 220, 110), (900, 260, 80), (1065, 255, 85), (980, 150, 80)]:
        b.append(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="#15803d"/>')
    for ax, ay in [(930, 200), (1030, 180), (1000, 280), (900, 290), (1070, 260)]:
        b.append(f'<circle cx="{ax}" cy="{ay}" r="9" fill="#ef4444"/>')
    b.append('<rect x="480" y="440" width="380" height="18" fill="#f8fafc"/>')
    b.append('<path d="M480,458 L860,458 L850,500 L490,500 Z" fill="#fecaca"/>')
    for lx in (510, 830):
        b.append(f'<rect x="{lx}" y="500" width="14" height="70" fill="#92400e"/>')
    b.append('<rect x="610" y="370" width="120" height="70" rx="8" fill="#fbcfe8"/><rect x="610" y="395" width="120" height="12" fill="#f472b6"/>')
    for i in range(5):
        cx = 625 + i*22
        b.append(f'<rect x="{cx}" y="340" width="7" height="30" fill="#60a5fa"/><ellipse cx="{cx+3.5}" cy="332" rx="5" ry="9" fill="#f97316"/>')
    for gx in (520, 790):
        b.append(f'<path d="M{gx},400 L{gx+30},400 L{gx+25},440 L{gx+5},440 Z" fill="#e0f2fe" opacity="0.9"/>')
    for i, col in enumerate(['#f472b6', '#60a5fa', '#facc15']):
        bx = 470 + i*35
        b.append(f'<line x1="{bx}" y1="430" x2="{bx-10+i*10}" y2="250" stroke="#64748b" stroke-width="2"/><ellipse cx="{bx-10+i*10}" cy="220" rx="28" ry="36" fill="{col}"/>')
    return svg(''.join(b), d)

# 6. Les copains : chalet de nuit, montagnes enneigées, guirlande lumineuse
def copains():
    d = grad('bg', '#0b1026', '#312e81')
    b = ['<rect width="1200" height="600" fill="url(#bg)"/>', stars(90, 6, 300), '<circle cx="1000" cy="90" r="38" fill="#fef9c3"/><circle cx="1016" cy="80" r="34" fill="#1a1d47"/>']
    b.append('<polygon points="0,380 200,170 380,350 600,120 820,330 1000,190 1200,360 1200,600 0,600" fill="#475569"/>')
    for px, py in [(200, 170), (600, 120), (1000, 190)]:
        b.append(f'<polygon points="{px},{py} {px+60},{py+55} {px+25},{py+45} {px},{py+65} {px-25},{py+45} {px-60},{py+55}" fill="#f1f5f9"/>')
    b.append('<path d="M0,470 Q600,420 1200,470 L1200,600 L0,600 Z" fill="#e2e8f0"/>')
    for tx in (90, 160, 1040, 1120):
        b.append(f'<polygon points="{tx},330 {tx+40},470 {tx-40},470" fill="#14532d"/>')
    b.append('<rect x="420" y="320" width="360" height="160" fill="#92400e"/>')
    for ly in range(335, 480, 22):
        b.append(f'<line x1="420" y1="{ly}" x2="780" y2="{ly}" stroke="#78350f" stroke-width="3"/>')
    b.append('<polygon points="390,330 600,200 810,330" fill="#f8fafc"/><polygon points="405,332 600,215 795,332" fill="#7c2d12"/>')
    for wx in (455, 680):
        b.append(f'<rect x="{wx}" y="355" width="65" height="55" fill="#fbbf24"/><line x1="{wx+32}" y1="355" x2="{wx+32}" y2="410" stroke="#78350f" stroke-width="4"/>')
    b.append('<rect x="565" y="390" width="70" height="90" fill="#fcd34d"/>')
    b.append('<path d="M400,330 Q500,370 600,340 Q700,370 800,330" fill="none" stroke="#1e293b" stroke-width="2"/>')
    for i in range(14):
        t = i / 13
        x = 400 + t*400
        y = 330 + 25*abs(__import__('math').sin(t*3.14159*2)) + 8
        b.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="7" fill="{["#fde047", "#f97316", "#f472b6", "#22d3ee"][i % 4]}"/>')
    b.append('<rect x="700" y="230" width="30" height="60" fill="#57534e"/>')
    for sx, sy in [(715, 210), (725, 185), (712, 160)]:
        b.append(f'<circle cx="{sx}" cy="{sy}" r="12" fill="#cbd5e1" opacity="0.5"/>')
    return svg(''.join(b), d)

# 7. Team events : fête de village, scène éclairée, tentes, fanions, public
for code, fn in [('DEMO3X', village), ('DEMO4X', collegues), ('DEMO5X', famille), ('DEMO6X', copains)]:
    with open(os.path.join(OUT, f'{code}.svg'), 'w') as f:
        f.write(fn())
print('ok')
