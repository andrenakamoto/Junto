import { describe, it, expect } from 'vitest';
import { unseenSections } from './planActivity';

describe('onglets non vus', () => {
  const t = (iso: string) => new Date(iso);
  const activities = [
    { section: 'chat', at: t('2026-10-01T10:00:00Z') },
    { section: 'depenses', at: t('2026-10-01T09:00:00Z') },
    { section: 'infos', at: t('2026-10-01T08:00:00Z') },
  ];

  it('signale les onglets modifiés depuis la dernière visite, ou jamais visités', () => {
    const seen = { chat: '2026-10-01T09:30:00Z', depenses: '2026-10-01T09:30:00Z' };
    expect(unseenSections(activities, seen)).toEqual(['chat', 'infos']);
  });

  it('rien à signaler si tout a été vu après la dernière activité', () => {
    const seen = { chat: '2026-10-01T11:00:00Z', depenses: '2026-10-01T11:00:00Z', infos: '2026-10-01T11:00:00Z' };
    expect(unseenSections(activities, seen)).toEqual([]);
  });

  it('ignore une section inconnue', () => {
    expect(unseenSections([{ section: 'autre', at: t('2026-10-01T10:00:00Z') }], {})).toEqual([]);
  });
});
