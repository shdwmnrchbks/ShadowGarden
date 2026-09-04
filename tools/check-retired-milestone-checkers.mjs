import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const retired = [
  "tools/check-r0.mjs",
  "tools/check-r1.mjs",
  "tools/check-r2.mjs",
  "tools/check-r3.mjs",
  "tools/check-r4.mjs",
  "tools/check-r4-1.mjs",
  "tools/check-r5.mjs",
  "tools/check-r6.mjs",
  "tools/check-r7.mjs",
  "tools/check-r8.mjs",
  "tools/check-r9.mjs",
  "tools/check-r10.mjs"
];

const returned = retired.filter(file => fs.existsSync(path.join(ROOT, file)));
if (returned.length) {
  console.error("Retired R0–R10 milestone checker executables returned:");
  returned.forEach(file => console.error(`- ${file}`));
  process.exitCode = 1;
} else {
  console.log(`Retired milestone checker guard passed: ${retired.length} obsolete R-series executables remain absent.`);
}
