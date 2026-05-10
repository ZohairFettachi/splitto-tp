import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async openNewGroupDialog(): Promise<void> {
    await this.page.getByRole('button', { name: 'Nouveau groupe' }).click();
  }

  async createGroup(input: {
    name: string;
    membersMultiline: string;
    currency?: 'EUR' | 'USD' | 'GBP' | 'CHF';
  }): Promise<void> {
    await this.openNewGroupDialog();
    await this.page.getByLabel('Nom du groupe').fill(input.name);
    if (input.currency) {
      await this.page.getByLabel('Devise').selectOption(input.currency);
    }
    await this.page
      .getByLabel('Membres (un par ligne, format : Nom <email>)')
      .fill(input.membersMultiline);
    await this.page.getByRole('button', { name: 'Créer' }).click();
  }

  async openGroupFromList(groupName: string): Promise<void> {
    await this.page.getByRole('listitem').filter({ hasText: groupName }).click();
  }

  async expectGroupInList(groupName: string): Promise<void> {
    await expect(this.page.getByRole('listitem').filter({ hasText: groupName })).toBeVisible();
  }
}
