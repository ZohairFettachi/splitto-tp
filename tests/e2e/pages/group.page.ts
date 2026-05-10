import { expect, type Page } from '@playwright/test';

export class GroupPage {
  constructor(private readonly page: Page) {}

  async expectGroupVisible(groupName: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: new RegExp(groupName) })).toBeVisible();
  }

  async openNewExpenseDialog(): Promise<void> {
    await this.page.getByRole('button', { name: 'Ajouter une dépense' }).click();
  }

  async addExpense(input: {
    description: string;
    amount: string;
    paidByName: string;
    beneficiaries: string[];
    allMembers?: string[];
  }): Promise<void> {
    await this.openNewExpenseDialog();
    await this.page.getByLabel('Description').fill(input.description);
    await this.page.getByLabel('Montant').fill(input.amount);
    await this.page.getByLabel('Payé par').selectOption({ label: input.paidByName });

    const allMembers = input.allMembers ?? ['Alice', 'Bob', 'Carol'];
    for (const member of allMembers) {
      if (!input.beneficiaries.includes(member)) {
        const checkbox =
          member === 'Alice'
            ? this.page.getByRole('checkbox').first()
            : this.page.getByRole('checkbox', { name: member, exact: true });
        await checkbox.uncheck();
      }
    }

    await this.page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  }

  async expectExpenseVisible(description: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name: description })).toBeVisible();
  }

  async expectBalanceByName(memberName: string, expectedText: string): Promise<void> {
    await expect(
      this.page.getByRole('row', {
        name: new RegExp(`${memberName}.*${expectedText.replace('.', '\\.')}`),
      }),
    ).toBeVisible();
  }

  async settleFirstSettlement(): Promise<void> {
    const firstSettleButton = this.page.getByRole('button', { name: 'Régler' }).first();
    await firstSettleButton.click();
  }

  async expectSettlementCount(expected: number): Promise<void> {
    await expect(this.page.getByTestId(/settlement-row-/)).toHaveCount(expected);
  }
}
