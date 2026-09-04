import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssDir = path.join(root, 'src', 'assets', 'css');
const srcDir = path.join(root, 'src');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

const cssFiles = walk(cssDir).filter((file) => file.endsWith('.css')).sort();
const productionSourceFiles = walk(srcDir)
  .filter((file) => /\.(?:html|js|mjs)$/.test(file))
  .sort();
const sourceText = productionSourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const cssTexts = new Map(cssFiles.map((file) => [file, stripComments(fs.readFileSync(file, 'utf8'))]));

const surfaces = {
  library: 'src/index.html',
  adult: 'src/nsfw.html',
  series: 'src/series.html',
  reader: 'src/reader.html',
  keeper: 'src/admin.html',
};

const composition = {};
for (const [surface, file] of Object.entries(surfaces)) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  composition[surface] = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\/assets\/css\/([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]);
}

const classOwners = new Map();
const idOwners = new Map();
const selectors = [];
let importantCount = 0;
let reducedMotionFiles = 0;
let forcedColorsFiles = 0;
let increasedContrastFiles = 0;
let keyframeCount = 0;

function addOwner(map, token, file) {
  if (!map.has(token)) map.set(token, new Set());
  map.get(token).add(rel(file));
}

function classLikeCount(selector) {
  const withoutWhere = selector.replace(/:where\([^)]*\)/g, '');
  const classes = (withoutWhere.match(/\.[-_a-zA-Z][\w-]*/g) || []).length;
  const attrs = (withoutWhere.match(/\[[^\]]+\]/g) || []).length;
  const pseudos = (withoutWhere.match(/:(?!:)[-_a-zA-Z][\w-]*(?:\([^)]*\))?/g) || [])
    .filter((value) => !value.startsWith(':where')).length;
  return classes + attrs + pseudos;
}

for (const file of cssFiles) {
  const text = cssTexts.get(file);
  importantCount += (text.match(/!important\b/g) || []).length;
  if (/prefers-reduced-motion\s*:\s*reduce/.test(text)) reducedMotionFiles += 1;
  if (/forced-colors\s*:\s*active/.test(text)) forcedColorsFiles += 1;
  if (/prefers-contrast\s*:\s*(?:more|custom)/.test(text)) increasedContrastFiles += 1;
  keyframeCount += (text.match(/@(?:-webkit-)?keyframes\b/g) || []).length;

  for (const match of text.matchAll(/([^{}]+)\{/g)) {
    const header = match[1].trim();
    if (!header || header.startsWith('@')) continue;
    for (const selector of header.split(',').map((part) => part.trim()).filter(Boolean)) {
      const classes = [...selector.matchAll(/\.(-?[_a-zA-Z]+[\w-]*)/g)].map((item) => item[1]);
      const ids = [...selector.matchAll(/#(-?[_a-zA-Z]+[\w-]*)/g)].map((item) => item[1]);
      classes.forEach((token) => addOwner(classOwners, token, file));
      ids.forEach((token) => addOwner(idOwners, token, file));
      selectors.push({ file: rel(file), selector, ids: ids.length, classLike: classLikeCount(selector) });
    }
  }
}

const customPropertyDefs = new Map();
const customPropertyUses = new Map();
for (const file of cssFiles) {
  const text = cssTexts.get(file);
  for (const match of text.matchAll(/(--[-_a-zA-Z0-9]+)\s*:/g)) addOwner(customPropertyDefs, match[1], file);
  for (const match of text.matchAll(/var\(\s*(--[-_a-zA-Z0-9]+)/g)) addOwner(customPropertyUses, match[1], file);
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const candidateUnreferencedClasses = [...classOwners.entries()]
  .filter(([token]) => !new RegExp(`(^|[^-_a-zA-Z0-9])${escapeRegex(token)}([^-_a-zA-Z0-9]|$)`).test(sourceText))
  .map(([token, owners]) => ({ token, owners: [...owners].sort() }))
  .sort((a, b) => a.token.localeCompare(b.token));

const candidateUnusedCustomProperties = [...customPropertyDefs.entries()]
  .filter(([token]) => !customPropertyUses.has(token) && !sourceText.includes(token))
  .map(([token, owners]) => ({ token, owners: [...owners].sort() }))
  .sort((a, b) => a.token.localeCompare(b.token));

const sharedClassOwners = [...classOwners.entries()]
  .filter(([, owners]) => owners.size > 1)
  .map(([token, owners]) => ({ token, owners: [...owners].sort() }))
  .sort((a, b) => b.owners.length - a.owners.length || a.token.localeCompare(b.token));

const highSpecificity = selectors
  .filter((entry) => entry.ids > 0 || entry.classLike >= 4)
  .sort((a, b) => b.ids - a.ids || b.classLike - a.classLike || a.file.localeCompare(b.file) || a.selector.localeCompare(b.selector));

const sheetSurfaces = new Map();
for (const [surface, sheets] of Object.entries(composition)) {
  for (const sheet of sheets) {
    if (!sheetSurfaces.has(sheet)) sheetSurfaces.set(sheet, []);
    sheetSurfaces.get(sheet).push(surface);
  }
}

console.log(`CSS audit baseline: ${cssFiles.length} authored stylesheets, ${selectors.length} selectors.`);
for (const [surface, sheets] of Object.entries(composition)) console.log(`  ${surface}: ${sheets.length} stylesheets -> ${sheets.join(', ')}`);

const sharedSheets = [...sheetSurfaces.entries()]
  .filter(([, surfaceList]) => surfaceList.length > 1)
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
console.log(`Shared stylesheet owners: ${sharedSheets.length}.`);
for (const [sheet, surfaceList] of sharedSheets) console.log(`  ${sheet}: ${surfaceList.join(', ')}`);

console.log(`Static candidate unreferenced class selectors: ${candidateUnreferencedClasses.length} (report-only; dynamic classes can be false positives).`);
for (const item of candidateUnreferencedClasses.slice(0, 30)) console.log(`  .${item.token}: ${item.owners.join(', ')}`);
if (candidateUnreferencedClasses.length > 30) console.log(`  ... ${candidateUnreferencedClasses.length - 30} more`);

console.log(`Candidate unused custom properties: ${candidateUnusedCustomProperties.length}.`);
for (const item of candidateUnusedCustomProperties.slice(0, 30)) console.log(`  ${item.token}: ${item.owners.join(', ')}`);
if (candidateUnusedCustomProperties.length > 30) console.log(`  ... ${candidateUnusedCustomProperties.length - 30} more`);

console.log(`Class tokens styled in multiple files: ${sharedClassOwners.length}.`);
for (const item of sharedClassOwners.slice(0, 25)) console.log(`  .${item.token}: ${item.owners.join(', ')}`);
if (sharedClassOwners.length > 25) console.log(`  ... ${sharedClassOwners.length - 25} more`);

console.log(`Specificity watch: ${highSpecificity.length} selectors contain an ID or 4+ class/attribute/pseudo components; !important declarations: ${importantCount}.`);
for (const item of highSpecificity.slice(0, 25)) console.log(`  [${item.ids},${item.classLike}] ${item.file}: ${item.selector}`);
if (highSpecificity.length > 25) console.log(`  ... ${highSpecificity.length - 25} more`);

console.log(`Accessibility/motion media coverage: reduced-motion in ${reducedMotionFiles} files; forced-colors in ${forcedColorsFiles}; increased-contrast in ${increasedContrastFiles}; keyframes: ${keyframeCount}.`);
console.log('CSS audit is measurement-only: no candidate causes a non-zero exit code.');
