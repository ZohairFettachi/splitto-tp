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
});
