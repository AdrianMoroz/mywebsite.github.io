import { expect, test } from '@playwright/test';
import { projects, rotationIntervalMs } from '../src/projects.js';

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

async function waitForCarousel(page) {
  await expect(page.getByRole('button', { name: 'Next project' })).toBeVisible();
}

async function openCarousel(page) {
  await page.goto('/');
  await waitForCarousel(page);
}

async function rotationInterval(page) {
  return Number(await page.locator('[data-carousel]').getAttribute('data-interval'));
}

test('serves prerendered project links alongside the built browser module', async ({ request }) => {
  const response = await request.get('/');
  await expect(response).toBeOK();
  const html = await response.text();
  const script = html.match(/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="([^"]+)")[^>]*>/)?.[1] ?? '';

  expect(script).toMatch(/^\/assets\/[^/]+\.js$/);
  expect(html).not.toContain('<!--app-html-->');
  for (const [, , url] of destinations) expect(html).toContain(`href="${url}"`);
  await expect(await request.get(script)).toBeOK();
});

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
  await openCarousel(page);
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
  await page.route((url) => /^\/assets\/[^/]+\.js$/.test(url.pathname), async (route) => {
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
  await waitForCarousel(page);
}

test('adds React interactions without replacing the prerendered nodes or logging errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const heading = page.getByRole('heading', { level: 1 });
  let prerenderedHeading;
  await interactBeforeEnhancement(page, async () => {
    await expect(heading).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(projects.length);
    prerenderedHeading = await heading.elementHandle();
  });

  await page.getByRole('button', { name: 'Next project' }).click();
  await expect(activeProject(page)).toHaveText(projects[1].title);
  expect(await prerenderedHeading.evaluate((node) => node === document.querySelector('h1'))).toBe(true);
  expect(errors).toEqual([]);
});

test('rotates on schedule and lets visitors pause and restart it', async ({ page }) => {
  await freezeClock(page);
  await openCarousel(page);
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

test('renders the picker, cards, links, and timing from one configuration', async ({ page }) => {
  await openCarousel(page);
  const choices = projectChoices(page);
  await expect(choices).toHaveText(projects.map((project) => project.title));
  expect(await rotationInterval(page)).toBe(rotationIntervalMs);
  for (const [index, project] of projects.entries()) {
    await choices.nth(index).click();
    await expect(activeProject(page)).toHaveText(project.title);
    await expect(page.getByRole('link', { name: project.linkLabel })).toHaveAttribute('href', project.url);
  }
});

test('does not rotate while a visitor hovers over the project', async ({ page }) => {
  await freezeClock(page);
  await openCarousel(page);
  const interval = await rotationInterval(page);
  await page.getByRole('img', { name: /grey seal/ }).hover();
  await page.clock.runFor(interval + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');

  await page.mouse.move(0, 0);
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText('The Last Disciple');
});

test('keeps autoplay running after a quick pointer crossing', async ({ page }) => {
  await freezeClock(page);
  await openCarousel(page);
  const interval = await rotationInterval(page);

  // Keep both inputs in one browser task to reproduce batched state updates.
  await page.locator('.carousel__viewport').evaluate((viewport) => {
    for (const type of ['pointerenter', 'pointerleave']) {
      viewport.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse' }));
    }
  });

  await expect(page.getByRole('button', { name: 'Pause autoplay' })).toBeVisible();
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText('The Last Disciple');
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText(projects[2 % projects.length].title);
});

test('pauses on keyboard focus and does not hide a focused link or restart on blur', async ({ page }) => {
  await freezeClock(page);
  await openCarousel(page);
  const interval = await rotationInterval(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Buy me a coffee', exact: true })).toBeFocused();
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

test('does not hide a link focused immediately after an autoplay tick', async ({ page }) => {
  await freezeClock(page);
  await openCarousel(page);
  const interval = await rotationInterval(page);
  await page.getByRole('button', { name: 'Pause autoplay' }).click();

  // Focus the displayed link before the timer task yields to asynchronous rendering.
  await page.evaluate((interval) => {
    for (const method of ['setTimeout', 'setInterval']) {
      const schedule = window[method];
      window[method] = (callback, delay, ...args) => schedule(
        delay === interval ? (...params) => {
          callback(...params);
          const link = document.querySelector('article:not([hidden]) a');
          link.focus();
          window.focusedAfterTick = link.href;
        } : callback,
        delay,
        ...args,
      );
    }
  }, interval);

  await page.getByRole('button', { name: 'Start autoplay' }).click();
  await page.clock.runFor(interval);
  const target = await page.evaluate(() => window.focusedAfterTick);
  expect(target).toBeDefined();
  const link = page.getByRole('article').getByRole('link');
  await expect(link).toHaveAttribute('href', target);
  await expect(link).toBeFocused();
  await page.clock.runFor(interval);
  await expect(link).toHaveAttribute('href', target);
});

test('keeps a project link focused if the visitor reached it before the script loaded', async ({ page }) => {
  await freezeClock(page);
  const game = page.getByRole('link', { name: 'Play The Last Disciple' });

  await interactBeforeEnhancement(page, async () => {
    await expect(game).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Buy me a coffee', exact: true })).toBeFocused();
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
  await openCarousel(page);
  const interval = await rotationInterval(page);
  await page.clock.runFor(interval + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');

  await page.getByRole('button', { name: 'Start autoplay' }).click();
  await page.clock.runFor(interval);
  await expect(activeProject(page)).toHaveText('The Last Disciple');
});

test('stops rotation if the motion preference changes to reduced', async ({ page }) => {
  await freezeClock(page);
  await openCarousel(page);
  await expect(page.getByRole('button', { name: 'Pause autoplay' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Start autoplay' })).toBeVisible();
  await page.clock.runFor((await rotationInterval(page)) + 1);
  await expect(activeProject(page)).toHaveText('Lietuvos atlasas');
});

test('animates slide changes only when reduced motion is not requested', async ({ page }) => {
  await openCarousel(page);
  await page.getByRole('button', { name: 'Next project' }).click();
  const cover = page.getByRole('img', { name: /stone courtyard/ });
  const animationName = () => cover.evaluate((image) => getComputedStyle(image).animationName);
  expect(await animationName()).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animationName()).toBe('none');
});

test('keeps both project choices above the fold on a desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCarousel(page);
  const game = page.getByRole('button', { name: 'The Last Disciple', exact: true });
  const frame = await page.getByRole('main').boundingBox();
  await expect(game).toBeInViewport({ ratio: 1 });
  expect(frame.y + frame.height).toBeLessThan(900);
});

test.describe('on a narrow touch screen', () => {
  test.use({ viewport: { width: 320, height: 720 }, hasTouch: true, isMobile: true });

  test('keeps usable arrow buttons over opposite sides of the image', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openCarousel(page);
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
    await openCarousel(page);

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
