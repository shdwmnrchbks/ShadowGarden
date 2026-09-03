import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const EXPECTED_NODE_ENGINE = "22.x";
export const EXPECTED_NODE_PIN = "22.23.2";
export const EXPECTED_PACKAGE_MANAGER = "npm@10.9.8";
const REGISTRY_PREFIX = "https://registry.npmjs.org/";

function sameObject(actual = {}, expected = {}) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index] && actual[key] === expected[key]);
}

export function validateManifestLock(manifest, lock, { label, dependencyField }) {
  const errors = [];
  const root = lock?.packages?.[""];
  if (manifest?.engines?.node !== EXPECTED_NODE_ENGINE) errors.push(`${label} package engines.node must be ${EXPECTED_NODE_ENGINE}`);
  if (manifest?.packageManager !== EXPECTED_PACKAGE_MANAGER) errors.push(`${label} packageManager must be ${EXPECTED_PACKAGE_MANAGER}`);
  if (lock?.lockfileVersion !== 3) errors.push(`${label} lockfileVersion must be 3`);
  if (!root || typeof root !== "object") errors.push(`${label} lockfile must contain packages[\"\"]`);
  if (lock?.name !== manifest?.name) errors.push(`${label} lockfile name must match package.json`);
  if (lock?.version !== manifest?.version) errors.push(`${label} lockfile version must match package.json`);
  if (root) {
    if (root.name !== manifest?.name) errors.push(`${label} lockfile root name must match package.json`);
    if (root.version !== manifest?.version) errors.push(`${label} lockfile root version must match package.json`);
    if (root?.engines?.node !== EXPECTED_NODE_ENGINE) errors.push(`${label} lockfile root engines.node must be ${EXPECTED_NODE_ENGINE}`);
    if (!sameObject(root?.[dependencyField] || {}, manifest?.[dependencyField] || {})) {
      errors.push(`${label} lockfile root ${dependencyField} must match package.json`);
    }
  }

  const direct = Object.keys(manifest?.[dependencyField] || {});
  for (const name of direct) {
    if (!lock?.packages?.[`node_modules/${name}`]) errors.push(`${label} lockfile is missing direct package entry ${name}`);
  }

  let registryPackages = 0;
  for (const [packagePath, entry] of Object.entries(lock?.packages || {})) {
    if (!packagePath || !entry || typeof entry !== "object" || !entry.resolved) continue;
    registryPackages += 1;
    if (!String(entry.resolved).startsWith(REGISTRY_PREFIX)) {
      errors.push(`${label} ${packagePath} resolves outside ${REGISTRY_PREFIX}`);
    }
    if (!/^sha512-/.test(String(entry.integrity || ""))) {
      errors.push(`${label} ${packagePath} must use sha512 integrity`);
    }
  }
  return { errors, registryPackages };
}

export function validateWorkflowNodePins(workflows, expectedPin = EXPECTED_NODE_PIN) {
  const errors = [];
  let setupNodeWorkflows = 0;
  for (const [name, source] of Object.entries(workflows)) {
    if (!/actions\/setup-node@/.test(source)) continue;
    setupNodeWorkflows += 1;
    const pins = [...source.matchAll(/node-version:\s*["']?([^\s"']+)["']?/g)].map(match => match[1]);
    if (!pins.length) errors.push(`${name} uses setup-node without node-version`);
    for (const pin of pins) {
      if (pin !== expectedPin) errors.push(`${name} must pin node-version to ${expectedPin}, found ${pin}`);
    }
  }
  for (const required of ["verify.yml", "e2e.yml", "dependency-audit.yml"]) {
    if (!workflows[required] || !/actions\/setup-node@/.test(workflows[required])) {
      errors.push(`${required} must use actions/setup-node`);
    }
  }
  return { errors, setupNodeWorkflows };
}

export function validateAuditLockExercise(source) {
  const errors = [];
  if (!/npm ci --omit=dev --no-audit/.test(source)) errors.push("dependency-audit.yml must install the root production lockfile with npm ci");
  if (!/npm ci --prefix tests\/e2e[^\n]*--ignore-scripts[^\n]*--no-audit/.test(source)) errors.push("dependency-audit.yml must install the E2E lockfile with npm ci --ignore-scripts");
  if (!/npm run check:runtime/.test(source)) errors.push("dependency-audit.yml must run the deterministic runtime/lockfile guard");
  if (/--package-lock=false|--ignore-package-lock/.test(source)) errors.push("dependency-audit.yml must not bypass package-lock.json");
  return errors;
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
}

export async function runRuntimeLockfileCheck(root = process.cwd()) {
  const failures = [];
  const [rootManifest, rootLock, e2eManifest, e2eLock, nvm] = await Promise.all([
    readJson(root, "package.json"),
    readJson(root, "package-lock.json"),
    readJson(root, "tests/e2e/package.json"),
    readJson(root, "tests/e2e/package-lock.json"),
    fs.readFile(path.join(root, ".nvmrc"), "utf8")
  ]);

  if (nvm.trim() !== EXPECTED_NODE_PIN) failures.push(`.nvmrc must pin ${EXPECTED_NODE_PIN}`);

  const rootResult = validateManifestLock(rootManifest, rootLock, { label: "root", dependencyField: "dependencies" });
  const e2eResult = validateManifestLock(e2eManifest, e2eLock, { label: "E2E", dependencyField: "devDependencies" });
  failures.push(...rootResult.errors, ...e2eResult.errors);

  const workflowDir = path.join(root, ".github", "workflows");
  const workflowNames = (await fs.readdir(workflowDir)).filter(name => /\.ya?ml$/i.test(name)).sort();
  const workflows = Object.fromEntries(await Promise.all(workflowNames.map(async name => [name, await fs.readFile(path.join(workflowDir, name), "utf8")])));
  const workflowResult = validateWorkflowNodePins(workflows);
  failures.push(...workflowResult.errors);
  failures.push(...validateAuditLockExercise(workflows["dependency-audit.yml"] || ""));

  if (failures.length) {
    console.error(`Runtime/lockfile policy failed with ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    failures.forEach(message => console.error(`- ${message}`));
    process.exitCode = 1;
    return { failures };
  }

  const registryPackages = rootResult.registryPackages + e2eResult.registryPackages;
  console.log(`Runtime/lockfile policy passed: Node ${EXPECTED_NODE_PIN}, ${EXPECTED_PACKAGE_MANAGER}, 2 lockfiles, ${registryPackages} registry packages.`);
  return { failures: [], registryPackages, setupNodeWorkflows: workflowResult.setupNodeWorkflows };
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runRuntimeLockfileCheck().catch(error => {
    console.error(`Runtime/lockfile policy failed: ${error.message}`);
    process.exitCode = 1;
  });
}
