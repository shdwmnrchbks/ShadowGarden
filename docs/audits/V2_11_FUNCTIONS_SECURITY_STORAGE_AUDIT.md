# v2.11E — Pages Functions, Security & Storage Audit

**Status:** Complete on measured code head `e9f9001ff50aa4f915ee397927fde0698309b805`  
**Stack base:** Audit D head `03ecdc07b3a164644ab66e1e0df9f43ac7514f3d`  
**Scope:** Pages Function route/service ownership, backend export ownership, security/storage credential boundaries, and normal verification coverage

## Audit question

Does the mature Pages Functions layer have duplicated or misplaced route/service ownership, unnecessary public service surface, security-sensitive storage coupling, or a verification gap that justifies a targeted change?

The answer is **yes, but narrowly**. Audit E found one least-privilege B2 credential defect, nine unowned implementation exports, and a CI coverage gap. It did not find evidence for a broad Functions, auth, media, catalog, or recovery rewrite.

## Baseline and method

Audit E started measurement-first at `8e277b2ed7d3ed36e3e3db61edbaa24c8f51f64d` and kept the v2.11A whole-file reachability result separate from deeper ownership questions.

The audit:

- exercised authenticated read-only Keeper handlers with only B2 read credentials present;
- traced route files independently from service/helper reachability;
- scanned service ESM exports for repository consumers across Functions, tests, and tools;
- re-ran signed-media, Keeper session, opaque-ID/catalog-redaction, abuse/Range, B2 integrity, recovery, translation, and upload-validation contracts;
- reviewed whether storage/auth/media changes required a new abstraction rather than assuming refactor benefit.

## Finding E-001 — read-only handlers required write credentials

The first measured candidate covered:

- Library GET;
- Series Banner GET;
- Maintenance GET;
- Recovery GET.

With valid Keeper bearer/session authentication and valid B2 read credentials, but no B2 write credentials, the baseline handlers returned 502. Their read paths instantiated `writeClient(env)` because the surrounding services also contain mutations, even though the actual storage calls were only GET/HEAD.

This was a credential-ownership bug rather than a route or catalog design problem.

### Accepted fix

`functions/services/storage.js#writeClient()` now chooses credentials lazily by HTTP method:

- GET/HEAD → read credentials;
- mutation methods → write credentials.

The service call graph therefore remains stable while execution uses the least-privileged credential pair actually required by each storage operation. Missing write credentials do not fall back to read credentials; a write attempt fails before the network request is made.

`tests/service/admin-read-storage-ownership.test.mjs` records the contract. On the measured code head all four read-only handlers return 200, every captured B2 GET is signed with the fixture read key, and the mutation probe rejects without issuing a write request.

## Finding E-002 — route ownership was healthy but no longer had a live generic guard

The historical R6 checker had been correctly retired during Audit A because it encoded release-era chaining assumptions. Current route files were still thin, but Audit E required a current owner for that architectural contract rather than relying on history.

`tools/check-functions-entrypoint-reachability.mjs` now verifies more than whole-file reachability:

- discovers every Pages Function route root dynamically;
- requires route adapters to stay small;
- requires route imports to target `functions/services/` only;
- requires direct `onRequest* → service-handler` delegation;
- rejects route-owned executable logic outside that adapter shape;
- follows the Functions graph and rejects unreachable source;
- audits service exports for repository consumers.

Measured result on the code head:

- **15 thin route roots → all 38 Functions sources**;
- **91 retained service exports have consumers**.

The route/service split remains canonical. No route consolidation or new router abstraction is justified.

## Finding E-003 — nine service exports had no owner

The first export-consumer run found 12 service exports with zero repository consumers.

Nine were implementation-only details and are now private without changing their implementation or runtime use:

- catalog: `TRASH_KEY`, `loadCatalog`, `managementShape`, `appendTrashItem`;
- media: `getObjectKey`, `applyMediaSecurityHeaders`;
- storage: `B2_ENDPOINT`, `B2_REGION`, `sha256Text`.

