import { describe, expect, it } from 'vitest';
import { dueReminders, entryTotal, HISTORY_MAX, maskEntry, parseMoneyInput, parseStatus, parseSupplierInput, pushHistory, recordStep, useStatus } from './suppliers';

describe('parseSupplierInput', () => {
  it('accepte une fiche complète et nettoie email et site', () => {
    const r = parseSupplierInput({ name: ' Traiteur Dupont ', category: 'repas', email: 'Info@Dupont.CH', website: 'dupont.ch', phone: '+41 22 123 45 67' });
    expect(r).toMatchObject({ name: 'Traiteur Dupont', category: 'repas', email: 'info@dupont.ch', website: 'https://dupont.ch/', phone: '+41 22 123 45 67', contactName: null });
  });
  it('refuse un nom vide, une catégorie inconnue, un email ou un téléphone invalides', () => {
    expect(parseSupplierInput({ name: ' ', category: 'repas' })).toEqual({ error: 'Nom du fournisseur requis' });
    expect(parseSupplierInput({ name: 'X', category: 'fleurs' })).toEqual({ error: 'Catégorie invalide' });
    expect(parseSupplierInput({ name: 'X', category: 'repas', email: 'pas-un-email' })).toEqual({ error: 'Email invalide' });
    expect(parseSupplierInput({ name: 'X', category: 'repas', phone: 'appelle-moi' })).toEqual({ error: 'Téléphone invalide' });
    expect(parseSupplierInput({ name: 'X', category: 'repas', website: 'javascript:alert(1)' })).toEqual({ error: 'Site web invalide' });
  });
  it('refuse un objet à la place d’un texte', () => {
    expect(parseSupplierInput({ name: 'X', category: 'repas', notes: { not: '' } })).toEqual({ error: 'Notes invalide' });
  });
});

describe('parseMoneyInput', () => {
  it('lit les montants (virgule, apostrophes) et les échéances', () => {
    expect(parseMoneyInput({ currency: 'EUR', quoteAmount: "3'200,50", depositAmount: 1000, depositDue: '2026-12-01', balanceDue: '' }))
      .toEqual({ currency: 'EUR', quoteAmount: 3200.5, depositAmount: 1000, depositDue: '2026-12-01', balanceAmount: null, balanceDue: null });
  });
  it('refuse un montant négatif, une devise ou une date invalides', () => {
    expect(parseMoneyInput({ quoteAmount: -5 })).toEqual({ error: 'Montant invalide' });
    expect(parseMoneyInput({ currency: 'USD' })).toEqual({ error: 'Devise invalide' });
    expect(parseMoneyInput({ depositDue: '2026-02-30' })).toEqual({ error: 'Échéance invalide' });
  });
});

describe('statuts et étapes', () => {
  it('reconnaît les statuts', () => {
    expect(parseStatus('confirmed')).toBe('confirmed');
    expect(parseStatus('approved')).toBeNull();
    expect(parseStatus('dropped')).toBeNull();
  });
  it('garde la date et la personne de chaque étape', () => {
    const at = new Date('2026-11-06T10:00:00Z');
    const s = recordStep(recordStep({}, 'todo', 'marie', at), 'quote_requested', 'paul', at);
    expect(s).toEqual({ todo: { at: at.toISOString(), by: 'marie' }, quote_requested: { at: at.toISOString(), by: 'paul' } });
  });
});

describe('montants', () => {
  it('total = devis, sinon acompte + solde', () => {
    expect(entryTotal({ quoteAmount: 3200, depositAmount: 1000, balanceAmount: 2200 })).toBe(3200);
    expect(entryTotal({ quoteAmount: null, depositAmount: 1000, balanceAmount: 2200.4 })).toBe(3200.4);
    expect(entryTotal({ quoteAmount: null, depositAmount: null, balanceAmount: null })).toBeNull();
  });
  it('masque montants et documents pour qui n’est pas organisateur', () => {
    const e = { id: '1', status: 'confirmed', quoteAmount: 3200, depositAmount: 1000, depositDue: '2026-12-01', currency: 'CHF', documents: [{ id: 'd' }] };
    const masked = maskEntry(e, false) as any;
    expect(masked.quoteAmount).toBeUndefined();
    expect(masked.depositDue).toBeUndefined();
    expect(masked.currency).toBeUndefined();
    expect(masked.documents).toBeUndefined();
    expect(masked.documentCount).toBe(1);
    expect(masked.status).toBe('confirmed');
    expect(maskEntry(e, true)).toBe(e);
  });
});

