import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// EV-03: the core loop and backup behavior in the production build (roadmap stage 0 gate).

/** Collects anything that should fail the run: errors, failed requests and online-import calls. */
const watch = (page: Page): string[] => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) problems.push(`api: ${request.url()}`);
  });
  page.on('response', (response) => {
    // Licensed fonts are optional: the build falls back to system fonts when they are unavailable.
    if (response.status() >= 400 && !new URL(response.url()).pathname.startsWith('/fonts/'))
      problems.push(`${response.status()}: ${response.url()}`);
  });
  // Restoring a backup asks for confirmation with a native prompt.
  page.on('dialog', (dialog) => dialog.accept());
  return problems;
};

const go = (page: Page, destination: string) =>
  page.getByRole('navigation').getByRole('button', { name: destination, exact: true }).click();

/** Phone has a header settings button; the wider layout lists Settings & backup in its navigation. */
const openSettings = (page: Page) =>
  page
    .getByRole('button', { name: /^(Open settings|Settings & backup)$/ })
    .filter({ visible: true })
    .first()
    .click();

const leftCount = async (page: Page): Promise<number> =>
  Number((await page.getByText(/^\d+(\.\d+)? left$/).innerText()).replace(' left', ''));

const confirmWeek = async (page: Page): Promise<string[]> => {
  await go(page, 'My week');
  const main = page.locator('main');
  await main.getByLabel('Useful portions').fill('3');
  await main.getByLabel('Recipes to cook').fill('3');
  await main.getByRole('button', { name: 'Make a small proposal' }).click();
  const names = await main.locator('.mb-batch-card h2').allInnerTexts();
  expect(names).toHaveLength(3);
  await main.getByRole('button', { name: 'Confirm my week' }).click();
  await expect(page.getByText('Week confirmed.')).toBeVisible();
  return names;
};

test('Today → cook → ready food → eat → Undo → week → shop, surviving reloads', async ({
  page,
}) => {
  const problems = watch(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today’s recipe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start cooking' })).toBeVisible();

  // A cooking session keeps its step and ingredient checks across a reload.
  await page.getByRole('button', { name: 'Start cooking' }).click();
  const firstIngredient = page.locator('main button[aria-pressed]').first();
  const ingredientName = (await firstIngredient.innerText()).trim();
  await firstIngredient.click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/^Step 2 of \d+$/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Resume cooking' }).click();
  await expect(page.getByText(/^Step 2 of \d+$/)).toBeVisible();
  await expect(page.getByRole('button', { name: ingredientName })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Finishing creates ready food and logs nothing.
  while (await page.getByRole('button', { name: 'Next', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Finish cooking' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm ready food' }).click();
  await expect(page.getByText('Nothing is logged until you confirm what you ate.')).toBeVisible();
  const made = await leftCount(page);

  // Eating logs exactly one portion and reduces stock; Undo restores both.
  await page.getByRole('button', { name: 'Have a portion' }).click();
  const eat = page.getByRole('dialog');
  const eaten = Number(await eat.getByLabel(/eaten/).inputValue());
  await eat.getByRole('button', { name: 'I ate this' }).click();
  await expect(page.getByText('Portion logged and available food updated.')).toBeVisible();
  expect(await leftCount(page)).toBe(made - eaten);
  await openSettings(page);
  await page.locator('main').getByRole('button', { name: 'History & goals' }).click();
  await expect(page.getByRole('button', { name: 'Undo / remove log' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo / remove log' }).click();
  await expect(page.getByRole('button', { name: 'Undo / remove log' })).toHaveCount(0);
  await go(page, 'Today');
  expect(await leftCount(page)).toBe(made);

  // A confirmed week keeps its choices across a reload.
  const week = await confirmWeek(page);
  await page.reload();
  await go(page, 'My week');
  await expect(page.locator('main .mb-batch-card h2')).toHaveText(week);

  // A shopping purchase survives a reload.
  await go(page, 'Shop');
  const remaining = page.getByText(/^\d+ items? remaining$/);
  const before = Number((await remaining.innerText()).split(' ')[0]);
  await page.locator('main').getByRole('checkbox').first().check();
  await expect(remaining).toHaveText(
    `${before - 1} ${before - 1 === 1 ? 'item' : 'items'} remaining`,
  );
  await page.reload();
  await go(page, 'Shop');
  await expect(remaining).toHaveText(
    `${before - 1} ${before - 1 === 1 ? 'item' : 'items'} remaining`,
  );

  expect(problems).toEqual([]);
});

test('a downloaded backup restores the week, ready food and learned cooking time on a fresh device; a version-one backup imports', async ({
  page,
  browser,
}, testInfo) => {
  const problems = watch(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start cooking' }).click();
  await page.getByRole('button', { name: /Already made it/ }).click();
  const finish = page.getByRole('dialog');
  await finish.getByLabel(/How long did it take/).fill('40');
  await expect(finish.getByRole('checkbox', { name: /Remember this time/ })).toBeChecked();
  await finish.getByRole('button', { name: 'Confirm ready food' }).click();
  await expect(page.getByText(/^40 min for .* · timed when you cooked it$/)).toBeVisible();
  const made = await leftCount(page);
  const week = await confirmWeek(page);

  await openSettings(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  const backup = testInfo.outputPath('backup.json');
  await download.saveAs(backup);

  const freshDevice = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: page.viewportSize(),
  });
  const fresh = await freshDevice.newPage();
  const freshProblems = watch(fresh);
  await fresh.goto('/');
  await openSettings(fresh);
  await fresh.getByLabel('Restore backup').setInputFiles(backup);
  await go(fresh, 'Today');
  expect(await leftCount(fresh)).toBe(made);
  await expect(fresh.getByText(/^40 min for .* · timed when you cooked it$/)).toBeVisible();
  await go(fresh, 'My week');
  await expect(fresh.locator('main .mb-batch-card h2')).toHaveText(week);

  // A version-one backup (no experience records) still restores.
  const bank = JSON.parse(fs.readFileSync('apps/web/public/data/recipe-bank.json', 'utf8'));
  const dinner = bank.recipes.find((recipe: { roles: string[] }) =>
    recipe.roles.includes('dinner'),
  );
  const nutrition = {
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
    sugar: null,
    sodium: null,
  };
  const versionOne = testInfo.outputPath('version-one.json');
  fs.writeFileSync(
    versionOne,
    JSON.stringify({
      version: 1,
      recipes: [dinner],
      plans: [],
      activePlanId: null,
      logs: [],
      targets: nutrition,
      shoppingChecks: {},
      manualShopping: {},
    }),
  );
  await openSettings(fresh);
  await fresh.getByLabel('Restore backup').setInputFiles(versionOne);
  await expect(fresh.getByText(/Current book: 1 recipe/)).toBeVisible();
  await go(fresh, 'Today');
  await expect(fresh.getByRole('heading', { name: dinner.name })).toBeVisible();

  await freshDevice.close();
  expect(problems).toEqual([]);
  expect(freshProblems).toEqual([]);
});
