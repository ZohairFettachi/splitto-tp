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
  const entries = Object.entries(balances);
  const creditor = entries.find(([, amount]) => amount > 0);
  const debtor = entries.find(([, amount]) => amount < 0);

  if (!creditor || !debtor) return [];

  return [
    {
      from: debtor[0],
      to: creditor[0],
      amount: Math.min(creditor[1], Math.abs(debtor[1])),
    },
  ];
}
