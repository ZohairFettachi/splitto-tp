import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';
import type { Expense } from '../../src/domain/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PgExpenseRepository integration', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let repository: PgExpenseRepository;

  beforeAll(
    async () => {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      pool = new Pool({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
      });
      repository = new PgExpenseRepository(pool);

      const migrationPath = path.resolve(__dirname, '../../migrations/001-initial.sql');
      const migrationSql = await readFile(migrationPath, 'utf-8');
      await pool.query(migrationSql);
    },
    90_000,
  );

  beforeEach(async () => {
    await pool.query('TRUNCATE expenses, members, groups RESTART IDENTITY CASCADE');
    await seedBaseGroup(pool);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  it('save then findById returns identical expense', async () => {
    const expense = makeExpense({
      id: 'exp-1',
      groupId: 'group-1',
      paidBy: 'alice',
      paidAt: new Date('2026-05-01T10:00:00.000Z'),
      amount: 42.5,
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });

    await repository.save(expense);
    const found = await repository.findById('exp-1');

    expect(found).toEqual(expense);
  });

  it('findByGroupId returns only expenses of requested group', async () => {
    await seedOtherGroup(pool);

    const g1Expense = makeExpense({
      id: 'exp-g1',
      groupId: 'group-1',
      paidBy: 'alice',
      paidAt: new Date('2026-05-02T08:00:00.000Z'),
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });
    const g2Expense = makeExpense({
      id: 'exp-g2',
      groupId: 'group-2',
      paidBy: 'zoe',
      paidAt: new Date('2026-05-02T09:00:00.000Z'),
      split: { mode: 'equal', beneficiaries: ['zoe'] },
    });

    await repository.save(g1Expense);
    await repository.save(g2Expense);

    const found = await repository.findByGroupId('group-1');

    expect(found).toHaveLength(1);
    expect(found[0]).toEqual(g1Expense);
  });

  it('findInDateRange filters inclusively on both bounds', async () => {
    const from = new Date('2026-05-03T10:00:00.000Z');
    const to = new Date('2026-05-03T12:00:00.000Z');

    const atStart = makeExpense({
      id: 'exp-start',
      paidAt: from,
      split: { mode: 'weighted', weights: { alice: 1, bob: 1, carol: 1 } },
    });
    const inside = makeExpense({
      id: 'exp-inside',
      paidAt: new Date('2026-05-03T11:00:00.000Z'),
      split: { mode: 'percentage', percentages: { alice: 50, bob: 25, carol: 25 } },
    });
    const atEnd = makeExpense({
      id: 'exp-end',
      paidAt: to,
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });
    const outside = makeExpense({
      id: 'exp-outside',
      paidAt: new Date('2026-05-03T12:00:00.001Z'),
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });

    await repository.save(atStart);
    await repository.save(inside);
    await repository.save(atEnd);
    await repository.save(outside);

    const found = await repository.findInDateRange('group-1', from, to);
    const ids = found.map((expense) => expense.id).sort();

    expect(ids).toEqual(['exp-end', 'exp-inside', 'exp-start']);
  });

  it('rejects duplicates on unique(group_id, paid_at, amount, paid_by)', async () => {
    const duplicatedPaidAt = new Date('2026-05-04T10:00:00.000Z');

    await repository.save(
      makeExpense({
        id: 'exp-dup-1',
        groupId: 'group-1',
        paidBy: 'alice',
        paidAt: duplicatedPaidAt,
        amount: 30,
      }),
    );

    await expect(
      repository.save(
        makeExpense({
          id: 'exp-dup-2',
          groupId: 'group-1',
          paidBy: 'alice',
          paidAt: duplicatedPaidAt,
          amount: 30,
        }),
      ),
    ).rejects.toThrow();
  });

  it('rolls back transaction fully when a failure happens mid-transaction', async () => {
    const transactionClient = await pool.connect();

    try {
      await transactionClient.query('BEGIN');

      await transactionClient.query(
        `
          INSERT INTO expenses (
            id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        `,
        [
          'tx-exp-1',
          'group-1',
          'Hotel',
          55,
          'EUR',
          'alice',
          new Date('2026-05-05T10:00:00.000Z'),
          'equal',
          JSON.stringify({ beneficiaries: ['alice', 'bob', 'carol'] }),
          new Date('2026-05-05T11:00:00.000Z'),
        ],
      );

      await expect(
        transactionClient.query(
          `
            INSERT INTO expenses (
              id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
          `,
          [
            'tx-exp-2',
            'group-1',
            'Hotel duplicate',
            55,
            'EUR',
            'alice',
            new Date('2026-05-05T10:00:00.000Z'),
            'equal',
            JSON.stringify({ beneficiaries: ['alice', 'bob', 'carol'] }),
            new Date('2026-05-05T11:00:00.000Z'),
          ],
        ),
      ).rejects.toThrow();

      await transactionClient.query('ROLLBACK');
    } finally {
      transactionClient.release();
    }

    const found = await repository.findById('tx-exp-1');
    expect(found).toBeNull();
  });
});

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: 'exp-default',
    groupId: 'group-1',
    description: 'Expense',
    amount: 10,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2026-05-01T10:00:00.000Z'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    createdAt: new Date('2026-05-01T11:00:00.000Z'),
    ...overrides,
  };
}

async function seedBaseGroup(pool: Pool): Promise<void> {
  await pool.query(
    `
      INSERT INTO groups (id, name, currency, created_at)
      VALUES ('group-1', 'Trip', 'EUR', NOW())
    `,
  );

  await pool.query(
    `
      INSERT INTO members (id, group_id, name, email, created_at)
      VALUES
        ('alice', 'group-1', 'Alice', 'alice@example.com', NOW()),
        ('bob', 'group-1', 'Bob', 'bob@example.com', NOW()),
        ('carol', 'group-1', 'Carol', 'carol@example.com', NOW())
    `,
  );
}

async function seedOtherGroup(pool: Pool): Promise<void> {
  await pool.query(
    `
      INSERT INTO groups (id, name, currency, created_at)
      VALUES ('group-2', 'Other', 'EUR', NOW())
    `,
  );
  await pool.query(
    `
      INSERT INTO members (id, group_id, name, email, created_at)
      VALUES ('zoe', 'group-2', 'Zoe', 'zoe@example.com', NOW())
    `,
  );
}
