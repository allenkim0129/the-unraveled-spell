import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';

async function start(page: Page): Promise<void> {
  await page.goto('./');
  await page.locator('#start').click();
  await expect(page.locator('#fatal-error')).toBeHidden();
}

async function holdKey(page: Page, key: string, milliseconds: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function moveUntil(page: Page, keys: string[], pattern: RegExp): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  try {
    await expect(page.locator('#interact')).toHaveText(pattern);
  } finally {
    for (const key of keys) await page.keyboard.up(key);
  }
}

async function touchPad(
  page: Page, session: CDPSession, x: number, y: number, until: RegExp | number,
): Promise<void> {
  const rect = await page.locator('#joystick').boundingBox();
  if (!rect) throw new Error('Touch movement pad is not visible');
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ id: 0, ...center }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 0, x: center.x + x * rect.width * 0.33, y: center.y - y * rect.width * 0.33 }],
  });
  try {
    if (typeof until === 'number') await page.waitForTimeout(until);
    else await expect(page.locator('#interact')).toHaveText(until);
  } finally {
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}

test('solve the first room using editing, execution, and the actual movement controls', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await start(page);
  const session = isMobile ? await page.context().newCDPSession(page) : null;
  if (session) {
    await page.locator('#sight').tap();
    await touchPad(page, session, -1, 1, /주황 마법 편집/);
    await page.locator('#interact').tap();
  } else {
    await page.keyboard.press('e');
    await moveUntil(page, ['w', 'a'], /주황 마법 편집/);
    await page.keyboard.press('f');
  }
  await expect(page.locator('#editor-title')).toHaveText('주황 · 힘 / 화염');
  await page.locator('#cut').click();
  await expect(page.locator('#stitches')).toHaveText('2 / 3');
  await expect(page.locator('#connection')).toContainText('끊어졌어요');
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#stitches')).toHaveText('2 / 3');
  await expect(page.locator('#editor-title')).toHaveText('Orange · Force / Fire');
  await expect(page.locator('#connection')).toContainText('Thread cut');
  await expect(page.locator('#sight')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toast')).toContainText('Thread cut');
  await page.locator('#language').selectOption('ko');
  await page.locator('#undo').click();
  await expect(page.locator('#stitches')).toHaveText('3 / 3');
  await expect(page.locator('#connection')).toContainText('다리 고정점');
  await page.locator('#cut').click();
  await page.locator('#close-editor').click();
  if (session) {
    await touchPad(page, session, 1, 0, /파랑 마법 편집/);
    await page.locator('#interact').tap();
    await page.locator('[data-target="mechanism"]').tap();
  } else {
    await moveUntil(page, ['d'], /파랑 마법 편집/);
    await page.keyboard.press('f');
    await page.locator('[data-target="mechanism"]').click();
  }
  await expect(page.locator('#stitches')).toHaveText('1 / 3');
  await expect(page.locator('#connection')).toContainText('다리 구동 장치');
  const executionDuration = page.evaluate(() => new Promise<number>((resolve, reject) => {
    const phase = document.querySelector('#phase');
    if (!phase) { reject(new Error('Missing timeline display')); return; }
    let startTime: number | null = null;
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Execution did not complete'));
    }, 15000);
    const observer = new MutationObserver(() => {
      if (startTime === null && phase.textContent === '시간 재개') startTime = performance.now();
      if (startTime !== null && ['다시 동결', 'Frozen again'].includes(phase.textContent ?? '')) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(performance.now() - startTime);
      }
    });
    observer.observe(phase, { childList: true, characterData: true, subtree: true });
  }));
  await page.locator('#execute').click();
  await expect(page.locator('#phase')).toHaveText('시간 재개');
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('#interact')).toBeDisabled();
  await expect(page.locator('#execute')).toBeDisabled();
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#stitches')).toHaveText('1 / 3');
  await expect(page.locator('#phase')).toHaveText('Frozen again');
  const milliseconds = await executionDuration;
  expect(milliseconds).toBeGreaterThanOrEqual(4900);
  expect(milliseconds).toBeLessThan(6500);
  await expect(page.locator('#outcome')).toContainText('bridge is safe');
  if (session) {
    const rect = await page.locator('#joystick').boundingBox();
    if (!rect) throw new Error('Missing movement pad');
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ id: 0, x: rect.x + rect.width * 0.17, y: rect.y + rect.height / 2 }],
    });
    await expect(page.locator('#interact')).toHaveAttribute('data-nearby', '');
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touchPad(page, session, 0, 1, 4300);
  } else {
    await page.keyboard.down('a');
    await expect(page.locator('#interact')).toHaveAttribute('data-nearby', '');
    await page.keyboard.up('a');
    await holdKey(page, 'w', 4300);
  }
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#phase')).toHaveText('Restored');
  await page.locator('#language').selectOption('ko');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#phase')).toHaveText('복구 완료');
  await page.locator('#replay').click();
  await expect(page.locator('#stitches')).toHaveText('3 / 3');
  await expect(page.locator('#phase')).toHaveText('동결 · 편집');
  await expect(page.locator('#success')).toBeHidden();
  await expect(page.locator('#sight')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('observe the unedited catastrophe and reset a running attempt without stale effects', async ({ page }) => {
  await start(page);
  await page.locator('#execute').click();
  await expect(page.locator('#phase')).toHaveText('다시 동결');
  await expect(page.locator('#outcome')).toContainText('고정점을 파괴했고');
  await expect(page.locator('#success')).toBeHidden();
  await page.locator('#reset').click();
  await page.locator('#execute').click();
  await page.waitForTimeout(300);
  await page.locator('#reset').click();
  await page.waitForTimeout(5200);
  await expect(page.locator('#phase')).toHaveText('동결 · 편집');
  await expect(page.locator('#stitches')).toHaveText('3 / 3');
  await expect(page.locator('#execute')).toBeEnabled();
  await expect(page.locator('#execution-bar')).toBeHidden();
});

test('touch movement remains captured during an unrelated scene touch and clears on cancel', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real multitouch is validated in the touch-enabled mobile context');
  await start(page);
  const session = await page.context().newCDPSession(page);
  const rect = await page.locator('#joystick').boundingBox();
  if (!rect) throw new Error('Missing joystick');
  const stick = { id: 0, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 - 20 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
  await expect(page.locator('#knob')).toHaveAttribute('style', /translate/);
  const initial = await page.locator('#knob').getAttribute('style');
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [stick, { id: 1, x: 200, y: 260 }],
  });

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [stick, { id: 1, x: 240, y: 280 }],
  });
  expect(await page.locator('#knob').getAttribute('style')).toBe(initial);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await page.locator('#knob').evaluate((element) => element.style.transform)).toBe('');
  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(sizes.scrollWidth).toBe(sizes.width);
  expect(sizes.scrollHeight).toBe(sizes.height);
});