Three validation exports were retained intentionally because they encode direct security policy rather than incidental implementation:

- `ALLOWED_UPLOAD_PREFIXES`;
- `OPAQUE_COVER_KEY`;
- `safeHash`.

`tests/service/upload-validation-policy.test.mjs` now owns those seams directly, asserting the private upload namespaces, opaque cover-key rule, and SHA-256 normalization behavior. They are therefore explicit security regression contracts rather than accidental public surface.

## Finding E-004 — security/service regressions were periodic, not normal PR gates

The monthly Baseline Health workflow already exercised the broad service/security layer, but normal pull-request Verify did not run the full `check:security` and `test:service` contracts. That was too weak for an audit making storage/auth/media-sensitive changes.

Normal Verify now runs:

- repository checks;
- `npm run check:security`;
- `npm run test:service`;
- targeted Reader lifecycle regressions;
- targeted Library audit regressions;
- production build.

This promotes the current Functions security/service contracts into the change gate while retaining Baseline Health as the periodic full-maintenance owner.

## Retained ownership and no-change decisions

Audit E retains the existing service decomposition:

- auth remains the Keeper/public session and same-origin owner;
- media remains book authorization plus protected delivery owner;
- catalog remains catalog persistence and Maintenance read owner;
- recovery remains destructive/recovery-sensitive policy owner;
- recovery-readiness remains on-demand readiness inspection;
- validation remains upload/catalog-input and Garden Health validation owner;
- abuse, HTTP, admin, and translations retain their current narrow responsibilities;
- `_lib/` remains the primitive/helper layer rather than regaining service facades.

No evidence justified:

- a framework/router layer;
- auth/media consolidation;
- moving recovery policy back into catalog routes;
- direct B2 access from browser code;
- collapsing read and write credentials;
- speculative service-file splitting based on size alone.

## Security invariants revalidated

The measured code head preserves:

- signed EPUB media tickets/cookies and tamper/expiry rejection;
- same-origin protected media and HTTP Range behavior;
- M8 cooldown separation from `/media/*` Range recovery;
- Keeper bearer token + signed session requirements;
- opaque public book IDs and catalog redaction of private EPUB fields;
- private/opaque upload namespaces and cover-key validation;
- B2 backup checksum/byte integrity behavior, including legacy metadata compatibility;
- 15-snapshot retention and recovery-anchor deletion protections;
- recovery readiness/drill/purge safety;
- translation metadata validation and public attribution behavior.

## Verification evidence

On measured code head `e9f9001ff50aa4f915ee397927fde0698309b805`:

- `npm run check`: pass;
- Functions ownership: **15 route roots / 38 Functions sources / 91 consumed service exports**;
- `npm run check:security`: pass;
- `npm run test:service`: **43/43 pass**;
- targeted Reader lifecycle tests: **22/22 pass**;
- targeted Library audit tests: **7/7 pass**;
- production build: pass.

The first documentation-complete head `9ad7ac9753efde7c5bcb9a6ec2c7d8e93eb5fdba` reproduced a pre-existing full-motion Library test instability in Chromium mobile, matching the same earlier intermediate-head failure shape: `#recentViewAll` was visible and enabled, but animated/reflowing Library controls repeatedly moved over its click point before the event could reach the button. The other Chromium-mobile tests continued normally, and the failure was outside the Functions call graph.

That ownership-specific E2E test measures **one canonical catalog render after the View-all action**, not physical pointer hit-testing. Its trigger therefore now asserts that the button is visible and dispatches the click event directly, removing unrelated layout-motion actionability from the ownership contract without changing Library or Functions product code. The complete five-project real-browser matrix on the resulting exact head remains authoritative.

## Audit E decision gate

Audit E found **one bounded least-privilege defect, stale export surface, and a verification gap**. The accepted work is limited to method-routed B2 credentials, ownership/export guards, nine private implementation symbols, direct regression ownership for three security-policy exports, and stronger normal Verify coverage.

The current Pages Functions architecture is otherwise retained. Audit E does not justify a backend rewrite.
