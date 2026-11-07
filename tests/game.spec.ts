import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function begin(page: Page, book = true): Promise<void> {
  await page.goto('./');
  await expect(page).toHaveTitle('Magical Time');
  await page.locator('#student-name').fill('Mina');
  await page.locator('#start').click();
  await expect(page.locator('#story-title')).toContainText('여신');
  await page.locator('[data-choice="continue"]').click();
  if (book) {
    await expect(page.locator('#interact')).toHaveAttribute('data-interaction', 'book');
    await page.locator('#interact').click();
    await page.locator('[data-choice="continue"]').click();
  }
}

async function move(
  page: Page, mobile: boolean, x: number, y: number,
  target: { interaction: string } | { chapter: string } | { position: { x?: number; z?: number } },
): Promise<void> {
  const keys = [x < 0 ? 'a' : x > 0 ? 'd' : '', y < 0 ? 's' : y > 0 ? 'w' : ''].filter(Boolean);
  const session = mobile ? await page.context().newCDPSession(page) : null;
  if ('position' in target) {
    await page.evaluate(({ position, keys, mobile }) => {
      const scene = document.getElementById('scene');
      const stick = document.getElementById('joystick');
      if (!scene || !stick) throw new Error('Missing movement UI');
      let pointer: number | null = null;
      if (mobile) stick.addEventListener('pointerdown', (event) => { pointer = event.pointerId; }, { once: true });
      const observer = new MutationObserver(() => {
        const reached = (position.x === undefined || Math.abs(Number(scene.dataset.playerX) - position.x) < 0.15) &&
          (position.z === undefined || Math.abs(Number(scene.dataset.playerZ) - position.z) < 0.15);
        if (!reached) return;
        if (pointer !== null) stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: pointer }));
        else for (const key of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code: `Key${key.toUpperCase()}` }));
        observer.disconnect();
      });
      observer.observe(scene, { attributes: true, attributeFilter: ['data-player-x', 'data-player-z'] });
    }, { position: target.position, keys, mobile });
  }
  if (session) {
    if ('interaction' in target) {
      await page.evaluate((interaction) => {
        const stick = document.getElementById('joystick');
        const button = document.getElementById('interact');
        if (!stick || !button) throw new Error('Missing movement UI');
        let pointer: number | null = null;
        stick.addEventListener('pointerdown', (event) => { pointer = event.pointerId; }, { once: true });
        // Stop at the first proximity update, before software-WebGL assertion polling overshoots it.
        const observer = new MutationObserver(() => {
          if (pointer !== null && button.dataset.interaction === interaction) {
            stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: pointer }));
            observer.disconnect();
          }
        });
        observer.observe(button, { attributes: true, attributeFilter: ['data-interaction'] });
        stick.addEventListener('pointerup', () => observer.disconnect(), { once: true });
      }, target.interaction);
    }
    const bounds = await page.locator('#joystick').boundingBox();
    if (!bounds) throw new Error('Missing touch pad');
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...center }] });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 0, x: center.x + x * bounds.width * 0.33, y: center.y - y * bounds.width * 0.33 }],
    });
  } else {
    for (const key of keys) await page.keyboard.down(key);
  }
  try {
    if ('interaction' in target) await expect(page.locator('#interact')).toHaveAttribute('data-interaction', target.interaction);
    else if ('chapter' in target) await expect(page.locator('#scene')).toHaveAttribute('data-chapter', target.chapter);
    else await expect.poll(() => page.locator('#scene').evaluate((element, position) =>
      (position.x === undefined || Math.abs(Number((element as HTMLElement).dataset.playerX) - position.x) < 0.15) &&
      (position.z === undefined || Math.abs(Number((element as HTMLElement).dataset.playerZ) - position.z) < 0.15),
    target.position)).toBe(true);
  } finally {
    if (session) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    } else for (const key of keys) await page.keyboard.up(key);
  }
}

async function solveBridge(page: Page, mobile: boolean): Promise<void> {
  await page.locator('#sight').click();
  await move(page, mobile, -1, 1, { interaction: 'force' });
  await page.locator('#interact').click();
  await page.locator('#cut').click();
  await expect(page.locator('#stitches')).toHaveText('2 / 3');
  await page.locator('#undo').click();
  await expect(page.locator('#stitches')).toHaveText('3 / 3');
  await page.locator('#cut').click();
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#connection')).toContainText('Thread cut');
  await expect(page.locator('#stitches')).toHaveText('2 / 3');
  await page.locator('#close-editor').click();
  await move(page, mobile, 1, 0, { interaction: 'motion' });
  await page.locator('#interact').click();
  await page.locator('[data-target="mechanism"]').click();
  await expect(page.locator('#stitches')).toHaveText('1 / 3');
  await page.locator('#execute').click();
  await expect(page.locator('#phase')).toHaveText('Spells unfolding');
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('#interact')).toBeDisabled();
  await expect(page.locator('#phase')).toHaveText('Execution complete');
  await expect(page.locator('#outcome')).toContainText('continue the journey');
  await expect(page.locator('#success')).toBeHidden();
  await move(page, mobile, -1, 0, { position: { x: 0 } });
  await move(page, mobile, 0, 1, { chapter: 'path' });
  await expect(page.locator('#success')).toBeHidden();
}

