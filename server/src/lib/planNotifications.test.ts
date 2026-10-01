import { describe, expect, it } from 'vitest';
import { activityText, membershipText, rsvpChange } from './planNotifications';
import { parseNotificationChannel, wantsEmail, wantsPush } from './notificationPrefs';
import { pushContent } from './push';

describe('rsvpChange', () => {
  it('signale un désistement et un retour', () => {
    expect(rsvpChange('in', 'out')).toBe('leave');
    expect(rsvpChange('maybe', 'out')).toBe('leave');
    expect(rsvpChange('out', 'in')).toBe('back');
    expect(rsvpChange('out', 'maybe')).toBe('back');
  });

  it('ignore les changements entre « in » et « peut-être » et les réponses inchangées', () => {
    expect(rsvpChange('in', 'maybe')).toBeNull();
    expect(rsvpChange('maybe', 'in')).toBeNull();
    expect(rsvpChange('out', 'out')).toBeNull();
    expect(rsvpChange('in', 'in')).toBeNull();
  });
});

describe('notification de participation', () => {
  it('ouvre le Plan et regroupe les arrivées / départs', () => {
    const c = pushContent({ type: 'plan_member', planId: 'p1', planTitle: 'Raclette', from: 'julie', preview: membershipText('join', 'julie') });
    expect(c).toEqual({ title: 'Raclette', body: '@julie a rejoint le Plan', url: '/dashboard?planId=p1', group: 'members:p1' });
    expect(membershipText('leave', 'tom')).toBe('@tom ne vient plus');
  });
});

describe("notification d'activité", () => {
  it('décrit l’activité sans contenu saisi par les membres', () => {
    expect(activityText('photo_added', 'julie')).toBe('@julie a ajouté une photo');
    expect(activityText('expense_added', 'tom')).toBe('@tom a ajouté une dépense');
    const c = pushContent({ type: 'plan_activity', planId: 'p1', planTitle: 'Raclette', preview: activityText('ride_offered', 'léa') });
    expect(c?.body).toBe('@léa propose un trajet en voiture');
    expect(c?.group).toBe('activity:p1');
  });
});

describe('canal des notifications', () => {
  it('push / email / les deux', () => {
    expect([wantsPush('push'), wantsEmail('push')]).toEqual([true, false]);
    expect([wantsPush('email'), wantsEmail('email')]).toEqual([false, true]);
    expect([wantsPush('both'), wantsEmail('both')]).toEqual([true, true]);
    expect(parseNotificationChannel('both')).toBe('both');
    expect(parseNotificationChannel('sms')).toBeNull();
  });
});
