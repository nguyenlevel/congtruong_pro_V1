import { expect, test, type Page } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? '';
if (!PASSWORD) throw new Error('Set E2E_PASSWORD to the local test account password');
const PROJECT_NAME = 'Local Test Site A';
const WORKER_SUB_USER_ID = 'e2e10003-0000-4000-8000-000000000003'; // seeded by scripts/seed-local-e2e.ts

async function login(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Dự án' })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('PROJECT_MANAGER (MAIN) sees only WORKER and PROJECT_VIEWER as assignable roles', async ({ page }) => {
  await login(page, 'pm.main@local.test');
  await page.getByRole('button', { name: new RegExp(PROJECT_NAME) }).click();
  const detail = page.getByRole('region', { name: 'Chi tiết dự án' });
  await expect(detail).toBeVisible();

  const addForm = detail.getByRole('form', { name: 'Thêm thành viên dự án' });
  const roleOptions = (await addForm.getByLabel('Vai trò').locator('option').allTextContents()).map((o) => o.trim());
  expect(roleOptions).toEqual(['WORKER', 'PROJECT_VIEWER']);
});

test('PROJECT_MANAGER (MAIN) adds and revokes a SUBCONTRACTOR worker via UI', async ({ page }) => {
  await login(page, 'pm.main@local.test');
  await page.getByRole('button', { name: new RegExp(PROJECT_NAME) }).click();
  const detail = page.getByRole('region', { name: 'Chi tiết dự án' });
  await expect(detail).toBeVisible();

  const addForm = detail.getByRole('form', { name: 'Thêm thành viên dự án' });
  const subOption = addForm.getByLabel('Công ty').locator('option', { hasText: 'SUBCONTRACTOR' });
  const subCompanyId = await subOption.getAttribute('value');
  expect(subCompanyId).toBeTruthy();
  await addForm.getByLabel('Công ty').selectOption(subCompanyId as string);
  await addForm.getByLabel('ID người dùng').fill(WORKER_SUB_USER_ID);
  await addForm.getByLabel('Vai trò').selectOption('WORKER');
  await addForm.getByRole('button', { name: 'Thêm thành viên' }).click();

  const row = detail.locator('li', { hasText: WORKER_SUB_USER_ID });
  await expect(row).toBeVisible();
  await expect(row).toContainText('WORKER');

  await row.getByRole('button', { name: 'Thu hồi' }).click();
  await expect(detail.locator('li', { hasText: WORKER_SUB_USER_ID })).toHaveCount(0);
});

test('PROJECT_MANAGER (SUB) sees the participating project as read-only in the web list', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'pm.sub@local.test');
  const item = page.getByRole('button', { name: new RegExp(PROJECT_NAME) });
  await expect(item).toBeVisible();
  await expect(item).toContainText('Tham gia (chỉ xem)');
  await item.click();
  const detail = page.getByRole('region', { name: 'Chi tiết dự án' });
  await expect(detail).toContainText('chỉ có quyền xem');
  await expect(detail.getByRole('form', { name: 'Thêm thành viên dự án' })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Thu hồi' })).toHaveCount(0);
  await expect(detail.locator('li', { hasText: 'WORKER' })).toHaveCount(0);
  await context.close();
});
