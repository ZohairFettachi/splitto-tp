import { describe, expect, it, vi } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { CreateExpenseInput, Expense } from '../../src/domain/types';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { ExpenseRepository } from '../../src/ports/expense.repository';

class InMemoryExpenseRepositoryFake implements ExpenseRepository {
  private readonly items = new Map<string, Expense>();

  async save(expense: Expense): Promise<void> {
    this.items.set(expense.id, expense);
  }

  async findById(id: string): Promise<Expense | null> {
    return this.items.get(id) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    return [...this.items.values()].filter((expense) => expense.groupId === groupId);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    return [...this.items.values()].filter(
      (expense) => expense.groupId === groupId && expense.paidAt >= from && expense.paidAt <= to,
    );
  }
}

const baseInput: CreateExpenseInput = {
  groupId: 'group-1',
  description: 'Restaurant',
  amount: 120,
  currency: 'EUR',
  paidBy: 'alice',
  paidAt: new Date('2026-05-10T12:00:00.000Z'),
  split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
};

describe('ExpenseService.create', () => {
  it('creates and saves expense, logs and notifies for high amount', async () => {
    // --- FAKE ---
    const fakeRepo = new InMemoryExpenseRepositoryFake();

    // --- STUB ---
    const fixedNow = new Date('2026-05-10T12:30:00.000Z');
    const stubClock: Clock = { now: () => fixedNow };

    // --- STUB ---
    const stubIdGen: IdGenerator = { next: () => 'exp-123' };

    // --- SPY ---
    const spyLogger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    // --- MOCK ---
    const mockNotifier: EmailNotifier = {
      notifyGroupMembers: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ExpenseService(fakeRepo, mockNotifier, stubClock, stubIdGen, spyLogger);
    const created = await service.create(baseInput);

    // expense retourné
    expect(created).toEqual({
      ...baseInput,
      id: 'exp-123',
      createdAt: fixedNow,
    });

    // repo contient la dépense
    const saved = await fakeRepo.findById('exp-123');
    expect(saved).toEqual(created);

    // notifier appelé si amount >= 100
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledTimes(1);
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledWith(
      'group-1',
      'Nouvelle dépense importante : Restaurant (120€)',
    );

    // spy logger bien invoqué
    expect(spyLogger.info).toHaveBeenCalledWith('Expense exp-123 created');
  });

  it('does not notify for low amount', async () => {
    // --- FAKE ---
    const fakeRepo = new InMemoryExpenseRepositoryFake();

    // --- STUB ---
    const stubClock: Clock = { now: () => new Date('2026-05-10T13:00:00.000Z') };
    const stubIdGen: IdGenerator = { next: () => 'exp-124' };

    // --- DUMMY ---
    const dummyLogger: Logger = {
      info: () => {},
      error: () => {},
    };

    // --- MOCK ---
    const mockNotifier: EmailNotifier = {
      notifyGroupMembers: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ExpenseService(fakeRepo, mockNotifier, stubClock, stubIdGen, dummyLogger);

    await service.create({
      ...baseInput,
      amount: 99.99,
      description: 'Cafe',
    });

    // notifier non appelé si amount < 100
    expect(mockNotifier.notifyGroupMembers).not.toHaveBeenCalled();
  });
});
