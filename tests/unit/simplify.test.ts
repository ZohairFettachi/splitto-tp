import { describe, expect, it } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';
import type { Balances } from '../../src/domain/types';

describe('simplifyDebts', () => {
  it('returns one settlement for two members', () => {
    const balances: Balances = { a: 10, b: -10 };
    expect(simplifyDebts(balances)).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });

  it('returns two settlements for four members', () => {
    const balances: Balances = { a: 30, b: -20, c: -10, d: 0 };
    expect(simplifyDebts(balances)).toEqual([
      { from: 'b', to: 'a', amount: 20 },
      { from: 'c', to: 'a', amount: 10 },
    ]);
  });

  it('skips zero balances and avoids unnecessary intermediate member', () => {
    const balances: Balances = { a: 10, b: 0, c: -10 };
    expect(simplifyDebts(balances)).toEqual([{ from: 'c', to: 'a', amount: 10 }]);
  });

  it('supports cent-level rounding safely', () => {
    const balances: Balances = { a: 66.67, b: -33.33, c: -33.34 };
    expect(simplifyDebts(balances)).toEqual([
      { from: 'c', to: 'a', amount: 33.34 },
      { from: 'b', to: 'a', amount: 33.33 },
    ]);
  });

  it('returns empty settlements when everyone is balanced', () => {
    const balances: Balances = { a: 0, b: 0, c: 0 };
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('handles multiple creditors and debtors with deterministic chaining', () => {
    const balances: Balances = { a: 30, b: 20, c: -25, d: -25 };
    expect(simplifyDebts(balances)).toEqual([
      { from: 'c', to: 'a', amount: 25 },
      { from: 'd', to: 'a', amount: 5 },
      { from: 'd', to: 'b', amount: 20 },
    ]);
  });

  it('ignores non-active members and only settles between debtors and creditors', () => {
    const balances: Balances = { a: 40, b: 0, c: -10, d: -30, e: 0 };
    const result = simplifyDebts(balances);

    expect(result).toEqual([
      { from: 'd', to: 'a', amount: 30 },
      { from: 'c', to: 'a', amount: 10 },
    ]);
    expect(result.every((s) => s.amount > 0)).toBe(true);
    expect(result.every((s) => ['c', 'd'].includes(s.from))).toBe(true);
    expect(result.every((s) => s.to === 'a')).toBe(true);
  });
});
