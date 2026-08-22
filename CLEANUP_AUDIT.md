# v1.8.0 Cleanup Audit

This file records the repository-wide cleanup performed for Shadow Garden v1.8.0.

## Removed as retired/unreachable
- `.cloudflare-deploy-trigger`
- `reader-continuous-anchor-fix.js`
- `reader-stability.js`
- `reader-seek-neighborhood.js`
- historical public polish stylesheets (`v1-polish.css`, `site-v1.5.css`, `site-v1.6.css`)
- historical Garden Keeper v1.6/v1.7 CSS patch files
- historical v1.7 upload/backup helper filenames

## Consolidated
- Public post-v1.0 polish → `src/assets/css/site-current.css`
- Garden Keeper post-v1.6 workflow polish → `src/assets/css/admin-current.css`
- Generic Keeper shell controls → `admin-overhaul.css`
- B2 read/write client creation and object URL construction → `functions/_lib/b2.js`

## Renamed by responsibility
- `reader-stability.css` → `reader-end-page.css`
- Garden Keeper upload workflow/completion/polish helpers use semantic filenames
- Catalog History renderer uses `admin-backup-history.js`
- Garden Keeper runtime loader uses `admin-bootstrap.js`

## Explicitly preserved
- `reader.js`
- canonical Page Map
- Visual Page Cache
- Paginated visual fit controller
- v1.4.1 Continuous core
- EPUB upload/preflight engines
- catalog schema and B2 object layout
- Garden Maintenance mutation/recovery semantics

## Automated guardrail
`npm run check` now verifies JS syntax, JSON parsing, static duplicate IDs, local/runtime asset references, `_headers` asset paths, and the continued absence of retired compatibility assets. The same check runs in GitHub Actions on pull requests and `main`.
