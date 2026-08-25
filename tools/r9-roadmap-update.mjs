import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const roadmapFile = new URL("../docs/roadmaps/REFACTOR_ROADMAP.md", import.meta.url);
let roadmap = await fs.readFile(roadmapFile, "utf8");

function replaceExact(before, after) {
  if (!roadmap.includes(before)) throw new Error(`R9 roadmap migration marker missing:\n${before}`);
  roadmap = roadmap.replace(before, after);
}

replaceExact(
  "**Status:** 🟨 Active — R0–R8 complete; R9 next  ",
  "**Status:** 🟨 Active — R0–R9 complete; R10 next  "
);
replaceExact(
  "**Current refactor release:** v1.23.0  ",
  "**Current refactor release:** v1.24.0  "
);
replaceExact(
  "| R9. Build and deployment cleanup | ⬜ Planned | Dependency audit, lockfile, deterministic assets, optional bundler decision |",
  "| R9. Build and deployment cleanup | ✅ Done | Locked dependency tree, deterministic build/deployment metadata, read-only `npm ci` CI, dependency-free preview, explicit no-bundler decision |"
);
replaceExact(
  "Completed work includes `MODULE_CONVENTIONS.md`, `BUILD_CONTRACT.md`, the legacy-source exception manifest, Node 22 pinning, immutable Actions pins, centralized build-time asset versioning, dead-file enforcement, and production-build verification in CI. Dependency lockfile work remains intentionally deferred to R9 after dependency audit.",
  "Completed work includes `MODULE_CONVENTIONS.md`, `BUILD_CONTRACT.md`, the legacy-source exception manifest, Node 22 pinning, immutable Actions pins, centralized build-time asset versioning, dead-file enforcement, and production-build verification in CI. R9 later finalized the deferred dependency boundary with a committed npm v3 lockfile, `npm ci`, and deterministic deployment metadata."
);
replaceExact(
  "## R9 — Build and deployment cleanup\n\n**Goal:** audit/remove unused dependencies, commit a lockfile after choices settle, centralize deployment metadata/assets, keep `dist/` generated, and make a deliberate bundler/no-bundler decision based on measurable benefits rather than fashion.\n\n---",
  `## R9 — Build and deployment cleanup\n\n**Status:** ✅ Done — accepted 2026-08-25  \n**Release:** v1.24.0  \n**Goal:** finalize dependency/install ownership, deterministic build/deployment metadata, CI runtime pins, local preview, and the bundler decision while keeping \`dist/\` generated.\n\nSee [\`../architecture/BUILD_DEPLOYMENT.md\`](../architecture/BUILD_DEPLOYMENT.md).\n\n### Final ownership\n\n- \`package-lock.json\` — committed npm lockfile version 3; exact transitive dependency tree for Node 22 verification.\n- \`package.json#engines.node\` + \`.nvmrc\` + CI — one Node 22 project-runtime boundary.\n- \`tools/lib/build-context.mjs\` — package version, deployment commit/branch and deterministic build timestamp owner.\n- \`tools/build.mjs\` — generated \`dist/\`, asset stamping, locked EPUB.js/JSZip vendor copies, local EPUB indexing and catalog generation.\n- \`tools/write-source.mjs\` — generated catalog-source and deployment-version descriptors using the same build context.\n- \`tools/preview.mjs\` — dependency-free Node static preview for generated \`dist/\`, replacing unpinned \`npx serve\`.\n- \`.github/workflows/verify.yml\` — read-only CI using current immutable checkout/setup-node pins, Node 22, \`npm ci\`, the complete check suite and production build.\n- \`tools/check-r9.mjs\` — permanent build/deployment boundary guard.\n\n### Dependency audit\n\nAll five direct dependencies remain because each has an explicit owner: \`@aws-sdk/client-s3\` for local B2 utilities, \`aws4fetch\` for Pages/B2 signing, \`epubjs\` for the Reader vendor runtime, \`fast-xml-parser\` for EPUB package metadata, and \`jszip\` for EPUB parsing plus the browser vendor runtime. R9 removes no live package merely to reduce the dependency count.\n\n### Bundler decision\n\nR9 deliberately keeps Shadow Garden as a native static/module application. No Vite/Rollup/webpack/esbuild/Parcel layer is added because the current module count, asset-versioning strategy, Pages Functions deployment, and vendor-copy boundary do not show a measured problem that bundling would solve. R10 may revisit only with production evidence and equivalent regression coverage.\n\n### Determinism and CI corrections\n\n- A committed lockfile plus \`npm ci\` replaces floating transitive resolution during verification.\n- Asset cache-busting and deployment metadata share \`package.json#version\`.\n- Local catalog \`generatedAt\` and deployment \`builtAt\` share one build timestamp resolved from \`SOURCE_DATE_EPOCH\` or Git commit time before wall-clock fallback.\n- Old Actions revisions that emitted Node-20-runtime deprecation warnings are replaced by current immutable action SHAs while project commands remain on Node 22.\n- The Verify workflow remains \`contents: read\`.\n\n### Acceptance\n\n- [x] Direct dependencies are audited and every retained package has a documented owner.\n- [x] \`package-lock.json\` is committed and synchronized with the v1.24.0 manifest; CI uses \`npm ci\`.\n- [x] Node 22 is explicit in local, package, and CI contracts.\n- [x] Build/version/catalog metadata use one deterministic build-context owner.\n- [x] Local preview uses committed Node tooling rather than an undeclared \`npx\` package.\n- [x] The no-bundler decision is explicit and measured-risk based.\n- [x] \`dist/\` remains generated/ignored and production build verification remains mandatory.\n- [x] \`tools/check-r9.mjs\` permanently guards the finalized boundary.\n\n---`
);
replaceExact(
  "With **R0–R8 complete**, proceed to **R9 build and deployment cleanup**. Public browsing, Reader, Garden Keeper, Pages Functions, CSS/design-system ownership, and deterministic regression layers are now explicit. Follow with final cutover and production regression (R10).\n\nDo not mix build/deployment cleanup and final legacy removal in one PR.",
  "With **R0–R9 complete**, proceed to **R10 final cutover and v2 baseline**. Public browsing, Reader, Garden Keeper, Pages Functions, CSS/design-system ownership, deterministic regression layers, and the locked build/deployment pipeline are now explicit. R10 may remove the remaining documented compatibility entrypoints and must finish with the full production/browser/security matrix.\n\nDo not reopen completed milestones merely to perform R10 legacy removal; preserve their contracts or replace them intentionally with equal or stronger coverage."
);

await fs.writeFile(roadmapFile, roadmap);
await fs.unlink(fileURLToPath(import.meta.url));
console.log("R9 roadmap migration applied and one-shot migration file removed.");
