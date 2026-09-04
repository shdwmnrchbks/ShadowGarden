import test from "node:test";
import assert from "node:assert/strict";

import { installBrowserEnv } from "../helpers/browser-env.mjs";

test("catalog startup sharing is one-shot and later normal loads remain fresh", async () => {
  const env = installBrowserEnv();
  const previousFetch = globalThis.fetch;
  let catalogRequests = 0;

  globalThis.fetch = async input => {
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

  try {
    delete globalThis.ShadowGardenData;
    await import(`../../src/assets/js/data-source.js?catalog-sharing=${Date.now()}`);
    const data = globalThis.ShadowGardenData;

    const navCatalog = await data.loadCatalog(false, { reuse: true, shareNext: true });
    assert.equal(catalogRequests, 1);

    const pageCatalog = await data.loadCatalog(false);
    assert.equal(catalogRequests, 1, "the page owner should consume the one-shot successful startup snapshot");
    assert.equal(pageCatalog, navCatalog);

    const refreshedCatalog = await data.loadCatalog(false);
    assert.equal(catalogRequests, 2, "a later normal load must fetch fresh instead of extending startup reuse");
    assert.notEqual(refreshedCatalog, navCatalog);
  } finally {
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    delete globalThis.ShadowGardenData;
    env.restore();
  }
});
