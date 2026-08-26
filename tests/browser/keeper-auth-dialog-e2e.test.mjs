import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = relative => fs.readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('v2.6 Garden Keeper auth and dialog lifecycle remains a real-browser contract', async () => {
  const [spec, auth, shell, core] = await Promise.all([
    read('tests/e2e/specs/keeper-auth-dialog.spec.mjs'),
    read('src/assets/js/admin/auth-session.js'),
    read('src/assets/js/admin/shell.js'),
    read('src/assets/js/admin/core.js')
  ]);

  for (const marker of [
    'Garden Keeper locked → verified → unlocked keeps modal keyboard and session ownership canonical',
    "page.goto('/admin.html')",
    "page.locator('#adminToken')",
    "page.locator('#unlockButton')",
    "page.locator('[data-e2e-turnstile]')",
    "entry.path === '/admin-access' && entry.method === 'POST'",
    "entry.path === '/admin-api/status' && entry.method === 'POST'",
    "const openNewBooks = page.locator('#openNewBooks')",
    "page.locator('#addBooksDialog')",
    "const openMaintenance = page.locator('#openMaintenance')",
    "page.locator('#maintenanceDialog')",
    "page.keyboard.press('Tab')",
    "page.keyboard.press('Escape')",
    'await expect(openNewBooks).toBeFocused()',
    'await expect(openMaintenance).toBeFocused()',
    "page.locator('#lockButton').click()",
    'expect(browserDiagnostics).toEqual([])'
  ]) assert.ok(spec.includes(marker), marker);

  assert.match(auth, /fetch\("\/admin-access",\{method:"GET"/, 'Keeper auth must obtain the real challenge through /admin-access');
  assert.match(auth, /body:JSON\.stringify\(\{adminToken:tokenInput\.value,turnstileToken\}\)/, 'Keeper auth must submit the token and Turnstile response through the canonical owner');
  assert.match(auth, /await client\.verifySession\(\)/, 'unlock must verify the canonical AdminClient session');
  assert.match(auth, /keeper\.events\.dispatchEvent\(new Event\("session:unlocked"\)\)/, 'unlock must retain the shared Keeper lifecycle event');
  assert.match(auth, /for\(const dialog of document\.querySelectorAll\("dialog\[open\]"\)\)/, 'locking must close active Keeper dialogs');

  assert.match(shell, /function containDialogFocus\(dialog,event\)/, 'Keeper shell must own consistent modal keyboard containment');
  assert.match(shell, /event\.key!=="Tab"\|\|!dialog\.open/, 'modal containment must only intercept Tab inside an open dialog');
  assert.match(shell, /active===last\|\|!dialog\.contains\(active\)/, 'forward Tab must wrap into the modal when focus reaches or leaves its boundary');
  assert.match(shell, /active===first\|\|!dialog\.contains\(active\)/, 'reverse Tab must wrap into the modal when focus reaches or leaves its boundary');
  assert.match(shell, /function showKeeperDialog\(dialog,fallback\)/, 'Keeper shell must retain one modal opening path for its shell-owned dialogs');
  assert.match(shell, /dialog\.showModal\(\)/, 'Keeper dialogs must remain native modal dialogs');
  assert.match(shell, /dialog\.addEventListener\("close",\(\)=>restoreDialogFocus\(dialog\)\)/, 'closing a shell-owned modal must restore its opener when still visible');
  assert.match(shell, /addDialog\.addEventListener\("cancel"/, 'New Books must retain its canonical Escape/cancel owner');

  assert.match(core, /class AdminClient/, 'Keeper requests must continue through the single AdminClient');
  assert.match(core, /headers\.set\("authorization",`Bearer \$\{this\.token\(\)\}`\)/, 'AdminClient must remain the authorization header owner');
  assert.match(core, /verifySession\(\)\{return this\.request\("\/admin-api\/status"/, 'session verification must remain an AdminClient request');
});