describe('dueReminders', () => {
  const base = {
    status: 'confirmed', steps: {}, depositAmount: null, depositDue: null, depositPaidAt: null, depositReminderSentAt: null,
    balanceAmount: null, balanceDue: null, balancePaidAt: null, balanceReminderSentAt: null, followUpSentAt: null,
  };
  it('acompte à payer dans les 3 jours, pas avant, pas une fois payé ou passé', () => {
    expect(dueReminders({ ...base, depositAmount: 1000, depositDue: '2026-11-09' }, '2026-11-06')).toEqual(['deposit']);
    expect(dueReminders({ ...base, depositAmount: 1000, depositDue: '2026-11-10' }, '2026-11-06')).toEqual([]);
    expect(dueReminders({ ...base, depositAmount: 1000, depositDue: '2026-11-07', depositPaidAt: new Date() }, '2026-11-06')).toEqual([]);
    expect(dueReminders({ ...base, depositAmount: 1000, depositDue: '2026-11-05' }, '2026-11-06')).toEqual([]);
  });
  it('pas de rappel de paiement sans montant, ni pour un fournisseur mis de côté', () => {
    expect(dueReminders({ ...base, depositDue: '2026-11-07' }, '2026-11-06')).toEqual([]);
    expect(dueReminders({ ...base, onHold: true, balanceAmount: 5, balanceDue: '2026-11-07' }, '2026-11-06')).toEqual([]);
  });
  it('relance 7 jours après la demande de devis', () => {
    const now = new Date('2026-11-13T10:00:00Z');
    const asked = { quote_requested: { at: '2026-11-06T09:00:00Z', by: 'marie' } };
    expect(dueReminders({ ...base, status: 'quote_requested', steps: asked }, '2026-11-13', now)).toEqual(['followUp']);
    expect(dueReminders({ ...base, status: 'quote_requested', steps: asked }, '2026-11-12', new Date('2026-11-12T10:00:00Z'))).toEqual([]);
    expect(dueReminders({ ...base, status: 'quote_requested', steps: asked, followUpSentAt: now }, '2026-11-13', now)).toEqual([]);
  });
});

describe('historique et mise de côté', () => {
  it('garde les changements dans l’ordre, retours en arrière compris', () => {
    const at = new Date('2026-11-06T10:00:00Z');
    let h = pushHistory([], { by: 'andre', to: 'todo' }, at);
    h = pushHistory(h, { by: 'andre', from: 'todo', to: 'quote_received' }, at);
    h = pushHistory(h, { by: 'marie', from: 'quote_received', to: 'quote_requested' }, at);
    h = pushHistory(h, { by: 'marie', hold: true }, at);
    expect(h.map(x => x.to ?? (x.hold ? 'hold' : 'resume'))).toEqual(['todo', 'quote_received', 'quote_requested', 'hold']);
    expect(h[2]).toEqual({ at: at.toISOString(), by: 'marie', from: 'quote_received', to: 'quote_requested' });
  });
  it('ne garde que les derniers changements', () => {
    let h: any[] = [];
    for (let i = 0; i < HISTORY_MAX + 10; i++) h = pushHistory(h, { by: `p${i}`, hold: i % 2 === 0 });
    expect(h).toHaveLength(HISTORY_MAX);
    expect(h[h.length - 1].by).toBe(`p${HISTORY_MAX + 9}`);
  });
  it('état du carnet : « on_hold » si mis de côté, sinon l’étape', () => {
    expect(useStatus({ status: 'quote_received', onHold: true })).toBe('on_hold');
    expect(useStatus({ status: 'confirmed', onHold: false })).toBe('confirmed');
  });
});