test('play the full adventure with memories, ordinary casting, source discoveries and emotional restoration', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await begin(page);
  await page.locator('#journal').click();
  await page.locator('[data-choice="remember"]').click();
  await page.locator('[data-choice="continue"]').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-chapter', 'memory');
  await page.screenshot({ path: test.info().outputPath('memory.png') });
  await move(page, isMobile, 0, 1, { interaction: 'friend' });
  await page.locator('#interact').click();
  await page.locator('[data-choice="suppress"]').click();
  await expect(page.locator('#story-error')).toContainText('슬픔을 지우는 주문');
  await page.locator('[data-choice="honest"]').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-chapter', 'academy');
  await expect(page.locator('#success')).toBeHidden();
  await solveBridge(page, isMobile);
  await move(page, isMobile, 0, 1, { interaction: 'ward' });
  await page.locator('#interact').click();
  await page.locator('#cast-word').selectOption('Umbra');
  for (const direction of ['up', 'right', 'up']) await page.locator(`[data-gesture="${direction}"]`).click();
  await page.locator('[data-choice="cast"]').click();
  await expect(page.locator('#story-error')).toContainText('incorrect');
  await page.locator('#story-language').selectOption('ko');
  await expect(page.locator('#gesture-sequence')).toHaveText('↑ → ↑');
  await expect(page.locator('#cast-word')).toHaveValue('Umbra');
  await page.locator('#cast-word').selectOption('Lumen');
  await page.locator('[data-choice="cast"]').click();
  await move(page, isMobile, 0, 1, { chapter: 'source' });
  await expect(page.locator('#success')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('source.png') });
  await move(page, isMobile, -1, 1, { interaction: 'reason' });
  await page.locator('#interact').click();
  await expect(page.locator('#story-draft')).toBeVisible();
  await page.locator('[data-choice="continue"]').click();
  await move(page, isMobile, 0, 1, { position: { z: 2 } });
  await move(page, isMobile, 1, 0, { interaction: 'motive' });
  await page.locator('#interact').click();
  await expect(page.locator('#story-body')).toContainText('용서');
  await page.locator('[data-choice="continue"]').click();
  await move(page, isMobile, -1, 0, { position: { x: 0 } });
  await move(page, isMobile, 0, 1, { interaction: 'source' });
  await page.locator('#interact').click();
  await page.locator('[data-choice="power"]').click();
  await expect(page.locator('#story-error')).toContainText('억지 행복');
  await page.locator('[data-choice="connection"]').click();
  await expect(page.locator('#success')).toBeVisible();
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#ending-call')).toContainText('Mina');
  await expect(page.locator('.success-card blockquote')).toContainText(
    'I thought saving the world meant becoming powerful enough to stand alone. It meant learning why I never wanted to.',
  );
  await page.screenshot({ path: test.info().outputPath('ending.png') });
  await page.locator('#language').selectOption('ko');
  await expect(page.locator('#success')).toBeVisible();
  await page.locator('#replay').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-chapter', 'academy');
  await expect(page.locator('#success')).toBeHidden();
  await page.locator('[data-choice="continue"]').click();
  await expect(page.locator('#execute')).toBeDisabled();
  await expect(page.locator('#interact')).toHaveAttribute('data-interaction', 'book');
  expect(errors).toEqual([]);
});

test('book is required and a room reset preserves adventure knowledge while clearing execution', async ({ page }) => {
  await begin(page, false);
  await expect(page.locator('#execute')).toBeDisabled();
  await page.keyboard.press('Space');
  await expect(page.locator('#toast')).toContainText('마법서');
  await page.locator('#interact').click();
  await page.locator('[data-choice="continue"]').click();
  await page.locator('#execute').click();
  await expect(page.locator('#phase')).toHaveText('실행 완료');
  await expect(page.locator('#outcome')).toContainText('고정점을 파괴했고');
  await expect(page.locator('#success')).toBeHidden();
  await page.locator('#reset').click();
  await expect(page.locator('#execute')).toBeEnabled();
  await expect(page.locator('#stitches')).toHaveText('3 / 3');
  await page.locator('#execute').click();
  await page.locator('#reset').click();
  await page.waitForTimeout(5300);
  await expect(page.locator('#phase')).toHaveText('마법 대기 · 편집');
  await expect(page.locator('#execution-bar')).toBeHidden();
});

