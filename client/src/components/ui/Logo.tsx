interface IconProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 40, className = '' }: IconProps) {
  return (
    <img
      src="/logo_estelle.png"
      width={size}
      height={size}
      style={{ objectFit: 'contain', borderRadius: '23%' }}
      className={className}
      alt="Estelle"
    />
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
