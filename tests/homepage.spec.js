import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const destinations = [
  ['Lietuvos atlasas', 'Explore the atlas', 'https://atlasas.adrianmoroz.lt/'],
  ['The Last Disciple', 'Play The Last Disciple', 'https://spooky.adrianmoroz.lt/'],
];

function activeProject(page) {
  return page.getByRole('article').getByRole('heading', { level: 3 });
}

function projectChoices(page) {
  return page.getByRole('group', { name: 'Choose a project' }).getByRole('button');
}

async function rotationInterval(page) {
  return Number(await page.locator('[data-carousel]').getAttribute('data-interval'));
}

test('introduces Adrian and shows both illustrated project links without JavaScript', async ({ browser, baseURL }) => {
  const page = await browser.newPage({ baseURL, javaScriptEnabled: false });
  try {
    await page.goto('/');
    await expect(page).toHaveTitle('Adrian Moroz | Projects');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adrian Moroz.');
    await expect(page.locator('body')).not.toContainText(/lorem ipsum/i);

    for (const [name, linkText, url] of destinations) {
      const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
      await expect(card.getByRole('paragraph').filter({ hasText: /\S/ })).toBeVisible();
      await expect(card.getByRole('img')).toBeVisible();
      await expect(card.getByRole('img')).toHaveJSProperty('complete', true);
      expect(await card.getByRole('img').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
      await expect(card.getByRole('link', { name: linkText, exact: true })).toHaveAttribute('href', url);
    }

    await expect(page.getByRole('button', { name: 'Next project' })).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test('wraps with the arrow buttons and supports keyboard navigation and named project selection', async ({ page }) => {
  await page.goto('/');
  const previous = page.getByRole('button', { name: 'Previous project' });
  const next = page.getByRole('button', { name: 'Next project' });
  const choices = projectChoices(page);
  const titles = await choices.allTextContents();
  const first = titles[0];
  const last = titles.at(-1);

  await expect(activeProject(page)).toHaveText(first);
  await previous.click();
  await expect(activeProject(page)).toHaveText(last);
  await expect(previous).toBeFocused();
  await expect(page.getByRole('status')).toHaveText(`${last} (${titles.length} of ${titles.length})`);
  await expect(page.getByRole('link', { name: 'Explore the atlas' })).toHaveCount(0);

  await previous.press('ArrowRight');
  await expect(activeProject(page)).toHaveText(first);
  await choices.last().click();
  await expect(choices.last()).toHaveAttribute('aria-current', 'true');
  await expect(activeProject(page)).toHaveText(last);
  await next.click();
  await expect(activeProject(page)).toHaveText(first);
});

async function freezeClock(page) {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1_000);
}

async function interactBeforeEnhancement(page, interact) {
  let releaseScript;
  const scriptGate = new Promise((resolve) => { releaseScript = resolve; });
  await page.route('**/assets/carousel.js', async (route) => {
    await scriptGate;
    await route.continue();
  });

  try {
    await page.goto('/', { waitUntil: 'commit' });
    await interact();
  } finally {
    releaseScript();
  }
  await page.waitForLoadState('load');
}

test('rotates on schedule and lets visitors pause and restart it', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  const interval = await rotationInterval(page);
  const titles = await projectChoices(page).allTextContents();
  await page.clock.runFor(interval - 1);
  await expect(activeProject(page)).toHaveText(titles[0]);
  await page.clock.runFor(1);
  await expect(activeProject(page)).toHaveText(titles[1]);
  await expect(page.getByRole('status')).toBeEmpty();

  await page.getByRole('button', { name: 'Pause autoplay' }).click();
  await page.clock.runFor(interval + 1);
  await expect(activeProject(page)).toHaveText(titles[1]);

  await page.getByRole('button', { name: 'Start autoplay' }).click();
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText(titles[2 % titles.length]);
});

test('uses a new project article and a custom interval without JavaScript changes', async ({ page, baseURL }) => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const newProject = '<article data-carousel-slide><h3>Example project</h3></article>';
  const fixture = html.replace(/data-interval="\d+"/, 'data-interval="2000"')
    .replace(/<article\b.*?<\/article>/s, `$&\n${newProject}`);

  await page.route(new URL('/', baseURL).href, (route) => route.fulfill({ contentType: 'text/html', body: fixture }));
  await freezeClock(page);
  await page.goto('/');
  await page.clock.runFor(1_999);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');
  await page.clock.runFor(1);
  await expect(activeProject(page)).toHaveText('Example project');
  await expect(page.getByRole('button', { name: 'Example project' })).toHaveAttribute('aria-current', 'true');
});

test('does not rotate while a visitor hovers over the project', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  const interval = await rotationInterval(page);
  await page.getByRole('img', { name: /grey seal/ }).hover();
  await page.clock.runFor(interval + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');

  await page.mouse.move(0, 0);
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText('The Last Disciple');
});

test('pauses on keyboard focus and does not hide a focused link or restart on blur', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  const interval = await rotationInterval(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Start autoplay' })).toBeFocused();

  for (let index = 0; index < 3; index++) await page.keyboard.press('Tab');
  const link = page.getByRole('link', { name: 'Explore the atlas' });
  await expect(link).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(interval + 1);
  await expect(link).toBeFocused();

  await page.getByRole('heading', { level: 1 }).click();
  await expect(link).not.toBeFocused();
  await page.clock.runFor(interval + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');
});

test('keeps a project link focused if the visitor reached it before the script loaded', async ({ page }) => {
  await freezeClock(page);
  const game = page.getByRole('link', { name: 'Play The Last Disciple' });

  await interactBeforeEnhancement(page, async () => {
    await expect(game).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(game).toBeFocused();
  });

  await expect(activeProject(page)).toHaveText('The Last Disciple');
  await expect(game).toBeFocused();
  await expect(page.getByRole('button', { name: 'Start autoplay' })).toBeVisible();
  await page.clock.runFor((await rotationInterval(page)) + 1);
  await expect(game).toBeFocused();
});

test('does not rotate under a pointer that was already hovering when the script loaded', async ({ page }) => {
  await freezeClock(page);
  await interactBeforeEnhancement(page, async () => {
    await page.getByRole('img', { name: /grey seal/ }).hover();
  });

  const interval = await rotationInterval(page);
  await page.clock.runFor(interval + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');
  await page.mouse.move(0, 0);
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText('The Last Disciple');
});

test('starts paused for reduced motion unless the visitor opts in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await freezeClock(page);
  await page.goto('/');
  const interval = await rotationInterval(page);
  await page.clock.runFor(interval + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');

  await page.getByRole('button', { name: 'Start autoplay' }).click();
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText('The Last Disciple');
});

test('stops rotation if the motion preference changes to reduced', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Pause autoplay' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Start autoplay' })).toBeVisible();
  await page.clock.runFor((await rotationInterval(page)) + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');
});

