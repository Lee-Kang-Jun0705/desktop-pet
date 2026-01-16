import { test, expect } from '@playwright/test';

test.describe('Desktop Pet E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.pet-container', { timeout: 10000 });
  });

  test('should render pet container', async ({ page }) => {
    const petContainer = page.locator('.pet-container');
    await expect(petContainer).toBeVisible();
  });

  test('should render sprite animation', async ({ page }) => {
    const sprite = page.locator('.sprite');
    await expect(sprite).toBeVisible();
    await expect(sprite).toHaveCSS('background-image', /url/);
  });

  test('should show status notice', async ({ page }) => {
    const statusNotice = page.locator('.interact-mode-notice');
    await expect(statusNotice).toBeVisible();
    await expect(statusNotice).toContainText('클릭 통과');
  });

  test('should show mode buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("자동")')).toBeVisible();
    await expect(page.locator('button:has-text("ON")')).toBeVisible();
    await expect(page.locator('button:has-text("OFF")')).toBeVisible();
  });

  test('should change mode when button clicked', async ({ page }) => {
    const onButton = page.locator('button:has-text("ON")');
    await onButton.click();
    await expect(onButton).toHaveClass(/active/);
  });

  test('should show context menu on right click', async ({ page }) => {
    const petContainer = page.locator('.pet-container');
    await petContainer.click({ button: 'right' });

    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu).toContainText('Stone Guardian');
  });

  test('should have attack button in context menu', async ({ page }) => {
    const petContainer = page.locator('.pet-container');
    await petContainer.click({ button: 'right' });

    const attackButton = page.locator('.menu-item:has-text("공격!")');
    await expect(attackButton).toBeVisible();
  });

  test('should have run button in context menu', async ({ page }) => {
    const petContainer = page.locator('.pet-container');
    await petContainer.click({ button: 'right' });

    const runButton = page.locator('.menu-item:has-text("달려!")');
    await expect(runButton).toBeVisible();
  });

  test('should close context menu when clicking outside', async ({ page }) => {
    const petContainer = page.locator('.pet-container');
    await petContainer.click({ button: 'right' });

    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();

    await page.click('body', { position: { x: 10, y: 10 } });
    await expect(contextMenu).not.toBeVisible();
  });

  test('should animate sprite frames', async ({ page }) => {
    const sprite = page.locator('.sprite');
    const initialBgPos = await sprite.evaluate((el) => getComputedStyle(el).backgroundPosition);

    await page.waitForTimeout(500);

    const newBgPos = await sprite.evaluate((el) => getComputedStyle(el).backgroundPosition);
    expect(initialBgPos).not.toBe(newBgPos);
  });

  test('should show state indicator', async ({ page }) => {
    const stateIndicator = page.locator('.state-indicator');
    await expect(stateIndicator).toBeVisible();
    await expect(stateIndicator).toContainText(/idle|walk|run|attack/i);
  });
});
