import { describe, expect, it } from 'vitest';
import { answerPoints, distribution, leaderboard, parseQuestion } from './quiz';

describe('quiz', () => {
  it('donne un bonus de rapidité aux bonnes réponses', () => {
    expect(answerPoints(true, 0, 20000)).toBe(1000);
    expect(answerPoints(true, 10000, 20000)).toBe(750);
    expect(answerPoints(true, 20000, 20000)).toBe(500);
    expect(answerPoints(true, 25000, 20000)).toBe(500);
    expect(answerPoints(false, 100, 20000)).toBe(0);
  });

  it('vérifie une question', () => {
    expect(parseQuestion({ text: ' Capitale de la Suisse ? ', options: ['Berne', 'Zurich'], correctIndex: 0 }))
      .toEqual({ text: 'Capitale de la Suisse ?', options: ['Berne', 'Zurich'], correctIndex: 0 });
    expect(parseQuestion({ text: 'Q', options: ['A'], correctIndex: 0 })).toHaveProperty('error');
    expect(parseQuestion({ text: 'Q', options: ['A', ''], correctIndex: 0 })).toHaveProperty('error');
    expect(parseQuestion({ text: 'Q', options: ['A', 'B', 'C', 'D', 'E'], correctIndex: 0 })).toHaveProperty('error');
    expect(parseQuestion({ text: 'Q', options: ['A', 'B'], correctIndex: 2 })).toHaveProperty('error');
    expect(parseQuestion({ text: '', options: ['A', 'B'], correctIndex: 0 })).toHaveProperty('error');
  });

  it('classe les joueurs, avec rangs égaux en cas d’égalité', () => {
    const board = leaderboard(['a', 'b', 'c', 'd'], [
      { userId: 'a', points: 900 }, { userId: 'b', points: 900 }, { userId: 'c', points: 1000 }, { userId: 'a', points: 0 },
    ]);
    expect(board.map(l => [l.userId, l.points, l.rank])).toEqual([['c', 1000, 1], ['a', 900, 2], ['b', 900, 2], ['d', 0, 4]]);
  });

  it('compte les réponses par option', () => {
    expect(distribution(3, [{ option: 0 }, { option: 2 }, { option: 2 }, { option: 7 }])).toEqual([1, 0, 2]);
  });
});