test('animates slide changes only when reduced motion is not requested', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Next project' }).click();
  const cover = page.getByRole('img', { name: /stone courtyard/ });
  const animationName = () => cover.evaluate((image) => getComputedStyle(image).animationName);
  expect(await animationName()).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animationName()).toBe('none');
});

test('keeps both project choices above the fold on a desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const game = page.getByRole('button', { name: 'The Last Disciple', exact: true });
  const frame = await page.getByRole('main').boundingBox();
  await expect(game).toBeInViewport({ ratio: 1 });
  expect(frame.y + frame.height).toBeLessThan(900);
});

test.describe('on a narrow touch screen', () => {
  test.use({ viewport: { width: 320, height: 720 }, hasTouch: true, isMobile: true });

  test('keeps usable arrow buttons over opposite sides of the image', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const previous = page.getByRole('button', { name: 'Previous project' });
    const next = page.getByRole('button', { name: 'Next project' });
    const cover = page.getByRole('img', { name: /grey seal/ });
    const [left, right, image] = await Promise.all([previous.boundingBox(), next.boundingBox(), cover.boundingBox()]);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    for (const button of [left, right]) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.y).toBeGreaterThan(image.y);
      expect(button.y + button.height).toBeLessThan(image.y + image.height);
    }
    expect(left.x).toBeGreaterThanOrEqual(image.x);
    expect(left.x + left.width).toBeLessThan(image.x + image.width / 2);
    expect(right.x).toBeGreaterThan(image.x + image.width / 2);
    expect(right.x + right.width).toBeLessThanOrEqual(image.x + image.width);

    await next.tap();
    await expect(activeProject(page)).toHaveText('The Last Disciple');
  });

  test('keeps the same link when a touch spans an autoplay tick', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await freezeClock(page);
    await page.route('https://*.adrianmoroz.lt/**', (route) => route.fulfill({ status: 200, body: 'Project destination' }));
    await page.goto('/');

    const atlas = page.getByRole('link', { name: 'Explore the atlas' });
    await atlas.scrollIntoViewIfNeeded();
    const target = await atlas.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await page.clock.runFor((await rotationInterval(page)) - 100);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }],
    });
    await page.clock.runFor(200);
    await expect(atlas).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page).toHaveURL(destinations[0][2]);
  });
});
