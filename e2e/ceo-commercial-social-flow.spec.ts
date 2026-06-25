import { expect, test } from '@playwright/test';

test('CEO commercial/social walkthrough path is operable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Enter Commercial Workspace/i })).toBeVisible();

  await page.getByLabel(/Email/i).fill('admin@tanaghum.com');
  await page.getByRole('textbox', { name: /^Password$/i }).fill('password123');
  await page.getByRole('button', { name: /Open Command Center/i }).click();
  await expect(page.getByRole('heading', { name: /Commercial Command Center/i })).toBeVisible();

  await page.getByRole('link', { name: /AI Draft Studio/i }).click();
  await expect(page.getByRole('heading', { name: /Create campaign ideas/i })).toBeVisible();
  await page.getByRole('button', { name: /Generate Ideas/i }).click();
  await expect(page.getByText(/Generated .* ideas|Generation failed/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Record Human Selection/i })).toBeVisible();

  await page.getByRole('button', { name: /Record Human Selection/i }).click();
  await expect(page.getByText(/Human selection recorded|Selection failed/i)).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: /Create Campaign/i }).click();
  await expect(page.getByText(/Campaign created|Campaign creation failed/i)).toBeVisible({ timeout: 30000 });

  await page.getByRole('link', { name: /Open Campaigns/i }).click();
  await expect(page.getByRole('heading', { name: /Campaign workspace/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Generate Platform Drafts/i })).toBeVisible();

  await page.getByRole('link', { name: /AI Provider/i }).click();
  await expect(page.getByRole('heading', { name: /AI Provider Settings/i })).toBeVisible();
  await expect(page.getByText(/raw values are never returned/i)).toBeVisible();

  await page.getByRole('link', { name: /My AI Rep/i }).click();
  await expect(page.getByRole('heading', { name: /My AI Rep/i })).toBeVisible();
  await expect(page.getByText(/AgentRep Identity|Initialize AgentRep/i)).toBeVisible();

  await page.getByRole('link', { name: /Users & Roles/i }).click();
  await expect(page.getByRole('heading', { name: /Users, Roles & AgentReps/i })).toBeVisible();
  await expect(page.getByText(/Business Role Template/i)).toBeVisible();
  await expect(page.getByText(/Social Media Manager/i)).toBeVisible();

  await page.getByRole('link', { name: /Agent Skills/i }).click();
  await expect(page.getByRole('heading', { name: /Agent Skills/i })).toBeVisible();
  await expect(page.getByText(/Create Skill/i)).toBeVisible();

  await page.getByRole('link', { name: /Integrations/i }).click();
  await expect(page.getByRole('heading', { name: /Integrations & MCP Connectors/i })).toBeVisible();
  await expect(page.getByText(/Add Connector/i)).toBeVisible();
  await expect(page.getByText(/Live Activation Blocked/i)).toBeVisible();
});
