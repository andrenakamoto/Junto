import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileModal } from './ProfileModal';

// Comptes créés avant l'ajout du prénom : on leur demande de le compléter
export function ProfileNameBanner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || user.firstName) return null;

  return (
    <>
      <div className="bg-indigo-500/10 border-b border-indigo-500/30 px-4 py-3 text-sm flex items-center gap-3">
        <UserRound size={15} className="text-indigo-400 flex-shrink-0" />
        <span className="text-indigo-300 flex-1">
          Ajoute ton prénom pour que les membres de tes Cercles te reconnaissent.
        </span>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex-shrink-0"
        >
          Ajouter
        </button>
      </div>
      {open && <ProfileModal onClose={() => setOpen(false)} />}
    </>
  );
}
