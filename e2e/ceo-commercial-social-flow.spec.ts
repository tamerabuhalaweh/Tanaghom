import { expect, test } from '@playwright/test';

test('CEO commercial/social walkthrough path is operable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Enter Commercial Workspace/i })).toBeVisible();

  await page.getByRole('button', { name: /Open Command Center/i }).click();
  await expect(page.getByRole('heading', { name: /Command Center|Commercial/i })).toBeVisible();

  await page.getByRole('link', { name: /AI Draft Studio/i }).click();
  await expect(page.getByRole('heading', { name: /AI Draft Studio/i })).toBeVisible();
  await page.getByRole('button', { name: /Generate Ideas/i }).click();
  await expect(page.getByText(/Generated .* ideas|Generation failed/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Record Human Selection/i })).toBeVisible();

  await page.getByRole('button', { name: /Record Human Selection/i }).click();
  await expect(page.getByText(/Human selection recorded|Selection failed/i)).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: /Create Campaign/i }).click();
  await expect(page.getByText(/Campaign created|Campaign creation failed/i)).toBeVisible({ timeout: 30000 });

  await page.getByRole('link', { name: /^Campaigns$/i }).click();
  await expect(page.getByRole('heading', { name: /^Campaigns$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Generate Platform Drafts/i })).toBeVisible();

  await page.getByRole('link', { name: /Credentials/i }).click();
  await expect(page.getByRole('heading', { name: /Integration Credential Control Plane/i })).toBeVisible();
  await expect(page.getByText(/Secrets hidden/i)).toBeVisible();

  await page.getByRole('link', { name: /Users\/Roles/i }).click();
  await expect(page.getByRole('heading', { name: /Users, Roles & AgentReps/i })).toBeVisible();

  await page.getByRole('link', { name: /GHL Setup/i }).click();
  await expect(page.getByRole('heading', { name: /GoHighLevel Integration Wizard/i })).toBeVisible();
  await expect(page.getByText(/Production Write Disabled/i)).toBeVisible();
});
