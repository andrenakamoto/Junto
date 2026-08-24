interface WordmarkProps {
  size?: number;
  /** Pour une utilisation sur fond clair (par défaut : fond sombre, "Ev" en blanc) */
  light?: boolean;
  className?: string;
}

function Wordmark({ size = 40, light = false, className = '' }: WordmarkProps) {
  return (
    <span
      className={className}
      style={{ fontFamily: "'Fraunces', serif", fontSize: size, lineHeight: 1, whiteSpace: 'nowrap' }}
    >
      <span style={{ fontStyle: 'italic', fontWeight: 300, color: light ? '#1e293b' : '#ffffff' }}>Ev</span>
      <span style={{ fontWeight: 800, color: '#ea5a2b' }}>LY</span>
    </span>
  );
}

export function LogoIcon({ size = 40, light, className = '' }: WordmarkProps) {
  return <Wordmark size={size} light={light} className={className} />;
}

export function LogoFull({ iconSize = 32, light, className = '' }: { iconSize?: number; light?: boolean; className?: string }) {
  return <Wordmark size={iconSize} light={light} className={className} />;
}
