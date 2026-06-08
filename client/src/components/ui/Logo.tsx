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

        {/* Dégradé métal argenté vertical */}
        <linearGradient id="metal-v" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#f5f5f5" />
          <stop offset="35%"  stopColor="#d8d8d8" />
          <stop offset="65%"  stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#888888" />
        </linearGradient>

        {/* Halo rose autour des fers */}
        <filter id="horse-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="#e879a4" floodOpacity="0.9" />
        </filter>
      </defs>

      {/* Fond arrondi dégradé */}
      <rect width="64" height="64" rx="15" fill="url(#estelle-bg)" />
      <ellipse cx="32" cy="5" rx="26" ry="10" fill="white" opacity="0.07" />

      {/*
        Fer à cheval du haut :
          - arc (courbure) sur la GAUCHE
          - deux bras s'étendant à DROITE
          - extrémités carrées (strokeLinecap="square")
          Trace : bras droit haut → arc gauche CCW → bras droit bas
      */}
      <path
        d="M 47 12 L 27 12 A 10 10 0 0 0 27 32 L 47 32"
        stroke="url(#metal-v)"
        strokeWidth="5.5"
        strokeLinecap="square"
        fill="none"
        filter="url(#horse-glow)"
      />

      {/*
        Fer à cheval du bas :
          Même principe, positionné juste en dessous.
          Les deux bras hauts se rejoignent au centre → barre du milieu du E.
      */}
      <path
        d="M 47 32 L 27 32 A 10 10 0 0 0 27 52 L 47 52"
        stroke="url(#metal-v)"
        strokeWidth="5.5"
        strokeLinecap="square"
        fill="none"
        filter="url(#horse-glow)"
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
