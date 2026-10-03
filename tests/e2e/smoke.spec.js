// @ts-check
// Browser smoke test: start a campaign, play a few days through the real UI, and check every tab renders.
const { test, expect } = require('@playwright/test');

// Web fonts may be blocked in CI sandboxes; that is not a game error.
const ignorable = text => /fonts\.(googleapis|gstatic)\.com|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|Failed to load resource/.test(text);

test.beforeEach(async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
  testInfo.attach('errors', { body: '' });
  // @ts-ignore stash for afterEach
  page._errors = errors;
});

test.afterEach(async ({ page }) => {
  // @ts-ignore
  expect(page._errors, 'no script errors on the page').toEqual([]);
});

test('starts at the difficulty picker and opens a Medium campaign', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'New campaign' })).toBeVisible();
  await page.locator('[data-act="pickdiff"][data-d="medium"]').click();
  await expect(page.locator('.dayno')).toHaveText('Day 1');
  await expect(page.getByText('Operational Command · Medium')).toBeVisible();
});

test('plays three days through the UI and every tab renders', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="pickdiff"][data-d="easy"]').click();
  for (let day = 1; day <= 3; day++) {
    await page.locator('.tabs [data-tab="deploy"]').click();
    const plan = page.locator('[data-act="plan"]:not([disabled])').first();
    if (await plan.count()) {
      await plan.click();
      await page.locator('[data-act="deploy"]:not([disabled])').first().click();
    }
    await page.locator('[data-act="end"]').click();
    const confirm = page.locator('[data-act="endconfirm"]');
    if (await confirm.count()) await confirm.click();
    await expect(page.locator('.dayno')).toHaveText(`Day ${day + 1}`);
    await expect(page.locator('details.report').first()).toBeVisible();
  }
  await page.locator('.tabs [data-tab="base"]').click();
  await expect(page.getByText('War Clock', { exact: true })).toBeVisible();
  await expect(page.getByText('Training', { exact: true })).toBeVisible();
  await page.locator('.tabs [data-tab="roster"]').click();
  await expect(page.locator('.troop').first()).toBeVisible();
});

test('troops can be put into training from the Base tab', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="pickdiff"][data-d="medium"]').click();
  await page.locator('.tabs [data-tab="base"]').click();
  const trainee = page.locator('[data-act="train"]').first();
  await trainee.click();
  await expect(trainee).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.orders-status')).toContainText('training 1');
});

test('the campaign survives a page reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="pickdiff"][data-d="hard"]').click();
  await page.locator('[data-act="end"]').click();
  const confirm = page.locator('[data-act="endconfirm"]');
  if (await confirm.count()) await confirm.click();
  await expect(page.locator('.dayno')).toHaveText('Day 2');
  await page.reload();
  await expect(page.locator('.dayno')).toHaveText('Day 2');
  await expect(page.getByText('Operational Command · Hard')).toBeVisible();
});

test('the page never scrolls sideways at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await page.locator('[data-act="pickdiff"][data-d="medium"]').click();
  for (const tab of ['debrief', 'deploy', 'base', 'roster']) {
    await page.locator(`.tabs [data-tab="${tab}"]`).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${tab} tab overflow`).toBeLessThanOrEqual(0);
  }
});
