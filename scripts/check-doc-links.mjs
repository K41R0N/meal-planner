import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function markdownFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(candidate));
    else if (entry.name.endsWith('.md')) result.push(candidate);
  }
  return result;
}

const files = [
  ...['README.md', 'PRODUCT.md', 'DESIGN.md', 'STRATEGY.md', 'TODO.md', 'AGENTS.md'].map((name) => path.join(root, name)),
  ...await markdownFiles(path.join(root, 'docs')),
  ...await markdownFiles(path.join(root, 'tools', 'recipe-import')),
];
let checked = 0;
const failures = [];
for (const filename of files) {
  const original = await readFile(filename, 'utf8');
  // Fenced code examples contain illustrative links, not documentation navigation.
  const text = original.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '');
  const references = new Map();
  for (const match of text.matchAll(/^\s*\[([^\]]+)\]:\s*<?([^\s>]+)>?/gm)) references.set(match[1].toLowerCase(), match[2]);
  const targets = [...text.matchAll(/!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)].map((match) => match[1]);
  for (const match of text.matchAll(/\[[^\]\n]+\]\[([^\]]+)\]/g)) {
    const reference = references.get(match[1].toLowerCase());
    if (reference) targets.push(reference);
  }
  for (const target of targets) {
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue;
    const relative = decodeURIComponent(target.split(/[?#]/)[0]);
    if (!relative) continue;
    const resolved = relative.startsWith('/')
      ? path.join(root, 'apps', 'web', 'public', relative)
      : path.resolve(path.dirname(filename), relative);
    if (!resolved.startsWith(root + path.sep)) {
      failures.push(`${path.relative(root, filename)}: outside repository: ${target}`);
      continue;
    }
    checked += 1;
    try { await stat(resolved); }
    catch { failures.push(`${path.relative(root, filename)}: missing: ${target}`); }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`Failed: ${failures.length} missing or unsafe target(s).`);
  process.exitCode = 1;
} else {
  console.log(`Documentation links OK: ${files.length} Markdown files, ${checked} local targets. External URLs and anchors are not verified by this check.`);
}
