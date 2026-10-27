import { describe, expect, it } from 'vitest';
import { commentRecipients, createsCycle, daysUntil, newlyUnblocked, parseDueDate, parseTaskInput, reminderDue, taskState } from './tasks';

describe('parseTaskInput', () => {
  it('nettoie et valide une tâche', () => {
    expect(parseTaskInput({ title: '  Réserver la salle ', dueDate: '2026-11-15', assigneeIds: ['a', 'a'], dependsOnIds: [] }))
      .toEqual({ title: 'Réserver la salle', note: null, dueDate: '2026-11-15', groupId: null, assigneeIds: ['a'], dependsOnIds: [] });
  });
  it('refuse un nom vide, une échéance impossible ou des listes mal formées', () => {
    expect(parseTaskInput({ title: ' ' })).toHaveProperty('error');
    expect(parseTaskInput({ title: 'X', dueDate: '2026-02-31' })).toHaveProperty('error');
    expect(parseTaskInput({ title: 'X', assigneeIds: 'a' })).toHaveProperty('error');
    expect(parseTaskInput({ title: 'X', dependsOnIds: [{ not: '' }] })).toHaveProperty('error');
  });
  it('échéance facultative', () => {
    expect(parseDueDate('')).toBeNull();
    expect(parseDueDate('15.11.2026')).toBeUndefined();
  });
});

describe('createsCycle', () => {
  const edges = new Map([['b', ['a']], ['c', ['b']]]); // b attend a, c attend b
  it('repère une boucle directe ou indirecte', () => {
    expect(createsCycle(edges, 'a', ['c'])).toBe(true);
    expect(createsCycle(edges, 'a', ['a'])).toBe(true);
  });
  it('accepte une dépendance sans boucle', () => {
    expect(createsCycle(edges, 'c', ['a'])).toBe(false);
    expect(createsCycle(edges, 'd', ['c', 'a'])).toBe(false);
  });
});

describe('taskState / newlyUnblocked', () => {
  const tasks = [
    { id: 'salle', status: 'done', dependsOn: [] },
    { id: 'traiteur', status: 'todo', dependsOn: [] },
    { id: 'invitations', status: 'todo', dependsOn: ['salle'] },
    { id: 'menu', status: 'todo', dependsOn: ['salle', 'traiteur'] },
    { id: 'plan-tables', status: 'doing', dependsOn: ['traiteur'] },
  ];
  const statusOf = new Map(tasks.map(t => [t.id, t.status]));
  it('bloquée tant qu’une tâche attendue n’est pas terminée', () => {
    expect(taskState(tasks[2], statusOf)).toBe('ready');
    expect(taskState(tasks[3], statusOf)).toBe('blocked');
    expect(taskState(tasks[4], statusOf)).toBe('doing');
    expect(taskState(tasks[0], statusOf)).toBe('done');
  });
  it('terminer le traiteur débloque le menu (qui n’attend plus rien), pas une tâche déjà commencée', () => {
    expect(newlyUnblocked(tasks, 'traiteur').map(t => t.id)).toEqual(['menu']);
    expect(newlyUnblocked(tasks.map(t => t.id === 'salle' ? { ...t, status: 'todo' } : t), 'traiteur').map(t => t.id)).toEqual([]);
  });
});

describe('rappels et échéances', () => {
  it('compte les jours et rappelle dans les deux jours, jamais après l’échéance', () => {
    expect(daysUntil('2026-11-15', '2026-11-13')).toBe(2);
    expect(reminderDue('2026-11-15', '2026-11-13')).toBe(true);
    expect(reminderDue('2026-11-15', '2026-11-12')).toBe(false);
    expect(reminderDue('2026-11-15', '2026-11-16')).toBe(false);
    expect(reminderDue(null, '2026-11-16')).toBe(false);
  });
  it('commentaire : responsables et créateur, sans l’auteur', () => {
    expect(commentRecipients({ createdById: 'ana' }, ['ana', 'bob'], 'bob')).toEqual(['ana']);
    expect(commentRecipients({ createdById: null }, ['bob', 'cy'], 'ana')).toEqual(['bob', 'cy']);
  });
});
