const colors = [
  'bg-indigo-500','bg-violet-500','bg-emerald-500','bg-rose-500',
  'bg-amber-500','bg-cyan-500','bg-pink-500','bg-teal-500',
];
const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' };

function pickColor(pseudo: string) {
  const s = pseudo.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[s % colors.length];
}

export function Avatar({ pseudo, size = 'md' }: { pseudo: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`${sizes[size]} ${pickColor(pseudo)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {pseudo[0].toUpperCase()}
    </div>
  );
}
