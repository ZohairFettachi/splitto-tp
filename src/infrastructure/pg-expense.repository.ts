// src/infrastructure/pg-expense.repository.ts
//
// EXERCICE 4 — À COMPLÉTER
//
// Implémentation Postgres du ExpenseRepository.
// À tester avec Testcontainers (voir SUJET.md exercice 4).

import type { Pool } from 'pg';
import type { Expense } from '../domain/types';
import type { ExpenseRepository } from '../ports/expense.repository';

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly pool: Pool) {}

  async save(expense: Expense): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO expenses (
          id,
          group_id,
          description,
          amount,
          currency,
          paid_by,
          paid_at,
          split_mode,
          split_data,
          category,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
      `,
      [
        expense.id,
        expense.groupId,
        expense.description,
        expense.amount,
        expense.currency,
        expense.paidBy,
        expense.paidAt,
        expense.split.mode,
        JSON.stringify(stripModeFromSplit(expense)),
        expense.category ?? null,
        expense.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<Expense | null> {
    const result = await this.pool.query<ExpenseRow>(
      `
        SELECT
          id,
          group_id,
          description,
          amount,
          currency,
          paid_by,
          paid_at,
          split_mode,
          split_data,
          category,
          created_at
        FROM expenses
        WHERE id = $1
      `,
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapRowToExpense(result.rows[0]);
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    const result = await this.pool.query<ExpenseRow>(
      `
        SELECT
          id,
          group_id,
          description,
          amount,
          currency,
          paid_by,
          paid_at,
          split_mode,
          split_data,
          category,
          created_at
        FROM expenses
        WHERE group_id = $1
        ORDER BY paid_at DESC
      `,
      [groupId],
    );
    return result.rows.map(mapRowToExpense);
  }

  async findInDateRange(
    groupId: string,
    from: Date,
    to: Date,
  ): Promise<Expense[]> {
    const result = await this.pool.query<ExpenseRow>(
      `
        SELECT
          id,
          group_id,
          description,
          amount,
          currency,
          paid_by,
          paid_at,
          split_mode,
          split_data,
          category,
          created_at
        FROM expenses
        WHERE group_id = $1
          AND paid_at >= $2
          AND paid_at <= $3
        ORDER BY paid_at DESC
      `,
      [groupId, from, to],
    );
    return result.rows.map(mapRowToExpense);
  }
}

type ExpenseRow = {
  id: string;
  group_id: string;
  description: string;
  amount: string | number;
  currency: Expense['currency'];
  paid_by: string;
  paid_at: Date | string;
  split_mode: Expense['split']['mode'];
  split_data: Record<string, unknown>;
  category: string | null;
  created_at: Date | string;
};

function mapRowToExpense(row: ExpenseRow): Expense {
  const splitData = row.split_data as Record<string, unknown>;
  if (row.split_mode === 'equal') {
    return {
      id: row.id,
      groupId: row.group_id,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      paidBy: row.paid_by,
      paidAt: new Date(row.paid_at),
      split: {
        mode: 'equal',
        beneficiaries: (splitData.beneficiaries as string[]) ?? [],
      },
      createdAt: new Date(row.created_at),
      category: row.category ?? undefined,
    };
  }

  if (row.split_mode === 'weighted') {
    return {
      id: row.id,
      groupId: row.group_id,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      paidBy: row.paid_by,
      paidAt: new Date(row.paid_at),
      split: {
        mode: 'weighted',
        weights: (splitData.weights as Record<string, number>) ?? {},
      },
      createdAt: new Date(row.created_at),
      category: row.category ?? undefined,
    };
  }

  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    paidBy: row.paid_by,
    paidAt: new Date(row.paid_at),
    split: {
      mode: 'percentage',
      percentages: (splitData.percentages as Record<string, number>) ?? {},
    },
    createdAt: new Date(row.created_at),
    category: row.category ?? undefined,
  };
}

function stripModeFromSplit(expense: Expense): Record<string, unknown> {
  if (expense.split.mode === 'equal') {
    return { beneficiaries: expense.split.beneficiaries };
  }
  if (expense.split.mode === 'weighted') {
    return { weights: expense.split.weights };
  }
  return { percentages: expense.split.percentages };
}
