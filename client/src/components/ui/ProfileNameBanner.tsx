import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileModal } from './ProfileModal';
import { useTranslation } from 'react-i18next';

// Comptes créés avant l'ajout du prénom : on leur demande de le compléter
export function ProfileNameBanner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  if (!user || user.firstName) return null;

  return (
    <>
      <div className="bg-indigo-500/10 border-b border-indigo-500/30 px-4 py-3 short:py-1.5 text-sm flex items-center gap-3">
        <UserRound size={15} className="text-indigo-600 flex-shrink-0" />
        <span className="text-indigo-600 flex-1">
          {t('ui.profileBanner.text')}
        </span>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex-shrink-0"
        >
          {t('ui.profileBanner.add')}
        </button>
      </div>
      {open && <ProfileModal onClose={() => setOpen(false)} />}
    </>
  );
}
