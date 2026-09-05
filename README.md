# Shadow Garden

Shadow Garden is a self-hosted browser reading library for organizing EPUBs, reading in the browser, keeping reading state, and managing a personal collection.

**Current release: v2.11.0**

## Features

- Personal EPUB library with search, filtering, sorting, and reading-status views
- Browser reader with paginated and continuous reading modes
- Progress, bookmarks, completion state, themes, typography, and reading preferences
- Series organization with per-volume reading actions and metadata
- Responsive desktop and mobile interfaces
- Private administration tools for managing library content and maintenance workflows
- Automated deterministic and real-browser test coverage

## Privacy and security

Shadow Garden is designed around authenticated access, scoped authorization, and private storage for protected content.

Operational credentials and production secrets belong in the deployment platform's secret/configuration stores and must never be committed to the repository. Detailed security mechanisms, credential names, storage topology, internal routes, and operational configuration are intentionally not documented in this public README.

If you operate your own deployment, review the code and configuration for your environment before exposing it publicly.

## Development

Shadow Garden v2.11.0 uses Node.js 22 and npm.

```bash
npm ci
npm test
npm run check
npm run build
```

Local and production configuration is supplied through environment variables and deployment secrets. Do not commit `.env` files, credentials, tokens, or production-only configuration values.

## Repository documentation

The repository retains engineering, release, and maintenance documentation used to develop and verify the application. Because this repository is public, none of those files should be treated as a secure location for credentials or other secrets.

Release history is available in [`CHANGELOG.md`](./CHANGELOG.md).