test('welcome screen and unavailable-WebGL errors support both languages', async ({ page }) => {
  await page.goto('./');
  await page.locator('#intro-language').selectOption('en');
  await expect(page.locator('#intro-title')).toContainText('Time stands still');
  await expect(page.locator('#start')).toHaveText('Enter the chamber →');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.addInitScript(`
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (kind === 'webgl' || kind === 'webgl2') return null;
      return original.call(this, kind, ...args);
    };
  `);
  await page.reload();
  await expect(page.locator('#fatal-error')).toBeVisible();
  await expect(page.locator('#fatal-message')).toContainText('3D renderer could not start');
  await page.locator('#fatal-language').selectOption('ko');
  await expect(page.locator('#fatal-message')).toContainText('3D 렌더러를 시작할 수 없어요');
});

test('bird-eye camera stays fixed when the scene is dragged and both languages explain the controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  const canvas = page.locator('#scene canvas');
  await expect(canvas).toHaveAttribute('data-view', 'fixed-bird-eye');
  await expect(canvas).toHaveAttribute('aria-label', /고정 버드아이/);
  await page.waitForTimeout(4600);
  const before = await canvas.screenshot();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Scene is not visible');
  await page.mouse.move(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.4, { steps: 8 });
  await page.mouse.up();
  expect((await canvas.screenshot()).equals(before)).toBe(true);
  await page.locator('#language').selectOption('en');
  await expect(canvas).toHaveAttribute('aria-label', /fixed bird-eye view/);
  await page.locator('#help').click();
  await expect(page.locator('.intro-controls')).toContainText('No camera controls needed');
  await page.locator('#intro-language').selectOption('ko');
  await expect(page.locator('.intro-controls')).toContainText('시점 조작은 필요 없어요');
});
