# Gadwal Operations Guide

This guide documents the safe operational path for the supplied source tree. It is not a substitute for validating the actual hosting project, database, provider dashboard or production credentials.

## Environments and secrets

- Use Node.js 22+ and npm 10+.
- Copy `.env.example` to `.env` only for local development. `.env` is deliberately excluded from source control and distribution packages.
- Configure production secrets in the deployment provider's secret manager, not in this repository or build artifacts.
- Required integrations depend on the workflow: `DATABASE_URL` for PostgreSQL/Neon data, `NEON_AUTH_URL` for Neon Auth, `GEMINI_API_KEY` or `GOOGLE_API_KEY` for Gemini-based features, and OAuth client settings where Google sign-in is configured.
- `APP_ORIGIN` must be HTTPS in production. `ALLOWED_ORIGINS` should list the exact trusted application origins. `FRAME_ANCESTORS` defaults to `'self'`; add only exact HTTPS origins that are demonstrably required. Wildcards are intentionally discarded by the security-header layer.
- `TRUSTED_PROXY_CIDRS`, `DIRECT_DEPLOYMENT` and `REQUIRE_TRUSTED_PROXY` must reflect the actual hosting topology. Do not trust arbitrary forwarded headers.
- In production, `DATABASE_URL`, `NEON_AUTH_URL`, and `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) are required and startup fails closed if one is missing. Configure them in the deployment secret manager.
- New accounts are never made administrators by matching an email address or auth-provider role. The first Owner must be assigned through the one-time guarded bootstrap: create the intended MIU account first, then run `ADMIN_BOOTSTRAP_ENABLED=true ADMIN_BOOTSTRAP_EMAIL=owner@miuegypt.edu.eg npm run db:bootstrap-admin` in a controlled environment with the database secret. Keep the bootstrap flag false afterwards; the script refuses to run once an Owner/Admin exists. Do not paste real values into this guide or source files.
- If credentials or browser cookies were included in an earlier project archive, revoke sessions and rotate applicable credentials if they may still be valid. This package does not contain the original `.env` or cookie file, and cannot rotate third-party credentials on your behalf.

## Install, test and build

```sh
npm ci
npm run typecheck
npm run build
npm run test:release-static
```

The CI workflow uses the npm lockfile and verifies the same core steps. `npm test` includes a wider set of legacy/source-contract and provider-aware checks; review each test's requirements and do not infer that a test has passed if it was not run.

## Database changes

1. Back up the intended database and verify that the backup can be read before applying migrations.
2. Verify `DATABASE_URL` points at the intended disposable/staging database.
3. Apply migrations with `npm run db:migrate` (or the safe deployment wrapper `npm run db:migrate:safe`, after reviewing its configured behavior).
4. Confirm the migration ledger and perform smoke tests for authentication, student read, payment state, entitlements, announcements and audit records.
5. Do not run destructive or mutating tests against production. `npm run test:payments` explicitly opts into a mutating test DB; only run it against a dedicated test database.

## Backups and recovery

- Create a database backup using `npm run db:backup` in an environment with the appropriate PostgreSQL client and permissions.
- Keep backups encrypted, access-restricted, and outside public/static directories and source archives.
- Define retention in the infrastructure owner’s storage policy. This source package does not configure a managed backup destination or prove restore readiness.
- Periodically restore a recent backup into an isolated database and verify schema migration compatibility and key record counts.
- Record who can request, approve and execute recovery. Avoid printing connection strings or backup credentials in logs.

## Release and deployment

1. Review the diff and secret scan results.
2. Run `npm ci`, `npm run typecheck`, `npm run build`, and the static release checks on a clean checkout.
3. Back up the target database; apply migrations in a controlled rollout.
4. Configure environment values through the hosting provider, including production `APP_ORIGIN`, allowed origins, database/auth and integration credentials.
5. Deploy the built artifact and verify `/health` and `/api/health/ready` without exposing infrastructure internals.
6. Run authenticated smoke tests using dedicated non-customer test accounts: role denial, student search/pagination, payment review (without a real payment), entitlement lifecycle, announcements, campaign scheduling, export authorization and audit logging.
7. Verify no production auth cookie lacks `Secure`, `HttpOnly` remains enabled, CSP has no wildcard `frame-ancestors`, and disallowed origins cannot frame the console.
8. Keep rollback instructions tied to the release and database migration plan. Do not automatically roll back irreversible data changes without a tested strategy.

## Incident handling

- Suspected credential or session exposure: restrict distribution, revoke active sessions, rotate relevant provider credentials, inspect provider audit logs, and record completed actions. Do not place leaked values in tickets or logs.
- Unexpected notification audience/delivery: stop the campaign worker if safe to do so, inspect campaign rows and audit records, and determine whether notifications were delivered before retrying.
- Incorrect financial/entitlement data: stop repeated mutation attempts, preserve audit records, reconcile against payment-provider evidence and database history, then perform a reviewed corrective transaction.
- Admin access issue: use documented owner recovery/provider controls; do not bypass server-side authorization or add a public bootstrap endpoint.

## Scheduled notification campaigns

The server campaign processor polls due campaigns every 30 seconds while the server process is running. It commits a claim before delivery to reduce duplicate dispatch risk, marks completed campaigns as `SENT`, and marks claimed failures as `FAILED`. Each campaign currently has a hard maximum of 10,000 recipients. Run one clear production worker topology or use a dedicated durable job runner if scaling out; monitor the campaign queue after deploy.

## Known operational limits

- Deployment credentials, production DNS, provider OAuth settings, payment provider credentials, production database state, managed logs and backup destinations are environment-specific and cannot be verified from this source archive.
- Health/availability and some historical analytics require live data and service-level verification; `Unknown` is preferable to a fabricated healthy value.
- Do not describe CSV/JSON exports as database backups. Exported business data is governed by route permissions and must be stored according to the organization’s privacy policy.
