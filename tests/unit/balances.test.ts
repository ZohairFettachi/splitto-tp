import { describe, expect, it } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Expense, Group, Member } from '../../src/domain/types';

const members: Member[] = [
  { id: 'alice', name: 'Alice', email: 'alice@example.com' },
  { id: 'bob', name: 'Bob', email: 'bob@example.com' },
  { id: 'carol', name: 'Carol', email: 'carol@example.com' },
];

function makeGroup(memberList: Member[] = members): Group {
  return {
    id: 'group-1',
    name: 'Trip',
    currency: 'EUR',
    members: memberList,
  };
}

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    groupId: 'group-1',
    description: 'Expense',
    amount: 0,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2026-01-01T10:00:00.000Z'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('computeBalances', () => {
  it('returns zero balances for empty group', () => {
    const result = computeBalances(makeGroup([]), []);
    expect(result).toEqual({});
  });

  it('handles equal split with payer included as beneficiary', () => {
    const expense = makeExpense({
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });

    const result = computeBalances(makeGroup(), [expense]);

    expect(result).toEqual({
      alice: 20,
      bob: -10,
      carol: -10,
    });
    expect(sumBalances(result)).toBe(0);
  });

  it('handles equal split with payer not included as beneficiary', () => {
    const expense = makeExpense({
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['bob', 'carol'] },
    });

    const result = computeBalances(makeGroup(), [expense]);

    expect(result).toEqual({
      alice: 30,
      bob: -15,
      carol: -15,
    });
    expect(sumBalances(result)).toBe(0);
  });

  it('handles multiple expenses that partially offset', () => {
    const expense1 = makeExpense({
      id: 'exp-1',
      amount: 60,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });
    const expense2 = makeExpense({
      id: 'exp-2',
      amount: 30,
      paidBy: 'bob',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });

    const result = computeBalances(makeGroup(), [expense1, expense2]);

    expect(result).toEqual({
      alice: 30,
      bob: 0,
      carol: -30,
    });
    expect(sumBalances(result)).toBe(0);
  });

  it('handles weighted split with non uniform weights', () => {
    const expense = makeExpense({
      amount: 90,
      paidBy: 'alice',
      split: { mode: 'weighted', weights: { alice: 1, bob: 2, carol: 3 } },
    });

    const result = computeBalances(makeGroup(), [expense]);

    expect(result).toEqual({
      alice: 75,
      bob: -30,
      carol: -45,
    });
    expect(sumBalances(result)).toBe(0);
  });

  it('handles percentage split with rounding to cents', () => {
    const expense = makeExpense({
      amount: 100,
      paidBy: 'alice',
      split: { mode: 'percentage', percentages: { alice: 33.33, bob: 33.33, carol: 33.34 } },
    });

    const result = computeBalances(makeGroup(), [expense]);

    expect(result).toEqual({
      alice: 66.67,
      bob: -33.33,
      carol: -33.34,
    });
    expect(sumBalances(result)).toBe(0);
  });

  it('keeps old expense members not present in group', () => {
    const expense = makeExpense({
      amount: 40,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'dan'] },
    });

    const result = computeBalances(makeGroup(), [expense]);

    expect(result).toEqual({
      alice: 26.66,
      bob: -13.33,
      carol: 0,
      dan: -13.33,
    });
    expect(sumBalances(result)).toBe(0);
  });

  it('returns group balances unchanged for empty expenses list', () => {
    const result = computeBalances(makeGroup(), []);
    expect(result).toEqual({
      alice: 0,
      bob: 0,
      carol: 0,
    });
  });

  it('handles percentage splits that do not sum exactly to 100', () => {
    const expense = makeExpense({
      amount: 100,
      paidBy: 'alice',
      split: { mode: 'percentage', percentages: { alice: 40, bob: 40, carol: 19 } },
    });

    const result = computeBalances(makeGroup(), [expense]);
    expect(sumBalances(result)).toBe(0);
    expect(result).toEqual({
      alice: 59.59,
      bob: -40.4,
      carol: -19.19,
    });
  });
});

function sumBalances(balances: Record<string, number>): number {
  return Number(
    Object.values(balances)
      .reduce((sum, value) => sum + value, 0)
      .toFixed(2),
  );
}