test('memories preserve edits and position on returning to the silent present', async ({ page, isMobile }) => {
  await begin(page);
  await page.locator('#sight').click();
  await move(page, isMobile, -1, 1, { interaction: 'force' });
  await page.locator('#interact').click();
  await page.locator('#cut').click();
  await page.locator('#journal').click();
  await page.locator('[data-choice="remember"]').click();
  await page.locator('[data-choice="continue"]').click();
  await expect(page.locator('#ambient-caption')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ambient-caption')).toContainText(/수업|지팡이|자리를/);
  await move(page, isMobile, 0, 1, { interaction: 'friend' });
  await page.locator('#interact').click();
  await page.locator('[data-choice="honest"]').click();
  await expect(page.locator('#stitches')).toHaveText('2 / 3');
  await expect(page.locator('#ambient-caption')).toBeHidden();
  await expect(page.locator('#interact')).toHaveAttribute('data-interaction', 'force');
  await page.locator('#interact').click();
  await expect(page.locator('#connection')).toContainText('끊어졌어요');
  await expect(page.locator('#sight')).toHaveAttribute('aria-pressed', 'true');
});

test('welcome and renderer errors retain bilingual support and the confirmed title', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Magical Time');
  await page.locator('#intro-language').selectOption('en');
  await expect(page.locator('#intro-title')).toContainText('Humanity stands still');
  await expect(page.locator('.intro-controls')).toContainText('No camera controls needed');
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

test('fixed camera and multitouch cancellation remain available', async ({ page, isMobile }) => {
  await begin(page);
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-view', 'fixed-bird-eye');
  if (!isMobile) return;
  const session = await page.context().newCDPSession(page);
  const bounds = await page.locator('#joystick').boundingBox();
  if (!bounds) throw new Error('Missing joystick');
  const point = { id: 0, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 - 20 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  const style = await page.locator('#knob').getAttribute('style');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, { id: 1, x: 200, y: 260 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point, { id: 1, x: 240, y: 280 }] });
  expect(await page.locator('#knob').getAttribute('style')).toBe(style);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await page.locator('#knob').evaluate((element) => element.style.transform)).toBe('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test('audio unlock, independent volumes, missing-local-voice notices and settings preserve progress', async ({ page }) => {
  await page.addInitScript(() => {
    class NoLocalVoices extends EventTarget {
      getVoices(): SpeechSynthesisVoice[] { return []; }
      cancel(): void {}
      speak(): void { throw new Error('Must not substitute a remote or unsupported-language voice'); }
    }
    Object.defineProperty(window, 'speechSynthesis', { value: new NoLocalVoices() });
  });
  await begin(page);
  await page.locator('#audio-settings').click();
  await expect(page.locator('#audio-status')).toContainText('기기 내장 음성이 없습니다');
  await page.locator('#volume-effects').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#value-effects')).toHaveText('0%');
  await expect(page.locator('#volume-ambience')).toHaveValue('20');
  await expect(page.locator('#volume-voice')).toHaveValue('75');
  await page.locator('#volume-ambience').focus();
  await page.keyboard.press('Home');
  await page.locator('#volume-voice').focus();
  await page.keyboard.press('Home');
  await page.locator('#audio-language').selectOption('en');
  await expect(page.locator('#audio-status')).toContainText('No device-local voice');
  for (const channel of ['effects', 'ambience', 'voice']) await expect(page.locator(`#volume-${channel}`)).toHaveValue('0');
  await page.locator('#audio-toggle').click();
  await expect(page.locator('#audio-status')).toContainText('Sound is off');
  await page.locator('#audio-toggle').click();
  await expect(page.locator('#audio-status')).toContainText('No device-local voice');
  await page.locator('#close-audio').click();
  await page.locator('#execute').click();
  await expect(page.locator('#phase')).toHaveText('Spells unfolding');
  await page.locator('#audio-settings').click();
  const elapsed = await page.locator('#progress').evaluate((element: HTMLProgressElement) => element.value);
  await page.waitForTimeout(600);
  expect(await page.locator('#progress').evaluate((element: HTMLProgressElement) => element.value)).toBe(elapsed);
  await page.locator('#close-audio').click();
  await expect(page.locator('#phase')).toHaveText('Execution complete');
  await expect(page.locator('#ambient-caption')).toBeHidden();
  await expect(page.locator('#success')).toBeHidden();
});
