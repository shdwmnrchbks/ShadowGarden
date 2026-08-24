# Shadow Garden tests

R8 organizes behavioral regression coverage into four explicit layers:

- `unit/` — pure/domain and browser-local state helpers.
- `service/` — Pages Functions service and security-module integration.
- `dom/` — renderer ownership using narrow DOM test doubles.
- `browser/` — browser-facing entrypoint and high-risk interaction smoke contracts.

Shared deterministic inputs live under `fixtures/`; browser/DOM helpers live under `helpers/`.

Run all layers with `npm test`, or one layer with `npm run test:unit`, `npm run test:service`, `npm run test:dom`, or `npm run test:browser`.

See `docs/architecture/TEST_ARCHITECTURE.md` for ownership and scope.
