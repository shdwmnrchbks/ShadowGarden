import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Garden Keeper consumes shared motion without taking workflow ownership",async()=>{
  const [app,js,css]=await Promise.all([
    read("src/assets/js/admin/app.js"),read("src/assets/js/admin/motion.js"),read("src/assets/css/admin-motion.css")
  ]);
  for(const marker of ["/assets/css/motion.css","/assets/css/admin-motion.css","/assets/js/motion.js","/assets/js/admin/motion.js"]){
    assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
  assert.match(app,/"shell","motion"/);
  assert.match(js,/registerWorkflow\("motion"/);
  assert.match(js,/new MutationObserver/);
  assert.match(js,/upload:completed/);
  assert.match(js,/library:changed/);
  assert.equal(js.includes("client.request"),false,"Keeper motion must not make API requests");
  assert.equal(js.includes("localStorage"),false,"Keeper motion must not persist application state");
  assert.equal(js.includes("showModal("),false,"Keeper motion must not own dialog opening");
  assert.equal(js.includes(".close("),false,"Keeper motion must not own dialog closing");
  assert.match(css,/@view-transition\{navigation:auto\}/);
  assert.match(css,/sg-keeper-dialog-in/);
  assert.match(css,/sg-keeper-action-busy/);
  assert.match(css,/sg-keeper-complete/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("navigation direction remains a transient presentation hint instead of a router",async()=>{
  const [motion,css,nav,navCss]=await Promise.all([
    read("src/assets/js/motion.js"),read("src/assets/css/motion.css"),read("src/assets/js/nav.js"),read("src/assets/css/nav.css")
  ]);
  assert.match(motion,/sessionStorage\.setItem\(navigationKey/);
  assert.match(motion,/sessionStorage\.removeItem\(navigationKey/);
  assert.match(motion,/sg:navigationintent/);
  assert.match(motion,/directionFor/);
  assert.equal(motion.includes("preventDefault("),false,"shared motion must not intercept navigation");
  assert.equal(motion.includes("location.assign("),false,"shared motion must not perform routing");
  assert.match(nav,/new CustomEvent\('sg:navigationintent'/);
  assert.match(nav,/window\.location\.assign\(adminPath\)/);
  assert.match(css,/data-sg-nav-direction="forward"/);
  assert.match(css,/data-sg-nav-direction="backward"/);
  assert.match(css,/data-sg-nav-direction="lateral"/);
  assert.match(navCss,/--sg-motion-layout/);
  assert.match(navCss,/--sg-ease-enter/);
  assert.match(navCss,/sg-nav-item-in/);
  assert.match(navCss,/prefers-reduced-motion:reduce/);
});

test("Keeper motion assets are architecture-registered and deployment-fresh",async()=>{
  const [v1,v2,headers]=await Promise.all([
    read("docs/architecture/v1-entrypoints.json"),read("docs/architecture/v2-entrypoints.json"),read("src/_headers")
  ]);
  for(const manifestText of [v1,v2]){
    const manifest=JSON.parse(manifestText),runtime=manifest.pages.gardenKeeper.runtimeLoaded;
    for(const asset of ["/assets/css/motion.css","/assets/css/admin-motion.css","/assets/js/motion.js","/assets/js/admin/motion.js"]){
      assert.ok(runtime.includes(asset),`Garden Keeper manifest must register ${asset}`);
    }
  }
  for(const marker of ["/assets/js/motion.js","/assets/css/motion.css","/assets/css/admin-motion.css"]){
    assert.match(headers,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
});
