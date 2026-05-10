import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Pact Consumer - balances endpoint', () => {
  const provider = new PactV3({
    consumer: 'splitto-frontend',
    provider: 'splitto-api',
    dir: path.resolve(__dirname, '../../pacts'),
  });

  it('GET /api/groups/group-1/balances returns 200 with balances payload', async () => {
    provider
      .given('group-1 a 3 membres et 2 dépenses')
      .uponReceiving('a request for group-1 balances')
      .withRequest({
        method: 'GET',
        path: '/api/groups/group-1/balances',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          groupId: MatchersV3.regex('^group-[a-zA-Z0-9-]+$', 'group-1'),
          balances: MatchersV3.like({
            alice: 10,
            bob: -5,
            carol: -5,
          }),
          settlements: MatchersV3.eachLike({
            from: MatchersV3.regex('^[a-z0-9-]+$', 'bob'),
            to: MatchersV3.regex('^[a-z0-9-]+$', 'alice'),
            amount: MatchersV3.decimal(5),
          }),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/groups/group-1/balances`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.groupId).toBe('group-1');
      expect(body).toHaveProperty('balances');
      expect(body).toHaveProperty('settlements');
      expect(Array.isArray(body.settlements)).toBe(true);
    });
  });

  it('GET /api/groups/inexistant/balances returns 404 for unknown group', async () => {
    provider
      .given('aucun groupe inexistant')
      .uponReceiving('a request for a missing group balances')
      .withRequest({
        method: 'GET',
        path: '/api/groups/inexistant/balances',
      })
      .willRespondWith({
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          error: MatchersV3.like('Group not found'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/groups/inexistant/balances`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Group not found');
    });
  });
});
