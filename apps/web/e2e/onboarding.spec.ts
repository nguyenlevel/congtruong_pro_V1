import { expect, test, type Page } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? '';
if (!PASSWORD) throw new Error('Set E2E_PASSWORD to the password used by `pnpm seed:e2e`');

async function login(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Dự án' })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('PROJECT_MANAGER creates a project from the web UI and becomes its manager', async ({ page }) => {
  const name = `E2E Site ${Date.now()}`;
  await login(page, 'pm.main@local.test');

  const form = page.getByRole('form', { name: 'Tạo dự án' });
  await form.getByLabel('Tên dự án').fill(name);
  await form.getByLabel('Địa chỉ').fill('Hanoi');
  await form.getByRole('button', { name: 'Tạo dự án' }).click();

  const item = page.getByRole('button', { name: new RegExp(name) });
  await expect(item).toBeVisible();
  await item.click();
  const detail = page.getByRole('region', { name: 'Chi tiết dự án' });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('form', { name: 'Mời thành viên qua email' })).toBeVisible();
});

test('a PROJECT_VIEWER-level role (SUB worker) cannot see the create project form', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('worker.sub@local.test');
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('không có quyền xem danh sách nhân viên')).toBeVisible();
  await expect(page.getByRole('form', { name: 'Tạo dự án' })).toHaveCount(0);
});

test('SITE_MANAGER adds a worker to the roster from the web UI', async ({ page }) => {
  const code = `W${Date.now().toString(36).toUpperCase()}`;
  await login(page, 'site.main@local.test');

  const form = page.getByRole('form', { name: 'Thêm nhân sự' });
  await form.getByLabel('Mã nhân sự').fill(code);
  await form.getByLabel('Họ và tên').fill('Nguyen Van E2E');
  await form.getByLabel('Số điện thoại').fill('0912345678');
  await form.getByRole('button', { name: 'Lưu' }).click();

  await expect(page.getByRole('status')).toContainText('Đã thêm nhân sự');
  await expect(page.getByText(`(${code})`)).toBeVisible();
});

test('PROJECT_MANAGER cannot see the worker create form (roster writes belong to site/subcontractor managers)', async ({ page }) => {
  await login(page, 'pm.main@local.test');
  await expect(page.getByRole('form', { name: 'Thêm nhân sự' })).toHaveCount(0);
});
