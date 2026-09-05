import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const DATA_SOURCE_URL = new URL("../../src/assets/js/data-source.js", import.meta.url);
const DOMAIN_IMPORT = "const loadDomain=()=>domainPromise||(domainPromise=import('/assets/js/domain/index.js'));";
const DOMAIN_STUB = "const loadDomain=()=>domainPromise||(domainPromise=Promise.resolve({catalog:{normalizeCatalog:catalog=>catalog}}));";

test("catalog startup sharing is one-shot and later normal loads remain fresh", async () => {
  let catalogRequests = 0;
  const fetch = async input => {
    const url = String(input);
    if (url.endsWith("/data/source.json")) {
      return new Response(JSON.stringify({ mode: "local" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/data/catalog.json")) {
      catalogRequests += 1;
      return new Response(JSON.stringify({ version: 1, series: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const source = await readFile(DATA_SOURCE_URL, "utf8");
  assert.ok(source.includes(DOMAIN_IMPORT), "data-source domain import shape changed; update this isolated browser-adapter harness");
  const executable = source.replace(DOMAIN_IMPORT, DOMAIN_STUB);
  const context = { fetch, Response, console };
  context.window = context;
  vm.runInNewContext(executable, context, { filename: "data-source.js" });
  const data = context.ShadowGardenData;

  const navCatalog = await data.loadCatalog(false, { reuse: true, shareNext: true });
  assert.equal(catalogRequests, 1);

  const pageCatalog = await data.loadCatalog(false);
  assert.equal(catalogRequests, 1, "the page owner should consume the one-shot successful startup snapshot");
  assert.equal(pageCatalog, navCatalog);

  const refreshedCatalog = await data.loadCatalog(false);
  assert.equal(catalogRequests, 2, "a later normal load must fetch fresh instead of extending startup reuse");
  assert.notEqual(refreshedCatalog, navCatalog);
});
