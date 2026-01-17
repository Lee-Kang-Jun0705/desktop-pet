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

  test('should show mode buttons', async ({ page }) => {
    const controlPanel = page.locator('.control-panel');
    await expect(controlPanel.getByRole('button', { name: '자동' })).toBeVisible();
    await expect(controlPanel.getByRole('button', { name: 'ON' })).toBeVisible();
    await expect(controlPanel.getByRole('button', { name: 'OFF' })).toBeVisible();
  });

  test('should change mode when button clicked', async ({ page }) => {
    const onButton = page.locator('.control-panel').getByRole('button', { name: 'ON' });
    await onButton.click();
    await expect(onButton).toHaveClass(/active/);
  });

  test('should show context menu on right click', async ({ page }) => {
    const petContainer = page.locator('.pet-container');
    await petContainer.click({ button: 'right' });

    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu).toContainText('스톤 가디언');
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

  test('should add iron fist master from control panel', async ({ page }) => {
    const addSection = page.locator('.control-section', { hasText: '캐릭터 추가' });
    await addSection.locator('button', { hasText: '철장 무승' }).click();

    await expect(page.locator('.pet-container')).toHaveCount(2);
    await expect(page.locator('.control-section', { hasText: '캐릭터 변경' }))
      .toContainText('철장 무승');
  });

  test('should change character for selected pet', async ({ page }) => {
    const changeSection = page.locator('.control-section', { hasText: '캐릭터 변경' });
    await changeSection.locator('button', { hasText: '철장 무승' }).click();
    await expect(changeSection).toContainText('철장 무승');

    await changeSection.locator('button', { hasText: '스톤 가디언' }).click();
    await expect(changeSection).toContainText('스톤 가디언');
  });

  test('should change scale via control panel slider', async ({ page }) => {
    const slider = page.locator('input.scale-slider');
    await slider.evaluate((el) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '150');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(page.locator('.control-section', { hasText: '크기:' }))
      .toContainText('150%');
  });
});
