import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read=file=>fs.readFile(new URL(`../../${file}`,import.meta.url),"utf8");

test("motion foundation defines one shared timing language",async()=>{
  const css=await read("src/assets/css/motion.css");
  assert.match(css,/--sg-motion-press:110ms/);
  assert.match(css,/--sg-motion-fast:160ms/);
  assert.match(css,/--sg-motion-ui:210ms/);
  assert.match(css,/--sg-motion-layout:280ms/);
  assert.match(css,/--sg-motion-page:320ms/);
  assert.match(css,/--sg-ease-enter:cubic-bezier/);
});

test("motion runtime progressively falls back instead of owning application state",async()=>{
  const js=await read("src/assets/js/motion.js");
  assert.match(js,/typeof document\.startViewTransition!=="function"/);
  assert.match(js,/window\.ShadowGardenMotion=Object\.freeze/);
  assert.match(js,/transition,/);
  assert.equal(js.includes("location.href="),false,"motion runtime must not globally intercept navigation");
  assert.equal(js.includes("localStorage.setItem"),false,"motion runtime must not own persisted state");
});

test("reduced motion collapses optional animation while keeping the update path",async()=>{
  const [css,js,doc]=await Promise.all([
    read("src/assets/css/motion.css"),
    read("src/assets/js/motion.js"),
    read("docs/architecture/MOTION_SYSTEM.md")
  ]);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.sg-motion-control:active\{transform:none!important\}/);
  assert.match(js,/if\(reduced\(\)\|\|typeof document\.startViewTransition!=="function"\)return fallbackTransition\(update\)/);
  assert.match(doc,/motion is progressive enhancement/i);
  assert.match(doc,/never owns navigation, reading state, catalog state, or persistence/);
});
