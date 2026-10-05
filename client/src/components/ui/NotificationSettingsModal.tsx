import { useEffect, useState } from 'react';
import { useMutes } from '../../contexts/MuteContext';
import { Bell, Mail, Smartphone, BellOff } from 'lucide-react';
import { Modal } from './Modal';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { NotificationChannel } from '../../types';

interface Props {
  onClose: () => void;
}

// Canal des notifications (serveur : lib/notificationPrefs.ts)
const CHANNELS: { value: NotificationChannel; label: string; hint: string; icon: typeof Bell }[] = [
  { value: 'push', label: 'Notifications push', hint: 'Sur ton téléphone, avec l\'app EvLY. Aucun email de notification.', icon: Smartphone },
  { value: 'both', label: 'Push + email', hint: 'Sur ton téléphone, et les emails habituels (nouveau Plan, mentions, rappels…).', icon: Bell },
  { value: 'email', label: 'Email uniquement', hint: 'Les emails habituels, pas de notifications sur le téléphone.', icon: Mail },
];

export function NotificationSettingsModal({ onClose }: Props) {
  const { mutedPlans, mutedCircles, setPlanMuted, setCircleMuted } = useMutes();
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<number | null>(null);

  useEffect(() => {
    api.get('/push/devices').then(res => setDevices(res.data.count)).catch(() => {});
  }, []);

  async function save(changes: { weeklyDigestEnabled?: boolean; recapEmailEnabled?: boolean; notificationChannel?: NotificationChannel }) {
    if (!user || loading) return;
    setLoading(true);
    try {
      const { data } = await api.put('/auth/notification-settings', changes);
      setUser(data);
    } finally {
      setLoading(false);
    }
  }

  const channel = user?.notificationChannel ?? 'both';
  const emailUsable = !!user?.email && !!user?.emailVerified;

  return (
    <Modal title="Notifications" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-800 mb-2">Recevoir les notifications</p>
          <div className="space-y-2" role="radiogroup">
            {CHANNELS.map(({ value, label, hint, icon: Icon }) => {
              const selected = channel === value;
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={selected}
                  disabled={loading}
                  onClick={() => !selected && save({ notificationChannel: value })}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                >
                  <Icon size={18} className={`mt-0.5 flex-shrink-0 ${selected ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>
                  </span>
                  <span className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected ? 'border-indigo-600 bg-indigo-600 ring-2 ring-inset ring-white' : 'border-slate-300'}`} />
                </button>
              );
            })}
          </div>
          {devices !== null && (
            <p className={`text-xs mt-2 ${devices === 0 && channel === 'push' ? 'text-amber-600' : 'text-slate-400'}`}>
              {devices === 0
                ? channel === 'push'
                  ? 'Aucun téléphone ne reçoit encore tes notifications push : installe l\'app EvLY et connecte-toi, sinon tu ne seras prévenu(e) de rien.'
                  : 'Aucun téléphone enregistré : les notifications push arrivent sur ceux où tu es connecté(e) à l\'app EvLY.'
                : `${devices} téléphone${devices > 1 ? 's reçoivent' : ' reçoit'} tes notifications push.`}
            </p>
          )}
          {channel !== 'push' && !emailUsable && (
            <p className="text-xs text-amber-600 mt-1">Ajoute et valide un email à ton compte pour recevoir les emails.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Résumé hebdomadaire</p>
            <p className="text-xs text-slate-500 mt-0.5">Un email chaque lundi avec les Plans actifs de tes Cercles.</p>
          </div>
          <button
            onClick={() => save({ weeklyDigestEnabled: !user?.weeklyDigestEnabled })}
            disabled={loading || !user?.email}
            className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${user?.weeklyDigestEnabled ? 'bg-indigo-600' : 'bg-slate-300'} disabled:opacity-40`}
          >
            <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full transition-transform ${user?.weeklyDigestEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Récapitulatif PDF avant la suppression des Plans gérés (serveur : lib/planRecap.ts) */}
        <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Récapitulatif avant suppression</p>
            <p className="text-xs text-slate-500 mt-0.5">Pour les Plans que tu gères (créateur du Plan, organisateur du Cercle) : un PDF par email juste avant leur suppression automatique. Infos, participants, bénévoles, dépenses.</p>
          </div>
          <button
            onClick={() => save({ recapEmailEnabled: !user?.recapEmailEnabled })}
            disabled={loading || !user?.email}
            role="switch"
            aria-checked={!!user?.recapEmailEnabled}
            aria-label="Récapitulatif avant suppression"
            className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${user?.recapEmailEnabled ? 'bg-indigo-600' : 'bg-slate-300'} disabled:opacity-40`}
          >
            <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full transition-transform ${user?.recapEmailEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Mode silencieux : Plans et Cercles en silence, à réactiver d'ici */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5"><BellOff size={14} className="text-slate-500" /> En silence</p>
          <p className="text-xs text-slate-500 mt-0.5">Ni notification ni email (sauf si on te mentionne). Les points orange restent dans l’app. La cloche 🔔 sur un Plan ou un Cercle les met en silence.</p>
          {mutedCircles.length + mutedPlans.length === 0 ? (
            <p className="text-xs text-slate-400 italic mt-2">Rien n’est en silence.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {mutedCircles.map(c => (
                <li key={'c' + c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><span className="text-xs text-slate-400 mr-1">Cercle</span>{c.name}</span>
                  <button onClick={() => setCircleMuted({ id: c.id, name: c.name ?? '' }, false)} className="flex-shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">Réactiver</button>
                </li>
              ))}
              {mutedPlans.map(p => (
                <li key={'p' + p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><span className="text-xs text-slate-400 mr-1">Plan</span>{p.title}</span>
                  <button onClick={() => setPlanMuted({ id: p.id, title: p.title ?? '' }, false)} className="flex-shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">Réactiver</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Les emails indispensables (validation du compte, mot de passe, résumé des dépenses à la fin
          d'un Plan) sont toujours envoyés. Les notifications push ne contiennent jamais le texte des messages.
        </p>
      </div>
    </Modal>
  );
}
