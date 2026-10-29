import { useId } from 'react';

// Décor de Noël de la page /pere-noel (pages/SantaPage.tsx) : neige qui tombe, guirlande lumineuse, sapin décoré avec
// ses cadeaux, sol enneigé. Dessins en SVG, sans image à charger ; animations coupées si l'appareil demande moins de
// mouvement (prefers-reduced-motion).

// Positions fixes (pas d'aléatoire au rendu) : [gauche %, taille px, durée s, délai s, dérive px]
const FLAKES: [number, number, number, number, number][] = [
  [3, 4, 11, 0, 20], [8, 3, 14, 4, -15], [13, 5, 12, 2, 25], [19, 3, 16, 7, -20], [24, 4, 13, 1, 15], [29, 6, 15, 5, -25],
  [34, 3, 12, 9, 20], [39, 4, 17, 3, -10], [44, 5, 14, 6, 30], [49, 3, 11, 8, -20], [54, 4, 16, 0, 15], [59, 6, 13, 4, -30],
  [64, 3, 15, 2, 20], [69, 5, 12, 7, -15], [74, 4, 17, 5, 25], [79, 3, 14, 1, -20], [84, 6, 13, 9, 15], [89, 4, 16, 3, -25],
  [94, 3, 12, 6, 20], [97, 5, 15, 8, -10], [6, 3, 18, 10, 10], [37, 3, 18, 12, -10], [67, 3, 18, 11, 10], [91, 3, 18, 13, -10],
];

export function Snowfall({ count = FLAKES.length }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes evly-snow { from { transform: translate3d(0, -20px, 0); } to { transform: translate3d(var(--drift), 110vh, 0); } }
        .evly-flake { position: absolute; top: -10px; border-radius: 9999px; background: #fff; opacity: .75; animation: evly-snow linear infinite; }
        @keyframes evly-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .evly-bulb { animation: evly-twinkle 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .evly-flake { animation: none; top: var(--rest); } .evly-bulb { animation: none; } }
      `}</style>
      {FLAKES.slice(0, count).map(([x, size, dur, delay, drift], i) => (
        <span key={i} className="evly-flake" style={{
          left: `${x}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `-${delay}s`,
          ['--drift' as string]: `${drift}px`, ['--rest' as string]: `${(i * 37) % 90}%`,
        }} />
      ))}
    </div>
  );
}

// Guirlande lumineuse en haut de la bannière
const BULB_COLORS = ['#ef4444', '#facc15', '#22c55e', '#38bdf8', '#f97316'];
export function Garland() {
  const bulbs = Array.from({ length: 21 }, (_, i) => {
    const x = 20 + i * 48;
    const y = 18 + Math.sin((i / 20) * Math.PI * 4) * 9;
    return { x, y, color: BULB_COLORS[i % BULB_COLORS.length], delay: (i % 5) * 0.45 };
  });
  return (
    <svg aria-hidden viewBox="0 0 1000 44" preserveAspectRatio="none" className="absolute top-0 left-0 w-full h-9 sm:h-11">
      <path d={`M0 14 ${bulbs.map(b => `L${b.x} ${b.y - 6}`).join(' ')} L1000 14`} fill="none" stroke="#1f2937" strokeWidth="2" opacity=".7" />
      {bulbs.map((b, i) => (
        <g key={i}>
          <rect x={b.x - 2.5} y={b.y - 8} width="5" height="5" rx="1" fill="#374151" />
          <ellipse className="evly-bulb" cx={b.x} cy={b.y + 3} rx="5" ry="7.5" fill={b.color} style={{ animationDelay: `${b.delay}s` }} />
        </g>
      ))}
    </svg>
  );
}

