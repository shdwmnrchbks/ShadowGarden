import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const retired = [
  'tools/check-m5.mjs',
  'tools/check-m6.mjs',
  'tools/check-m7.mjs',
  'tools/check-m8.mjs',
  'tools/check-m9.mjs',
  'tools/check-v2-6.mjs',
  'tools/check-reading-status.mjs'
];
const failures = [];

for (const relative of retired) {
  if (fs.existsSync(path.join(root, relative))) failures.push(`${relative} must remain retired`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  for (const relative of retired) {
    if (String(command).includes(path.basename(relative))) {
      failures.push(`package script ${name} still references retired tool ${relative}`);
    }
  }
}

if (failures.length) {
  console.error(`Retired release-tool guard failed with ${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Retired release-tool guard passed: ${retired.length} obsolete standalone executables remain absent.`);
}
