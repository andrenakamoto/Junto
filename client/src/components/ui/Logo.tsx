interface IconProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 40, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="junto-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>
        <filter id="junto-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Fond arrondi avec dégradé */}
      <rect width="64" height="64" rx="15" fill="url(#junto-bg)" />

      {/* Reflet subtil en haut */}
      <rect width="64" height="34" rx="15" fill="url(#junto-bg)" opacity="0" />
      <ellipse cx="32" cy="5" rx="26" ry="11" fill="white" opacity="0.07" />

      {/* Chemin J reliant les trois membres */}
      <path
        d="M20 19 H44 V41 Q44 53 32 53 Q19 53 19 45"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Membre 1 — gauche haut (rejoint) */}
      <circle cx="20" cy="19" r="6.5" fill="white" fillOpacity="0.5" />
      <circle cx="20" cy="19" r="3.5" fill="white" fillOpacity="0.5" />

      {/* Membre 2 — droite haut (admin / créateur) */}
      <circle cx="44" cy="19" r="7" fill="white" filter="url(#junto-glow)" />
      <circle cx="44" cy="19" r="4" fill="white" fillOpacity="0.6" />

      {/* Membre 3 — gauche bas (ancré) */}
      <circle cx="19" cy="45" r="6.5" fill="white" fillOpacity="0.7" />
      <circle cx="19" cy="45" r="3.5" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

export function LogoFull({ iconSize = 32, className = '' }: { iconSize?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
      <span
        style={{ fontWeight: 900, letterSpacing: '-0.03em' }}
        className="text-white text-xl leading-none"
      >
        Estelle
      </span>
    </div>
  );
}
