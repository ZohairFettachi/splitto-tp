import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { GroupPage } from './pages/group.page';

const MEMBERS_INPUT = `Alice <alice@example.com>
Bob <bob@example.com>
Carol <carol@example.com>`;

test.beforeEach(async ({ request, page }) => {
  await request.post('/_test/reset');
  await page.goto('/');
});

test('create a group with 3 members and see it in list', async ({ page }) => {
  const home = new HomePage(page);

  await home.createGroup({
    name: 'Trip Lisbon',
    currency: 'EUR',
    membersMultiline: MEMBERS_INPUT,
  });

  await home.expectGroupInList('Trip Lisbon');
});

test('add an expense and see it in expense list', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);

  await home.createGroup({
    name: 'Trip Paris',
    currency: 'EUR',
    membersMultiline: MEMBERS_INPUT,
  });
  await home.openGroupFromList('Trip Paris');

  await group.addExpense({
    description: 'Dinner',
    amount: '30',
    paidByName: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Carol'],
  });

  await group.expectExpenseVisible('Dinner');
});

test('show updated balances after 30 EUR expense by Alice for 3 members', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);

  await home.createGroup({
    name: 'Trip Rome',
    currency: 'EUR',
    membersMultiline: MEMBERS_INPUT,
  });
  await home.openGroupFromList('Trip Rome');
  await group.expectGroupVisible('Trip Rome');

  await group.addExpense({
    description: 'Lunch',
    amount: '30',
    paidByName: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Carol'],
  });

  await group.expectBalanceByName('Alice', '20.00 EUR');
  await group.expectBalanceByName('Bob', '-10.00 EUR');
  await group.expectBalanceByName('Carol', '-10.00 EUR');
});

test('mark a settlement as settled and verify it disappears', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);

  await home.createGroup({
    name: 'Trip Madrid',
    currency: 'EUR',
    membersMultiline: MEMBERS_INPUT,
  });
  await home.openGroupFromList('Trip Madrid');

  await group.addExpense({
    description: 'Taxi',
    amount: '30',
    paidByName: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Carol'],
  });

  await group.expectSettlementCount(2);
  await group.settleFirstSettlement();
  await group.expectSettlementCount(1);
});
