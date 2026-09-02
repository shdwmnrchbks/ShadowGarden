import test from "node:test";
import assert from "node:assert/strict";

import { stabilizeContinuousScrollLifecycle } from "../../src/assets/js/reader/rendition.js";

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clock=()=>globalThis.performance?.now?.()||Date.now();

test("Continuous lifecycle suppresses manager maintenance during native resume restoration",async()=>{
  let calls=0,cancels=0;
  const original=()=>{};
  original.cancel=()=>{cancels+=1};
  const manager={
    _scrolled:original,
    scrolled(){calls+=1}
  };

  assert.equal(stabilizeContinuousScrollLifecycle({manager}),true);
  assert.equal(cancels,1,"the old debounce should be cancelled when the safe wrapper is installed");

  manager.__sgSuppressScrollUntil=clock()+120;
  manager._scrolled();
  await delay(55);
  assert.equal(calls,0,"a corrective resume scroll must not enqueue Continuous check/trim work");

  manager.__sgSuppressScrollUntil=0;
  manager._scrolled();
  await delay(55);
  assert.equal(calls,1,"normal user scrolling should resume manager maintenance after suppression expires");
});

test("Continuous lifecycle rechecks suppression before its delayed manager callback",async()=>{
  let calls=0;
  const original=()=>{};
  original.cancel=()=>{};
  const manager={
    _scrolled:original,
    scrolled(){calls+=1}
  };

  stabilizeContinuousScrollLifecycle({manager});
  manager._scrolled();
  manager.__sgSuppressScrollUntil=clock()+120;
  await delay(55);
  assert.equal(calls,0,"resume restoration that begins during the debounce window must cancel deferred manager work");
});
