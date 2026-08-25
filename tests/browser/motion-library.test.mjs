import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("Main and Adult Library load the same progressive motion layer",async()=>{
  const [main,adult]=await Promise.all([read("src/index.html"),read("src/nsfw.html")]);
  for(const html of [main,adult]){
    assert.match(html,/assets\/css\/motion\.css/);
    assert.match(html,/assets\/css\/library-motion\.css/);
    assert.match(html,/assets\/js\/motion\.js/);
    assert.match(html,/assets\/js\/library-motion\.js/);
  }
});

test("Library state transitions replay canonical controller events instead of duplicating state",async()=>{
  const js=await read("src/assets/js/library-motion.js");
  assert.match(js,/document\.startViewTransition/);
  assert.match(js,/Object\.defineProperty\(next,replayKey/);
  assert.match(js,/target\.dispatchEvent\(next\)/);
  assert.match(js,/library-layout/);
  assert.match(js,/library-filter/);
  assert.equal(js.includes("localStorage.setItem"),false,"motion adapter must not persist Library state");
  assert.equal(js.includes("history.pushState"),false,"motion adapter must not own URL state");
});

test("catalog cards receive stable names for sort/filter and Grid Compact morphs",async()=>{
  const js=await read("src/assets/js/library-motion.js");
  assert.match(js,/safeName=value=>`sg-card-/);
  assert.match(js,/card\.style\.viewTransitionName=id\?safeName\(id\):"none"/);
  assert.match(js,/new MutationObserver/);
});

test("Library to Series continuity targets first-paint cover geometry",async()=>{
  const [css,js,series]=await Promise.all([
    read("src/assets/css/library-motion.css"),
    read("src/assets/js/library-motion.js"),
    read("src/series.html")
  ]);
  assert.match(css,/@view-transition\{navigation:auto\}/);
  assert.match(css,/\.series-loading-cover\{view-transition-name:series-cover\}/);
  assert.match(js,/cover\.style\.viewTransitionName="series-cover"/);
  assert.match(series,/class="series-loading-cover series-loading-block"/);
  assert.match(series,/assets\/css\/library-motion\.css/);
});

test("Library animation keeps hydration, native rail physics, and reduced motion safe",async()=>{
  const [css,js]=await Promise.all([read("src/assets/css/library-motion.css"),read("src/assets/js/library-motion.js")]);
  assert.match(js,/sg-library-motion-loading/);
  assert.match(css,/sg-library-content-in/);
  assert.match(css,/\.recent-volumes\{[^}]*mask-image/);
  assert.equal(css.includes("scroll-behavior:smooth"),false,"rail motion must stay native rather than forcing scripted-feeling inertia");
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/animation:none!important/);
});
