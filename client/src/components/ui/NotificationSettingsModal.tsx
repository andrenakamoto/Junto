import { useEffect, useState } from 'react';
import { useMutes } from '../../contexts/MuteContext';
import { Bell, Mail, Smartphone, BellOff } from 'lucide-react';
import { Modal } from './Modal';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { NotificationChannel } from '../../types';
import { t } from '../../i18n';

interface Props {
  onClose: () => void;
}

// Canal des notifications (serveur : lib/notificationPrefs.ts)
const CHANNELS: { value: NotificationChannel; label: string; hint: string; icon: typeof Bell }[] = ([
  ['push', Smartphone], ['both', Bell], ['email', Mail],
] as const).map(([value, icon]) => ({ value, icon, label: t(`account.notifications.${value}.label`), hint: t(`account.notifications.${value}.hint`) }));

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
    <Modal title={t('account.notifications.title')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-800 mb-2">{t('account.notifications.receive')}</p>
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
                  ? t('account.notifications.noDevicePush')
                  : t('account.notifications.noDevice')
                : t('account.notifications.devices', { count: devices })}
            </p>
          )}
          {channel !== 'push' && !emailUsable && (
            <p className="text-xs text-amber-600 mt-1">{t('account.notifications.needEmail')}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{t('account.notifications.digest')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('account.notifications.digestHint')}</p>
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
            <p className="text-sm font-medium text-slate-800">{t('account.notifications.recap')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('account.notifications.recapHint')}</p>
          </div>
          <button
            onClick={() => save({ recapEmailEnabled: !user?.recapEmailEnabled })}
            disabled={loading || !user?.email}
            role="switch"
            aria-checked={!!user?.recapEmailEnabled}
            aria-label={t('account.notifications.recap')}
            className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${user?.recapEmailEnabled ? 'bg-indigo-600' : 'bg-slate-300'} disabled:opacity-40`}
          >
            <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full transition-transform ${user?.recapEmailEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Mode silencieux : Plans et Cercles en silence, à réactiver d'ici */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5"><BellOff size={14} className="text-slate-500" /> {t('account.notifications.muted')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t('account.notifications.mutedHint')}</p>
          {mutedCircles.length + mutedPlans.length === 0 ? (
            <p className="text-xs text-slate-400 italic mt-2">{t('account.notifications.nothingMuted')}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {mutedCircles.map(c => (
                <li key={'c' + c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><span className="text-xs text-slate-400 mr-1">{t('account.notifications.circle')}</span>{c.name}</span>
                  <button onClick={() => setCircleMuted({ id: c.id, name: c.name ?? '' }, false)} className="flex-shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">{t('account.notifications.unmute')}</button>
                </li>
              ))}
              {mutedPlans.map(p => (
                <li key={'p' + p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><span className="text-xs text-slate-400 mr-1">{t('account.notifications.plan')}</span>{p.title}</span>
                  <button onClick={() => setPlanMuted({ id: p.id, title: p.title ?? '' }, false)} className="flex-shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">{t('account.notifications.unmute')}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-slate-400">
          {t('account.notifications.footer')}
        </p>
      </div>
    </Modal>
  );
}
