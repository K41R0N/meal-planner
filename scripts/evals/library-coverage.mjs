// EV-02: describe how complete and attributable the bundled recipe library is.
// Descriptive only: M2's plan sets thresholds. Usage:
//   node scripts/evals/library-coverage.mjs [--write docs/evals/results/<date>-ev-02-library-coverage.json]
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const seedPath = 'apps/web/public/data/recipe-bank.json';
const bank = JSON.parse(await readFile(path.join(root, seedPath), 'utf8'));
const four = ['calories', 'protein', 'carbs', 'fat'];
const known = (value) => value !== null && value !== undefined;

function measure(recipes) {
  const count = (predicate) => recipes.filter(predicate).length;
  const lines = recipes.flatMap((recipe) => recipe.ingredients);
  const basis = {};
  for (const recipe of recipes) basis[recipe.nutritionBasis] = (basis[recipe.nutritionBasis] ?? 0) + 1;
  const gaps = {};
  for (const gap of recipes.flatMap((recipe) => recipe.dataGaps)) gaps[gap] = (gaps[gap] ?? 0) + 1;
  return {
    recipes: recipes.length,
    yieldKnown: count((r) => known(r.baseServings)),
    caloriesAndProtein: count((r) => known(r.nutrition.calories) && known(r.nutrition.protein)),
    fourMacros: count((r) => four.every((key) => known(r.nutrition[key]))),
    fourMacrosAndYield: count((r) => known(r.baseServings) && four.every((key) => known(r.nutrition[key]))),
    anyReportedNutrition: count((r) => Object.values(r.reportedNutrition).some(known)),
    nutritionBasis: basis,
    prepMinutesKnown: count((r) => known(r.prepMinutes)),
    cookMinutesKnown: count((r) => known(r.cookMinutes)),
    sourceUrl: count((r) => Boolean(r.sourceUrl)),
    creatorCredit: count((r) => Boolean(r.creatorCredit)),
    image: count((r) => Boolean(r.image)),
    withDataGaps: count((r) => r.dataGaps.length > 0),
    dataGaps: Object.fromEntries(Object.entries(gaps).sort((a, b) => b[1] - a[1])),
    ingredientLines: {
      total: lines.length,
      quantityAndUnit: lines.filter((l) => known(l.quantity) && l.unit).length,
      quantityOnly: lines.filter((l) => known(l.quantity) && !l.unit).length,
      noQuantity: lines.filter((l) => !known(l.quantity)).length,
    },
  };
}

const bySource = {};
for (const recipe of bank.recipes) (bySource[recipe.id.split(':')[0]] ??= []).push(recipe);
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch {}
const writeIndex = process.argv.indexOf('--write');
if (writeIndex !== -1) {
  // A recorded result must be reproducible from its commit: the script and its inputs may not differ from HEAD.
  const inputs = ['scripts/evals/library-coverage.mjs', seedPath, 'package.json'];
  const dirty = commit ? execFileSync('git', ['status', '--porcelain', '--', ...inputs], { cwd: root, encoding: 'utf8' }).trim() : 'no git commit';
  if (dirty) throw new Error(`--write needs committed inputs; uncommitted: ${dirty}`);
}

const result = {
  eval: 'EV-02',
  question: 'How complete and attributable is the bundled recipe library?',
  measuredAt: new Date().toISOString(),
  commit,
  input: { path: seedPath, schemaVersion: bank.schemaVersion },
  note: 'Counts of fields present, not verification. Nutrition is normalized per serving where a basis allowed it; source-reported values are not independently checked.',
  all: measure(bank.recipes),
  bySource: Object.fromEntries(Object.entries(bySource).map(([source, recipes]) => [source, measure(recipes)])),
};

if (writeIndex !== -1) {
  const target = path.resolve(root, process.argv[writeIndex + 1] ?? '');
  if (!target.startsWith(path.join(root, 'docs', 'evals', 'results') + path.sep)) throw new Error('--write must target docs/evals/results/');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(`Wrote ${path.relative(root, target)}`);
}

const a = result.all;
const pct = (n) => `${n}/${a.recipes} (${Math.round((n / a.recipes) * 100)}%)`;
console.log(`EV-02 library coverage at ${commit?.slice(0, 7) ?? 'unknown commit'}`);
console.log(`  yield known            ${pct(a.yieldKnown)}`);
console.log(`  calories + protein     ${pct(a.caloriesAndProtein)}`);
console.log(`  four macros            ${pct(a.fourMacros)}`);
console.log(`  four macros + yield    ${pct(a.fourMacrosAndYield)}`);
console.log(`  prep / cook minutes    ${a.prepMinutesKnown} / ${a.cookMinutesKnown}`);
console.log(`  ingredient lines       ${a.ingredientLines.total} (qty+unit ${a.ingredientLines.quantityAndUnit}, qty only ${a.ingredientLines.quantityOnly}, none ${a.ingredientLines.noQuantity})`);
