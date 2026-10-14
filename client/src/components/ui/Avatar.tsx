import { useState } from 'react';
import { usePhotos } from '../../contexts/PhotosContext';
import { photoUrl } from '../../lib/photos';
import type { Person } from './PersonSheet';

const colors = [
  'bg-indigo-500','bg-violet-500','bg-emerald-500','bg-rose-500',
  'bg-amber-500','bg-cyan-500','bg-pink-500','bg-teal-500',
];
const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base', xl: 'w-12 h-12 text-lg', xxl: 'w-40 h-40 text-6xl' };

function pickColor(pseudo: string) {
  const s = pseudo.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[s % colors.length];
}

// Rond d'une personne : sa photo de profil si elle en a une (PhotosContext), sinon l'initiale sur une couleur.
// `person` : toucher l'avatar ouvre la fiche de la personne (grande photo, « Signaler la photo »).
// `noPhoto` : initiale seulement (ex. lettre d'un Cercle sans photo).
export function Avatar({ pseudo, size = 'md', online, person, noPhoto }: {
  pseudo: string; size?: keyof typeof sizes; online?: boolean; person?: Person; noPhoto?: boolean;
}) {
  const { avatarOf, openPerson } = usePhotos();
  const [broken, setBroken] = useState<string | null>(null);
  const key = noPhoto ? null : avatarOf(pseudo);
  const showPhoto = key && broken !== key;
  const inner = (
    <div className={`${sizes[size]} ${showPhoto ? 'bg-slate-200' : pickColor(pseudo)} rounded-full flex items-center justify-center text-white font-bold overflow-hidden`}>
      {showPhoto
        ? <img src={photoUrl(key, size !== 'xxl')} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => setBroken(key)} />
        : pseudo[0].toUpperCase()}
    </div>
  );
  return (
    <div className="relative flex-shrink-0">
      {person ? (
        // Dans un élément parfois lui-même cliquable : « role=button » plutôt qu'un bouton imbriqué
        <span role="button" tabIndex={0} className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          onClick={e => { e.stopPropagation(); openPerson(person); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openPerson(person); } }}>
          {inner}
        </span>
      ) : inner}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 ${size === 'xl' ? 'w-3 h-3' : 'w-2.5 h-2.5'} rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
          title={online ? 'En ligne' : 'Hors ligne'}
        />
      )}
    </div>
  );
}
