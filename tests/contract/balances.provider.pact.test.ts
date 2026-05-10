import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Verifier } from '@pact-foundation/pact';
import { createApp } from '../../src/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Pact Provider - splitto-api', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;
  let baseUrl = '';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new Pool({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    });

    const migrationPath = path.resolve(__dirname, '../../migrations/001-initial.sql');
    const migrationSql = await readFile(migrationPath, 'utf-8');
    await pool.query(migrationSql);

    const app = createApp(pool);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 90_000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  it('verifies pact interactions for balances route', async () => {
    const pactFile = path.resolve(__dirname, '../../pacts/splitto-frontend-splitto-api.json');

    const verifier = new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: baseUrl,
      pactUrls: [pactFile],
      stateHandlers: {
        'group-1 a 3 membres et 2 dépenses': async () => {
          await pool.query('TRUNCATE expenses, members, groups RESTART IDENTITY CASCADE');
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
          await pool.query(
            `
              INSERT INTO expenses (
                id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at
              )
              VALUES
                (
                  'exp-1',
                  'group-1',
                  'Restaurant',
                  30,
                  'EUR',
                  'alice',
                  '2026-05-01T12:00:00.000Z',
                  'equal',
                  '{"beneficiaries":["alice","bob","carol"]}'::jsonb,
                  NOW()
                ),
                (
                  'exp-2',
                  'group-1',
                  'Taxi',
                  15,
                  'EUR',
                  'bob',
                  '2026-05-02T12:00:00.000Z',
                  'equal',
                  '{"beneficiaries":["alice","bob","carol"]}'::jsonb,
                  NOW()
                )
            `,
          );
        },
        'aucun groupe inexistant': async () => {
          await pool.query('TRUNCATE expenses, members, groups RESTART IDENTITY CASCADE');
        },
      },
    });

    const output = await verifier.verifyProvider();
    expect(output).toContain('finished: 0');
  }, 90_000);
});
