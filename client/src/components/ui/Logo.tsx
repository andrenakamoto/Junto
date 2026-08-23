interface IconProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 40, className = '' }: IconProps) {
  return (
    <img
      src="/logo-evly.svg"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      className={className}
      alt="EvLY"
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
        EvLY
      </span>
    </div>
  );
}
