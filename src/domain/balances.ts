// src/domain/balances.ts — calcul des soldes d'un groupe
//
// EXERCICE 1 — À COMPLÉTER
//
// Spec : voir SUJET.md, exercice 1
//
// Cette fonction est PURE : pas d'effets de bord, pas d'I/O.
// Elle prend un groupe et ses dépenses, retourne les soldes.

import type { Group, Expense, Balances } from './types';

export function computeBalances(group: Group, expenses: Expense[]): Balances {
  const balancesInCents: Record<string, number> = {};

  for (const member of group.members) {
    balancesInCents[member.id] = 0;
  }

  for (const expense of expenses) {
    const totalCents = toCents(expense.amount);

    if (balancesInCents[expense.paidBy] === undefined) {
      balancesInCents[expense.paidBy] = 0;
    }
    balancesInCents[expense.paidBy] += totalCents;

    const shares = computeSharesInCents(totalCents, expense);
    for (const [memberId, share] of Object.entries(shares)) {
      if (balancesInCents[memberId] === undefined) {
        balancesInCents[memberId] = 0;
      }
      balancesInCents[memberId] -= share;
    }
  }

  return Object.fromEntries(
    Object.entries(balancesInCents).map(([memberId, cents]) => [memberId, cents / 100]),
  );
}

function computeSharesInCents(totalCents: number, expense: Expense): Record<string, number> {
  if (expense.split.mode === 'equal') {
    const beneficiaries = expense.split.beneficiaries;
    if (beneficiaries.length === 0) return {};

    const base = Math.floor(totalCents / beneficiaries.length);
    let remainder = totalCents - base * beneficiaries.length;
    const shares: Record<string, number> = {};

    for (const memberId of beneficiaries) {
      shares[memberId] = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    }
    return shares;
  }

  if (expense.split.mode === 'weighted') {
    return allocateByWeights(totalCents, expense.split.weights);
  }

  const ratioWeights = Object.fromEntries(
    Object.entries(expense.split.percentages).map(([memberId, percentage]) => [memberId, percentage / 100]),
  );
  return allocateByWeights(totalCents, ratioWeights);
}

function allocateByWeights(totalCents: number, weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  if (entries.length === 0) return {};

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return {};

  const provisional = entries.map(([memberId, weight]) => {
    const exactShare = (totalCents * weight) / totalWeight;
    const floored = Math.floor(exactShare);
    return { memberId, floored, fraction: exactShare - floored };
  });

  const baseAllocated = provisional.reduce((sum, line) => sum + line.floored, 0);
  let remainder = totalCents - baseAllocated;

  provisional.sort((a, b) => b.fraction - a.fraction);

  const shares: Record<string, number> = {};
  for (const line of provisional) {
    shares[line.memberId] = line.floored;
  }
  for (let i = 0; i < provisional.length && remainder > 0; i += 1) {
    shares[provisional[i].memberId] += 1;
    remainder -= 1;
  }

  return shares;
}

function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}