// Sapin décoré, étoile et cadeaux au pied
export function TreeScene({ className = '' }: { className?: string }) {
  // Identifiants propres à chaque sapin : la page en a deux (grand écran, téléphone) et un dégradé d'un SVG masqué ne
  // s'affiche pas dans l'autre
  const id = useId().replace(/:/g, '');
  const ornaments: [number, number, string][] = [
    [160, 108, '#ef4444'], [132, 140, '#facc15'], [190, 150, '#38bdf8'], [118, 190, '#f97316'], [168, 200, '#ef4444'],
    [208, 205, '#facc15'], [100, 245, '#22d3ee'], [146, 250, '#facc15'], [196, 258, '#ef4444'], [232, 250, '#a78bfa'],
  ];
  return (
    <svg aria-hidden viewBox="0 0 320 360" className={className}>
      <defs>
        <linearGradient id={`${id}-tree`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#22c55e" /><stop offset="1" stopColor="#14532d" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}><stop offset="0" stopColor="#fde68a" stopOpacity=".55" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="160" cy="44" r="46" fill={`url(#${id}-glow)`} />
      {/* Sapin : trois étages */}
      <path d="M160 52 L222 140 L196 140 L248 210 L218 210 L276 292 L44 292 L102 210 L72 210 L124 140 L98 140 Z" fill={`url(#${id}-tree)`} />
      <path d="M118 150 Q160 168 210 146 M100 220 Q160 240 226 214" stroke="#fde68a" strokeWidth="3" fill="none" opacity=".8" strokeLinecap="round" />
      {/* Neige sur les branches */}
      <path d="M124 140 Q140 134 160 140 Q180 134 196 140 M102 210 Q130 202 160 210 Q190 202 218 210 M44 292 Q100 280 160 292 Q220 280 276 292" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".9" />
      {ornaments.map(([x, y, c], i) => <circle key={i} className="evly-bulb" cx={x} cy={y} r="7" fill={c} style={{ animationDelay: `${(i % 4) * 0.6}s` }} />)}
      {/* Étoile */}
      <path d="M160 18 L168 40 L191 40 L172 54 L179 77 L160 63 L141 77 L148 54 L129 40 L152 40 Z" fill="#facc15" stroke="#fde68a" strokeWidth="2" />
      <rect x="148" y="292" width="24" height="22" fill="#78350f" />
      {/* Cadeaux */}
      <g>
        <rect x="58" y="292" width="64" height="50" rx="4" fill="#dc2626" />
        <rect x="85" y="292" width="10" height="50" fill="#facc15" />
        <rect x="58" y="310" width="64" height="9" fill="#facc15" />
        <path d="M90 292 C74 274 64 290 90 292 C116 274 106 290 90 292" fill="none" stroke="#facc15" strokeWidth="5" />
      </g>
      <g>
        <rect x="190" y="300" width="56" height="42" rx="4" fill="#16a34a" />
        <rect x="213" y="300" width="9" height="42" fill="#ef4444" />
        <rect x="190" y="315" width="56" height="8" fill="#ef4444" />
        <path d="M217 300 C204 286 196 298 217 300 C238 286 230 298 217 300" fill="none" stroke="#ef4444" strokeWidth="4.5" />
      </g>
      <g>
        <rect x="128" y="314" width="56" height="28" rx="3" fill="#f8fafc" />
        <rect x="151" y="314" width="9" height="28" fill="#2563eb" />
        <path d="M155 314 C145 302 139 312 155 314 C171 302 165 312 155 314" fill="none" stroke="#2563eb" strokeWidth="4" />
      </g>
      <ellipse cx="160" cy="346" rx="150" ry="10" fill="#fff" opacity=".9" />
    </svg>
  );
}

// Sol enneigé en bas de la bannière, de la couleur du fond de la page, avec deux petits sapins
export function SnowGround({ fill = '#f8fafc' }: { fill?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-16 sm:h-24">
      <path d="M0 70 C180 30 320 90 520 60 C720 30 860 85 1060 55 C1240 30 1340 70 1440 50 L1440 120 L0 120 Z" fill={fill} opacity=".35" />
      <path d="M0 90 C200 60 380 110 600 85 C820 60 980 105 1200 80 C1320 68 1400 82 1440 78 L1440 120 L0 120 Z" fill={fill} />
    </svg>
  );
}
