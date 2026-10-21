import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Search, X } from 'lucide-react';
import { Contact } from '../../types';
import api from '../../services/api';
import { t } from '../../i18n';
import { Avatar } from '../ui/Avatar';
import { usePhotos } from '../../contexts/PhotosContext';

// Recherche sans accents ni majuscules (comme la recherche des Cercles)
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// « Mes contacts » : toutes les personnes avec qui on partage un Cercle, avec leurs Cercles en commun.
// Toucher une personne ouvre sa fiche (Cercles et Plans en commun, inviter, organiser un Plan) ;
// toucher un Cercle l'ouvre.
export function ContactsView({ onBack, onOpenCircle, refreshSignal }: {
  onBack: () => void; onOpenCircle: (circleId: string) => void; refreshSignal?: number;
}) {
  const { openPerson } = usePhotos();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/contacts').then(res => setContacts(res.data)).catch(() => setContacts(c => c ?? []));
  }, [refreshSignal]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!contacts || !q) return contacts ?? [];
    return contacts.filter(c => fold(`${c.firstName ?? ''} ${c.pseudo}`).includes(q));
  }, [contacts, query]);

  return (
    <div className="w-full bg-slate-50 flex flex-col h-full flex-shrink-0 border-r border-slate-200 short:overflow-y-auto">
      <div className="px-4 py-4 border-b border-slate-200 flex items-center gap-2">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-bold text-slate-900 text-sm flex-1">{t('circle.contacts.title')}</h2>
        {contacts && contacts.length > 0 && (
          <span className="text-xs text-slate-400">{t('circle.contacts.count', { count: contacts.length })}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 short:flex-none short:overflow-visible">
        {contacts === null ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t('common.loading')}</div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-500 text-sm">{t('circle.contacts.empty')}</div>
        ) : (
          <>
            {contacts.length >= 5 && (
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('circle.contacts.search')}
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" aria-label={t('circle.sidebar.clearSearch')}>
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            {shown.length === 0 ? (
              <p className="text-center py-6 text-slate-500 text-sm">{t('circle.contacts.noMatch')}</p>
            ) : (
              <div className="space-y-2">
                {shown.map(c => (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                    <button
                      onClick={() => openPerson({ userId: c.id, pseudo: c.pseudo, firstName: c.firstName })}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <Avatar pseudo={c.pseudo} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.firstName || `@${c.pseudo}`}</p>
                        {c.firstName && <p className="text-xs text-slate-400 truncate">@{c.pseudo}</p>}
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-1.5 mt-2 pl-14">
                      {c.circles.map(circle => (
                        <button
                          key={circle.id}
                          onClick={() => onOpenCircle(circle.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-600 max-w-full"
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: circle.color || '#94a3b8' }} />
                          <span className="truncate">{circle.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
