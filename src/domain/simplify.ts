// src/domain/simplify.ts — simplification des dettes
//
// EXERCICE 2 — À COMPLÉTER EN TDD STRICT
//
// Spec : voir SUJET.md, exercice 2
//
// Le but : transformer un dictionnaire de soldes en LISTE MINIMALE
// de règlements pour solder le groupe.

import type { Balances, Settlement } from './types';

export function simplifyDebts(balances: Balances): Settlement[] {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amount]) => ({ memberId, amount: toCents(amount) }));
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([memberId, amount]) => ({ memberId, amount: Math.abs(toCents(amount)) }));

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, debtor.amount);

    settlements.push({
      from: debtor.memberId,
      to: creditor.memberId,
      amount: amount / 100,
    });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) creditorIndex += 1;
    if (debtor.amount === 0) debtorIndex += 1;
  }

  return settlements;
}

function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}
