# Gadwal

Gadwal is a student course and schedule-planning application for MIU students. Its administration console supports student accounts, schedule/OCR operations, support, announcements, manual payment review, access entitlements, pricing, academic periods, system health, audit records and governed data exports.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL/Neon and provider configuration for database-backed runtime features

## Local development

**Dependency lockfile blocker:** the supplied source archive did not include `package-lock.json`, and one could not be generated in the current offline environment. Do not treat this archive as release-build verified until a real npm lockfile is generated and reviewed in a network-enabled trusted environment. Use `npm install --package-lock-only --ignore-scripts` there, inspect and commit the resulting lockfile, then run the clean install below.

1. Run `npm ci` to install the exact dependency versions from the committed `package-lock.json`.
2. Copy `.env.example` to `.env` and populate only the values for your local services. Never commit `.env` or share it in archives.
3. Run `npm run dev` to start the application in development mode.
4. Run `npm run db:migrate` to apply database migrations to the configured database when appropriate. Use a disposable or staging database first.

## Verification

- `npm run typecheck` — TypeScript validation.
- `npm run build` — frontend and server production build.
- `npm run test:release-static` — repository hygiene and source-level release regression checks.
- `npm test` — broader existing application/static test collection; several tests require configured services and should not be treated as purely offline.
- `npm run verify:release` — release and operations readiness gates.

See [`OPERATIONS.md`](OPERATIONS.md) for migration, backup, deployment and incident handling. See [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md), [`docs/ANALYTICS_DICTIONARY.md`](docs/ANALYTICS_DICTIONARY.md), and [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md) for administrator workflows, metric definitions, implementation changes, verification results, and outstanding release blockers. The original audit baseline is in [`docs/ADMIN_AUDIT_REPORT.md`](docs/ADMIN_AUDIT_REPORT.md).
