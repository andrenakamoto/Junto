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
        <linearGradient id="estelle-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e879a4" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <filter id="estelle-glow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Fond arrondi */}
      <rect width="64" height="64" rx="15" fill="url(#estelle-bg)" />

      {/* Reflet subtil en haut */}
      <ellipse cx="32" cy="5" rx="26" ry="10" fill="white" opacity="0.07" />

      {/*
        Deux étriers superposés formant un E.
        Chaque étrier est un D-shape (ouverture à gauche, courbure à droite).
        Étrier du haut : barre en haut + arc droit + barre au milieu + barre gauche (Z)
        Étrier du bas  : barre au milieu + arc droit + barre en bas + barre gauche (Z)
        Les deux barres gauches forment le trait vertical du E.
      */}

      {/* Étrier du haut */}
      <path
        d="M 15 12 L 39 12 A 10 10 0 0 1 39 32 L 15 32 Z"
        stroke="white"
        strokeWidth="4"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#estelle-glow)"
      />

      {/* Étrier du bas */}
      <path
        d="M 15 32 L 39 32 A 10 10 0 0 1 39 52 L 15 52 Z"
        stroke="white"
        strokeWidth="4"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#estelle-glow)"
      />
    </svg>
  );
}

export function LogoFull({ iconSize = 32, className = '' }: { iconSize?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
      <span
        style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          fontWeight: 700,
          letterSpacing: '0.01em',
        }}
        className="text-white text-xl leading-none"
      >
        Estelle
      </span>
    </div>
  );
}
