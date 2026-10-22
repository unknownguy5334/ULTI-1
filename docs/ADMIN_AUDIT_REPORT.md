# Gadwal Admin Console — Comprehensive Audit & Decision Report

**Prepared:** 22 October 2026  
**Scope:** Static review of the supplied `g6 (2).zip` project archive, guided by the supplied master brief.  
**Purpose:** Give the project owner an evidence-based list of what to keep, fix, improve, consolidate, or consider building.  
**Baseline status:** This report records the source state at the time of the original audit, before the implementation follow-up. For changes made afterward, current static verification, blockers, and deployment actions, see [`../IMPLEMENTATION_REPORT.md`](../IMPLEMENTATION_REPORT.md). Application source changes in the working project do not mean that a live production deployment or database migration has occurred.

---

> **Historical baseline:** The findings below describe the archive before the follow-up implementation. Do not use the old status tables alone to infer the current working tree. Check [`IMPLEMENTATION_REPORT.md`](../IMPLEMENTATION_REPORT.md) for the patch summary and verification status.

## How to use this report

This is a decision document, not a build specification that assumes every feature is wanted. Each recommendation is marked with:

- **Action:** `Keep`, `Improve`, `Repair`, `Add`, `Consolidate`, `Remove`, or `Investigate`.
- **Priority:** `P0` urgent risk containment; `P1` important correctness/security/reliability; `P2` meaningful operational/product improvement; `P3` optional enhancement.
- **Evidence:** source files and line ranges where a concrete observation can be grounded.
- **Verification:** the test or acceptance condition that should be used before calling an item fixed.

The report deliberately distinguishes **verified source-level findings** from hypotheses that need runtime, database, browser, or deployment verification. A source-level finding demonstrates what the supplied code says or does; it does not prove that the currently deployed system runs the exact same revision.

# 1. Executive assessment

## Overall conclusion

Gadwal is not starting from zero. It is a student-facing course and schedule-planning product for MIU students, supported by a meaningful administration console and a substantial API/database layer. The current admin experience includes a dashboard, product-level analytics, finance reports, student directory, support, announcements, manual payment verification, paid-pass entitlement management, products/pricing, payment-method configuration, schedule/OCR operational views, free-run controls, academic terms, system health, maintenance mode, audit logs, a security center, administrator roles, complimentary access, exports, and application settings.

The best next step is **not a wholesale visual rebuild**. The project should first correct a handful of high-impact behavior and security issues, restore a reproducible release workflow, and make reporting semantics trustworthy. Then improve task flows and decide which additional capabilities are genuinely valuable for this product.

## Highest-priority findings

| ID | Priority | Finding | Why it matters |
|---|---|---|---|
| SEC-01 | **P0** | The supplied archive contains `.env` and `cookies.txt`; `.gitignore` is absent. | Possible credentials/session material should not be redistributed. Validity is unknown, so treat as potentially sensitive. |
| NOT-01 | **P1** | The “Free / Unregistered Students” broadcast choice is treated by the API as “all students.” | An admin can unintentionally notify everyone instead of the selected audience. |
| SEC-02 | **P1** | Content Security Policy `frame-ancestors` includes `*`. | The intended framing/clickjacking restriction is effectively undermined. |
| DATA-01 | **P1** | JSON exports return before writing the export audit event. | Sensitive export activity may bypass the audit log. |
| ANA-01 | **P1** | Analytics date-range buttons do not change the requested dataset; some lifetime counts are labelled as 30-day values. | Administrators can make decisions from incorrectly labelled metrics. |
| USER-01 | **P1** | Student-directory rows display “Active” regardless of the returned account status; a status API exists but the UI does not expose the lifecycle action. | The interface can misrepresent suspended users and lacks a key workflow. |
| DATA-02 | **P1** | Export endpoint grants `ADMIN` and `FINANCE` access to broad datasets; the export screen is owner-only; exports can return up to 20,000 full records. | Permission design is inconsistent, and personal/financial data exposure is broader than the UI suggests. |
| SEC-03 | **P1/P2** | Production cookie `Secure` behavior depends on request HTTPS/proxy/host signals when a request is passed. | A misconfigured reverse proxy/custom domain could weaken cookie transport attributes; verify in the real deployment. |
| REL-01 | **P1** | CI uses `bun install --frozen-lockfile`, but no Bun lockfile is present in the archive; the release verifier instead requires `package-lock.json`, also missing. | The supplied source cannot currently demonstrate a consistent, reproducible release install path. |
| ANA-02 | **P2** | A fixed `suspicious: 0` security value and a hardcoded “Operational” badge can imply verified health without measuring it. | Avoid false reassurance; report `Unknown` when a signal is unavailable. |
| UX-01 | **P2** | The admin header says “MIU Fall/Spring 2024–2025” despite the current date being October 2026. | Stale context undermines trust and can cause operational confusion. |
| QA-01 | **P1/P2** | Several security/test scripts fail due to missing repository hygiene files or stale structural assumptions. | Automated gates cannot be relied on until failures are classified and the suite matches the current source layout. |

## Strengths worth preserving

- **Product fit:** the admin areas align with the actual product—students, scheduling/solver usage, OCR, academic terms, pass entitlements, and manually verified payments—rather than an irrelevant generic store/CMS.
- **Server-side authorization exists:** admin routes generally use role-specific middleware, not only client-side navigation visibility.
- **Sensitive workflows have meaningful foundations:** payment review, entitlements, complimentary access, product price history, audit logging, maintenance settings, and session revocation have backend support.
- **Database structure is substantial:** Drizzle/PostgreSQL schema, migrations `0000` through `0020`, audit/entitlement/payment tables, and indexes are present.
- **Responsive/a11y-oriented source checks exist:** the selected static accessibility, responsive, loading/error, and data/API contract scripts passed. These results are useful, but they are not substitutes for browser-based acceptance testing.
- **Security thinking is visible:** request-origin checks, rate limits, security headers, guarded admin bootstrap, audit rows, and multiple red-team tests exist. The findings below are intended to strengthen this work, not dismiss it.

## Recommended direction

1. **Contain potentially exposed secret/session material and introduce repo hygiene.**
2. **Repair the audience, account status, export audit and analytics correctness issues.**
3. **Make CI/dependency installation and release verification reproducible.**
4. **Run real browser, API-role, database and deployment checks before changing visual architecture.**
5. **Improve existing workflows before creating a large number of new admin modules.**
6. **Only then choose advanced analytics, campaign management, export governance, support workflow improvements, and longer-term observability based on operational need.**

---

# 2. Scope, method, and confidence

## What was inspected

The archive was unpacked for **static inspection only**. The review covered:

- project metadata, README, package scripts and CI workflow;
- public/app entry points and admin entry point;
- admin navigation, modules, shared admin UI utilities, and module/API calls;
- Express server registration and owner/admin route handlers;
- auth and role middleware, cookie normalization, request-security controls, security headers;
- admin service logic and selected observability code;
- database schema/migration inventory;
- release/secret/repository/a11y/responsive/error-state/API-contract static audit scripts.

## What was not done

- The application was **not built or run**.
- No dependency install was performed.
- No TypeScript typecheck or full `npm test` suite was run.
- No live database was connected or queried.
- No Google/Neon/Gemini/OAuth/payment-provider integration was exercised.
- No authenticated browser walkthrough, cross-browser screenshot pass, automated Playwright run, load test, penetration test, or deployment inspection was performed.
- No source code, database migration, configuration, or production system was changed.

Therefore, a few conclusions are “source verified” while many operational claims remain “must verify in environment”. Any finding about a supplied archive should be checked against the exact branch/commit intended for release.

## Confidence labels used

- **Verified — source:** directly supported by checked-in code/config or a reproducible static script result.
- **Strong concern:** code/config creates a credible risk, but exploitation or production impact depends on runtime/deployment conditions.
- **Recommendation:** sensible capability/quality improvement whose priority depends on owner goals.
- **Unknown:** the archive does not provide enough evidence. This is intentionally not treated as proof the feature is absent everywhere.

---

# 3. Product and technical landscape

## 3.1 Product model implied by the code

The product is a student course/schedule planning tool for MIU students. The public application contains a workflow for course-section selection and schedule optimization, OCR-assisted course extraction, preferences, saved optimizer output/schedules, and account/payment-related features. The admin console supports an EGP-priced paid-pass model, manual payment-submission review, entitlements, and per-student/global free-run controls.

This matters because a number of features in the generic master brief are **not automatically appropriate**. There is no source-level justification yet for inventory/fulfillment, a full sales CRM, appointments, a general-purpose page CMS, or a broad marketplace back office. New modules should follow product evidence, not checklist maximalism.

## 3.2 Stack and structure

| Area | Source-level observation | Implication |
|---|---|---|
| Frontend | React and TypeScript, Vite, Tailwind/CSS tokens, Lucide icons. `src/App.tsx` is a large product entry point; `src/AdminApp.tsx` owns admin tab rendering. | Keep the existing stack; improve organization incrementally instead of replacing it. |
| Server | Express application in root `server.ts`, with route/service files under `server/`. | The server is a central integration point; split responsibilities where useful, with backward-compatible route handling. |
| Data | Drizzle ORM and PostgreSQL-oriented schema/migrations. | Preserve migration history and authoritative DB records. |
| Authentication | Neon Auth integration plus role resolution and admin middleware. | Continue enforcing roles server-side; client nav visibility is not an authorization boundary. |
| Payments | Payment submissions/proofs and manually reviewed payment state, paid pass/entitlement tables, payment adjustments. | The present finance workflow is not evidence of a fully integrated card-payment platform. Don’t imply a gateway exists unless separately configured. |
| Product intelligence | Solver/run records, activity audit, registrations, approved payment records, subscription entitlements. | Useful first-party product metrics are possible; broader page-traffic analytics require new, privacy-conscious instrumentation. |
| Admin UI | `src/components/admin/AdminLayout.tsx`, modular pages under `src/components/admin/modules/`, re-export facade `AdminOwnerModules.tsx`, shared utilities `adminShared`. | The UI is already modular in part, although some large modules and legacy files warrant cleanup. |
| Tests | Numerous custom `.mjs` and `.ts` audit/contract scripts. | Existing breadth is a strength; source-pattern tests need a stable contract and true end-to-end coverage. |

## 3.3 Database and business entities visible in the source

The schema/migration inventory includes students, application config, products, payment-method configuration, product-price history, academic periods, payment submissions and adjustments, entitlements, run sessions, saved courses/schedules, activity audit, support tickets/messages, notifications/campaigns and admin audit logs. There are 21 migration files, `0000` through `0020`.

The report did not connect to a database or inspect real production records. Schema availability alone does not prove data completeness, correctness, or successful migration application in an environment.

## 3.4 Primary admin navigation in the archive

The sidebar groups 22 navigation destinations into seven areas:

1. **Executive:** Dashboard, Analytics & BI, Financial Reports.
2. **Customers & CRM:** Student Directory, Support Desk, Announcements.
3. **Revenue & Catalog:** Payment Verifications, Student Passes, Products & Pricing, Payment Methods.
4. **Product & Solver:** Schedule Engine, OCR Extraction, Free Run Quotas, Academic Terms.
5. **Operations & Health:** System Health, Maintenance Mode, Audit Trail.
6. **Security & Access:** Security Center, Administrators, Complimentary Access.
7. **System & Data:** Reports & Exports, App Settings.

Role filtering is present in the sidebar. The backend also gates route groups by role, which is the correct design direction. Some UI/backend permission inconsistencies need narrowing (especially exports and student status actions).

---

# 4. Critical and high-priority findings

## SEC-01 — Sensitive local material in the supplied archive

**Action:** `Repair`  
**Priority:** **P0 — contain first**  
**Confidence:** Verified archive contents; validity of any secret/session material is unknown.  
**Evidence:** archive root contains `.env` and `cookies.txt`; no `.gitignore` is present. `.gcloudignore` excludes environment files but does not exclude `cookies.txt`.

The supplied ZIP includes a populated environment file with non-empty database/auth-provider configuration values and a cookie file containing browser/cloud-service cookie material. No values are repeated in this report. It is not possible to tell from the archive alone whether these values are current, production-grade, expired, or scoped to a test environment. The safe assumption is that they may be sensitive until verified otherwise.

### Recommended response

1. Stop redistributing the current ZIP. Create a clean source-only archive that excludes `.env`, browser cookies, auth/session files, logs, database dumps, local backups and build artifacts.
2. If any values belong to a live environment, rotate the applicable credentials and revoke the relevant sessions/tokens. Review provider access/audit logs where available. Do not assume a leak occurred; treat this as precautionary containment.
3. Add and review `.gitignore` entries for `.env`, `.env.*` (while explicitly allowing `.env.example`), cookie/session files, local DB dumps/backups, logs, `node_modules`, and generated build output.
4. Keep `.gcloudignore`, Git ignore policy, CI artifact policy and any source export/ZIP generator aligned. The fact that `.gcloudignore` excludes `.env` is not sufficient if other archives include it.
5. Add a secret scan as a release gate that does not print discovered secret values into logs.
6. Verify whether the environment file or cookies ever entered Git history or an artifact registry. The supplied archive does not prove either way.

### Acceptance criteria

- A generated release/source archive contains no `.env`, `cookies.txt`, credential JSON, local auth state, DB dumps, or secret-bearing logs.
- A clean checkout has a `.gitignore` and an accurate `.env.example` with placeholders only.
- Secret scanning passes without exposing the matched contents.
- If live credentials/session tokens were present, rotation/revocation is recorded and verified.

## SEC-02 — Content Security Policy allows framing from any origin

**Action:** `Repair`  
**Priority:** **P1**  
**Confidence:** Verified in source; runtime headers were not inspected.  
**Evidence:** `server/securityHeaders.ts:15-28`, especially line 16.

`frame-ancestors` is assembled as a string that ends with `*`. That is incompatible with a restrictive clickjacking policy: it opens the policy far more widely than the named trusted Google/AI Studio/Run hosts imply. `server/config.ts` appears to expose a configurable frame-ancestor setting, but the current policy uses a hardcoded source list rather than that configured value.

The same CSP also permits broad `connect-src` schemes (`http:` and `https:`) and includes `unsafe-eval`/`unsafe-inline` in `script-src`. Some allowances may be required by the current app or identity provider; they should be justified rather than blindly removed.

### Recommendation

- Remove the broad `*` from `frame-ancestors` and compose the directive from an allowlist that is explicit and environment-aware.
- Confirm whether the app truly needs to be embedded in AI Studio or Google/Run environments; allow only the minimum domains actually needed.
- Tighten `connect-src` and script policy in staged changes, using browser report-only/testing first where helpful.
- Inspect actual response headers for `/`, `/admin`, auth callback flows and API endpoints in staging.

### Acceptance criteria

- Disallowed origins cannot frame the admin console.
- Legitimate Google identity and necessary hosting flows still work.
- Automated header tests assert that wildcard framing is absent and that expected directives are present.

## SEC-03 — Authentication cookie transport attributes depend on proxy signals

**Action:** `Improve` / `Investigate`  
**Priority:** **P1/P2**, based on deployment topology  
**Confidence:** Strong concern; runtime TLS/proxy behavior not tested.  
**Evidence:** `server/authRoutes.ts:38-70`; `scripts/test-cookie-environment-static-audit.mjs` failed the check that production auth cookies are forced Secure under the deployment environment invariant.

Cookie normalization adds `Secure`, `SameSite=None`, and `Partitioned` when the request appears HTTPS by `req.secure`, selected forwarding headers, or a `.run.app`/`aistudio` hostname. For an ordinary request passed into the helper, production configuration is not itself an unconditional `Secure` check. This can be correct when the hosting proxy reliably communicates scheme, but it creates a deployment-dependent guarantee.

### Recommendation

- Define one explicit production cookie policy. Use the framework’s trusted proxy configuration rather than trusting arbitrary forwarding headers, and force secure transport for production HTTPS deployments.
- Confirm that the application uses only trusted proxy inputs and that clients cannot spoof the signals relevant to the decision.
- Verify `HttpOnly`, `Secure`, `SameSite`, `Partitioned`, domain/path and session-expiry semantics against the actual identity provider and supported embedding environment.

### Acceptance criteria

- Integration tests cover local HTTP, production HTTPS, trusted reverse proxy, custom production domain, and unexpected/missing forwarding headers.
- Production responses never set auth cookies without `Secure` when TLS is required.
- Login, logout, session renewal, and embedded sign-in remain functional.

## NOT-01 — “Free / Unregistered Students” broadcasts can target all registered students

**Action:** `Repair`  
**Priority:** **P1**  
**Confidence:** Verified in source.  
**Evidence:** `src/components/admin/modules/NotificationsModule.tsx` target selector; `server/adminOwnerRoutes.ts:285-303`.

The UI offers `UNREGISTERED` as “Free / Unregistered Students.” The broadcast API accepts `UNREGISTERED` as a recognized scope, but the server only constructs specific database conditions for `VERIFIED` and `PAID`. Every other scope—including `UNREGISTERED` and `CUSTOM`—falls through to an undefined condition and selects all rows in `students`. That means choosing the “Free / Unregistered Students” option can broadcast to all registered students, not to a free/unregistered subset.

There is also no obvious separate “unregistered user” data model in the inspected target-selection query: it queries the `students` table. The product owner needs to decide what “free” means precisely (e.g. registered students without an active entitlement) and whether true non-account visitors are actually addressable.

### Recommended response

- Immediately remove/disable any audience option whose semantics are not implemented.
- Define target predicates in one shared server-side function and reject unsupported target scopes with `400`; never silently fall back to `ALL`.
- If “free” means registered but without an active entitlement, implement that exact query and label it accordingly. If “unregistered” means non-account visitors, do not offer it unless the system has a consented, addressable audience source.
- Preview a recipient count and representative criteria before sending. Require a deliberate confirmation for large/broad audiences.
- Add a regression test that calls the API with `UNREGISTERED` and proves it never selects all students by default.

### Acceptance criteria

- `ALL`, `VERIFIED`, `PAID`, and any newly supported scopes each map to a documented exact predicate.
- Unknown/unsupported scopes return validation errors and send zero notifications.
- UI labels match implemented query semantics, and the recipient estimate matches the eventual dispatch count.
- A test proves “free” targeting excludes active paid-pass holders if that is the intended rule.

## DATA-01 — JSON exports bypass export audit logging

**Action:** `Repair`  
**Priority:** **P1**  
**Confidence:** Verified in source.  
**Evidence:** `server/adminOwnerRoutes.ts:567`.

The export route returns `res.json(rows)` immediately when `format=json`; the `DATA_EXPORT` audit event is only written in the CSV branch that follows. JSON export downloads and previews therefore do not reach that log call. The CSV flow also logs only after the dataset is fetched and serialized, so failed export attempts are not consistently represented.

### Recommendation

- Centralize export authorization, event creation, and response generation so every successful export format is logged.
- Log the actor, export kind, output format, filtered scope, number of records/bytes where appropriate, timestamp, correlation/request ID and result status. Do not log the exported row contents or secrets.
- Decide explicitly whether denied and failed export attempts should be logged (recommended for sensitive datasets), ensuring failure logging does not mask the original error.
- Retain the existing role middleware; do not implement this as a client-only change.

### Acceptance criteria

- CSV, JSON, preview, bulk, success, denial and failure paths produce the expected audit event policy.
- Logs contain metadata only, not PII rows or file contents.
- Tests verify a JSON export creates an audit record just as a CSV export does.

## DATA-02 — Export API permission/scope and data minimization need review

**Action:** `Improve` / `Repair`  
**Priority:** **P1**  
**Confidence:** Verified source-level permission mismatch; effective risk depends on roles actually granted.  
**Evidence:** `src/components/admin/AdminLayout.tsx:63-67`; `server/adminOwnerRoutes.ts:567`; `src/components/admin/modules/DataExportsModule.tsx:145-179, 198-219`.

The sidebar makes Reports & Exports owner-only, but the server export endpoint allows `OWNER`, `ADMIN`, and `FINANCE`. Direct API requests by an allowed `ADMIN`/`FINANCE` actor are therefore not blocked simply because their UI hides the export page. Server authorization is present, but the server policy appears broader than the product UI’s stated access boundary.

The endpoint returns up to 20,000 unfiltered rows for several datasets using `select().from(table).limit(20000)`, including full student/payment/support/schedule records. The export page’s preview path fetches the entire JSON dataset and only slices the first 10 rows for the displayed sample; it also stores the full serialized response in component state for copy-to-clipboard. A “preview” can therefore pull a large sensitive dataset into the browser.

The CSV serializer quotes values and escapes double quotes, but does not appear to neutralize spreadsheet formula-leading characters, which can be risky when user-controlled text is opened in spreadsheet software.

### Recommendation

- Create a clear export permission matrix by dataset and format. For example, distinguish summary finance exports from student PII, payment proof metadata, support contents and saved schedule data.
- Make backend permissions the source of truth and align the UI with them.
- Default to least privilege; consider owner-only access for full-record exports and specific additional permission grants for scoped exports.
- Return a bounded preview endpoint (`limit`, safe field list, explicit sample-only mode) rather than downloading the full dataset and slicing client-side.
- Use field allowlists instead of whole-table serialization. Exclude secrets, unnecessary identifiers, detailed support content, or other sensitive columns when not essential.
- Add pagination/date/filters, file-size/row-count limits and export retention guidance; use streaming for large exports if practical.
- Mitigate CSV formula injection for spreadsheet-bound formats and test fields beginning with `=`, `+`, `-`, `@`, tab or carriage return.

### Acceptance criteria

- A direct API authorization matrix proves each role can access only approved dataset/field/format combinations.
- Preview transfers only the requested sample and does not cache the full export in UI state.
- Large data sets have predictable bounds and no avoidable full-table browser memory spikes.
- CSV exports are safe to open in common spreadsheet clients.

## USER-01 — Student status is displayed as “Active” for every result

**Action:** `Repair`  
**Priority:** **P1**  
**Confidence:** Verified in source.  
**Evidence:** `src/components/admin/modules/StudentsModule.tsx:155-160`; status mutation API exists at `server/adminOwnerRoutes.ts:333`.

The Student Directory renders a green check and the literal text `Active` for every returned student, rather than reading the account’s `accountStatus`. At the same time, the backend has a route to change status between `ACTIVE` and `SUSPENDED`, yet the shown table’s only row action is “Quota”; no suspend/reactivate action is exposed in this module.

### Recommendation

- Render a status label sourced from the returned account state and handle unknown states visibly.
- Decide whether admin/support roles should be allowed to suspend/reactivate students, then surface the appropriate action with reason capture, confirmation, and status feedback—or document why status changes are handled elsewhere.
- Ensure the API prevents self-suspension where relevant, checks actor permission on the server, records the reason and actor, and has a safe reactivation path.
- Add search/filter for active/suspended/pending verification states and pagination if the dataset can grow.

### Acceptance criteria

- A suspended account displays “Suspended” and correct status metadata.
- Updating the account status persists, is reflected after refresh, and writes an audit event.
- Unauthorized roles cannot perform a status change with a direct API request.

## ANA-01 — Analytics date-range controls are currently decorative

**Action:** `Repair`  
**Priority:** **P1**  
**Confidence:** Verified in source.  
**Evidence:** `src/components/admin/modules/AnalyticsModule.tsx:9-12, 60-75`; `server/adminOwnerRoutes.ts:339-392`.

The analytics page stores `timeRange` in local state and changes which selector looks active. The request still calls `/api/admin/owner/analytics` without a date-range parameter, and the backend does not branch on a requested range. Selecting “Past 7 Days,” “Past 30 Days,” or “Lifetime” does not change the displayed dataset.

### Recommendation

- Either remove the selector until implemented or pass a validated range to the API and apply it consistently to every metric and series.
- Include the selected range in the page title/export metadata and all chart/table query definitions.
- Add explicit timezone, inclusive/exclusive boundary, comparison-period and empty-data rules.

### Acceptance criteria

- Changing the range causes a new request or a correctly filtered derived result.
- A database fixture containing events inside and outside the range produces expected totals.
- CSV output contains the same filters/range as the on-screen report.

## ANA-02 — Some metrics contradict their labels and definitions

**Action:** `Repair`  
**Priority:** **P1**  
**Confidence:** Verified source-level query/label mismatch.  
**Evidence:** `server/adminOwnerRoutes.ts:343-355`; `src/components/admin/modules/AnalyticsModule.tsx:21-23, 106-113`.

The API calculates total and failed run counts directly from `runSessions` without a date filter, while the UI labels the value “Schedule Runs (30d)” and labels its failed-count/error percentage as if they share that period. If the underlying tables are lifetime records, the count and error percentage are lifetime, not 30-day values. Other series, such as signups/runs/revenue, are derived for recent daily periods, so the dashboard mixes metrics with different windows.

The page also fetches `dailyRevenue`, but the currently inspected UI does not display it. Revenue is calculated from approved payment submissions by creation date; it may be a gross approved-submission total, not necessarily net cash after refund/correction adjustments. “Revenue” should not imply net recognized revenue unless the business definition accounts for the relevant adjustments.

### Recommendation

- Publish a metric dictionary for each KPI: business meaning, SQL/source, window, timezone, inclusion/exclusion rules, freshness and known limits.
- Either add date conditions to run counts and failed-run counts or label the values “Lifetime”. Ensure the numerator and denominator used for error rate use the same period and population.
- Define revenue as gross approved submissions, net receipts, or another explicit measure. Reconcile refunds, corrections and adjustments consistently in financial reports.
- Either show daily revenue in the current UI or remove the unused fetch from that report.
- Put period filters in a shared validated query builder to prevent each metric using a different window accidentally.

### Acceptance criteria

- Sample records across several dates produce known, verified 7-day, 30-day and lifetime outputs.
- The error-rate numerator and denominator use the same range/status rules.
- Finance and analytics totals reconcile to an explicitly documented gross/net definition.

## ANA-03 — “Suspicious: 0” and “Operational” can communicate unsupported certainty

**Action:** `Repair` / `Improve`  
**Priority:** **P1/P2**  
**Confidence:** Verified hardcoded UI/service values; exact presentation/usage requires runtime check.  
**Evidence:** `server/services/adminOwnerService.ts` (security summary includes `suspicious: 0`); `src/components/admin/modules/DashboardModule.tsx:220-223`.

A security summary value set to a constant zero is not equivalent to “no suspicious activity found.” If no detector is configured, zero implies a measurement that did not happen. Likewise, the dashboard renders an “Operational” badge in a system-posture block without this specific badge being derived from an active health check. These can make an administrator feel safer than the evidence justifies.

### Recommendation

Use explicit states such as `Healthy`, `Degraded`, `Incident`, `Not configured`, or `Unknown`, each grounded in a check and timestamp. If suspicious-event detection does not exist, show `Not monitored` rather than zero. Separate “last known health check succeeded” from overall business posture.

### Acceptance criteria

- Every health/security status names its source, last-check time and failure/unknown state.
- A disabled/unavailable signal appears unknown, not healthy/zero.
- Tests cover stale health-check data and monitoring-provider outages.

## REL-01 — CI and release verification require incompatible/missing lockfile inputs

**Action:** `Repair`  
**Priority:** **P1**  
**Confidence:** Verified in archive.  
**Evidence:** `.github/workflows/ci.yml`; `scripts/verify-release-config.mjs:3-15`; `package.json` scripts `ci:install`, `verify:release`, `verify:predeploy`.

The CI workflow installs Bun `1.2.20` and runs `bun install --frozen-lockfile`, but the archive contains no `bun.lock`/`bun.lockb`. The release verification script checks only for `package-lock.json`, which is also absent, and requires `OPERATIONS.md` plus `scripts/backup-database.sh`. No `OPERATIONS.md` is present in the archive. Package scripts also expose an npm `ci` path (`npm ci`) and the source release verifier is npm-lock-specific, while CI itself is Bun-based.

This creates a clear tooling-policy inconsistency and means release verification fails on missing files in the supplied snapshot. The report does not run or alter dependency installation to determine whether a different branch has these artifacts.

### Recommendation

- Choose one authoritative package manager for CI/release. If Bun is the standard, commit its lockfile and update the release verifier to check that lockfile. If npm is the standard, use `npm ci` and commit `package-lock.json` consistently.
- Ensure the release verifier checks the selected workflow rather than demanding an unrelated lockfile.
- Add the missing operational documentation and backup script only after deciding their real content and security model; do not add placeholder scripts just to satisfy tests.
- Pin GitHub Actions to reviewed commit SHAs if the organization requires supply-chain pinning; explicitly declare minimal workflow permissions and avoid unnecessary token persistence.

### Acceptance criteria

- A clean checkout can install dependencies from the committed lockfile using the exact CI command.
- CI typecheck and build complete successfully from a clean environment.
- `verify:release` and `verify:predeploy` no longer fail on missing policy artifacts and have documented prerequisites.
- Recovery/backup instructions describe real commands and have been rehearsed in a non-production environment.

## QA-01 — Static test suite needs repository-hygiene fixes and contract synchronization

**Action:** `Repair` / `Improve`  
**Priority:** **P1/P2**  
**Confidence:** Verified selected script outcomes from the supplied archive.  
**Evidence:** static script runs summarized in [Section 13](#13-static-test-results-and-verification-gaps).

Two repository/secret-oriented scripts fail because they assume `.gitignore` exists. The comprehensive admin source audit reports many failures where tests appear to expect component implementations in files that now re-export from `AdminOwnerModules.tsx`; some failures are likely stale static assumptions rather than confirmed runtime defects. This is evidence that the audit harness has drifted from the current modular architecture, and that a red test cannot automatically be equated to a production bug without classification.

### Recommendation

- Create a test inventory with columns `test`, `type` (static/unit/integration/e2e), `source of truth`, `what it proves`, `known limitation`, and `owner`.
- Replace brittle file-layout regexes with exported symbol/route/behavior assertions where possible.
- Keep security checks strict, but avoid silently weakening a check just to make it green; map each failure to either a real issue, a stale test, or a justified change in architecture.
- Make `npm test`/the chosen test command work in a clean checkout and distinguish offline static tests from tests that require database/provider credentials.
- Add true workflow tests for notifications, exports, account status, and analytics ranges; these are higher value than additional static check count alone.

### Acceptance criteria

- Every failing release-gate script has an explicit disposition.
- The complete selected CI test suite runs from a clean checkout without missing-file errors.
- Tests validate behavior, not just that specific JSX strings or paths appear in fixed locations.

---

# 5. Full admin module inventory

The status describes what was found in source, not a claim that the module has been browser-tested or is production-perfect.

| Module | Current state / useful capability | Classification | Priority | Recommended next step |
|---|---|---|---|---|
| **Dashboard** | Real overview endpoint shows registered students, active passes, gross revenue, open support, config and operational shortcuts. | `Keep` + `Improve` | P1/P2 | Repair active payment-channel count; remove the unsupported hardcoded “Operational” status; document KPI definitions; make key cards navigable and keyboard accessible. |
| **Analytics & BI** | First-party counts for students, active/paid passes, run sessions, recent registrations and approved payments; simple recent-activity tables and CSV export. | `Repair` + `Improve` | P1 | Fix period selector and mislabeled lifetime counts; define metrics/timezone; reconcile revenue; show freshness/data quality; keep claims limited to the data measured. |
| **Financial Reports** | Backend aggregates approved payments by date/method/tier and provides a revenue export. | `Keep` + `Improve` | P1/P2 | Define gross/net revenue, refund adjustments and reporting periods; reconcile results to payment ledger; give finance role sensible date filters and drill-down. |
| **Student Directory** | Searchable student listing; role filter; free-run quota adjustment; account status route exists server-side. | `Repair` + `Improve` | P1 | Display actual status, expose authorized suspend/reactivate flow if desired, add state filtering and server pagination, review personal fields. |
| **Support Desk** | Ticket listing, reply, status updates, assignment behavior and notification after a reply exist in backend/UI. | `Keep` + `Improve` | P2 | Add/verify assignment, response-time metrics, search/status filters and pagination. Review list endpoint’s per-ticket message query pattern for query amplification. |
| **Announcements / broadcasts** | Immediate in-app broadcast and history; backend additionally contains scheduled-campaign endpoints and a periodic processor. | `Repair` + `Improve` | P1 | Fix audience targeting first. Add recipient preview and confirmation. Expose draft/scheduled campaign management in UI only if scheduling is needed. |
| **Payment Verifications** | Manual payment-submission review and backend approve/reject/correction/refund-related flows. | `Keep` + `Improve` | P1/P2 | Test race/idempotency behavior; require appropriate rejection/correction rationale; show payment and entitlement history; verify all sensitive state transitions are audited. |
| **Student Passes / Entitlements** | Grant/revoke/extend/shorten/restore/replace-related backend capabilities and current access management UI. | `Keep` + `Improve` | P1/P2 | Add a clear entitlement timeline and “why access changed” context; test expiry boundaries and duplicate grants; preserve auditability. |
| **Products & Pricing** | Plans can be created/edited/deactivated; price history exists; EGP is the current configured currency. | `Keep` + `Improve` | P2 | Add scheduled availability only if business needs it; validate price bounds and transitions; preview student-facing pricing before publishing. |
| **Payment Methods** | Admin can configure enabled state, destinations/instructions; stored configuration is read via the overview/method API. | `Keep` + `Improve` | P1/P2 | Clarify enabled vs configured status, preview student-facing instructions, and audit changes. Never treat this as evidence of an integrated online card gateway. |
| **Schedule Engine** | Admin navigation and operational/product views for solver usage exist. | `Keep` + `Investigate` | P2 | Clarify supported actions vs monitoring-only. Add run-level failure drill-down and retry only if safe/reliable. Avoid exposing students’ saved inputs beyond role need. |
| **OCR Extraction** | The product uses OCR-related workflows and event/activity logging; admin navigation exposes an OCR operational view. | `Keep` + `Investigate` | P2 | Verify what the UI actually displays and whether it links to actionable failures. Track OCR success/failure/latency using real persisted data; redact uploaded image/customer data. |
| **Free Run Quotas** | Owner controls default allowance and can adjust a student’s free-run allowance. | `Keep` + `Improve` | P2 | Add reason capture for high-impact quota grants/changes, show before/after, validate bounds and monitor abuse without exposing unnecessary student data. |
| **Academic Terms** | Academic-period records are editable/listed and support product context; static sources use academic terms. | `Keep` + `Improve` | P1/P2 | Add validation for overlapping/invalid date windows and clear active-term semantics. Remove stale hardcoded academic-year labels elsewhere. |
| **System Health** | Health/operations endpoints and an admin health page exist. | `Keep` + `Improve` | P1/P2 | Ensure it displays fresh DB/API/job/integration checks rather than static statuses. Add last-checked time and unknown/degraded states. Do not expose infrastructure secrets. |
| **Maintenance Mode** | Backend reads and updates maintenance configuration. | `Keep` + `Improve` | P1 | Add impact preview, visible start/end behavior, emergency guardrails, and a clear public-facing message preview; test bypass rules for admin access. |
| **Audit Trail** | Admin audit log table and mutation audit writes exist for numerous sensitive operations. | `Keep` + `Improve` | P1 | Fix the JSON-export audit gap; verify completeness across every mutation and failed sensitive attempt; define retention/search/download policy and prevent editing/deleting audit records casually. |
| **Security Center** | Owner-only summary and session revocation endpoint exist. | `Improve` + `Investigate` | P1/P2 | Replace unmeasured “suspicious 0” with `not monitored` unless detection exists; document session revocation semantics; MFA and security-event history require provider/runtime verification. |
| **Administrators** | Admin roles can be listed/changed; owner-protection rules are described in source; server role checks exist. | `Keep` + `Improve` | P1 | Verify least-privilege permission matrix and last-owner protection in API tests; add role-change confirmation and explain effective permissions. |
| **Complimentary Access** | Owner-only grants/revokes of access with a reason and audit support are present. | `Keep` + `Improve` | P1/P2 | Make reason mandatory; show affected student, term/expiry, scope and audit history; verify role and transaction behavior. |
| **Reports & Exports** | Several datasets support CSV/JSON; UI includes dataset search/category filtering and bulk export/preview. | `Repair` + `Improve` | P1 | Audit JSON exports, narrow permissions/fields, stop full-data preview, fix bulk success reporting, use bounded queries, and defend spreadsheet exports. |
| **App Settings** | Global app configuration, support contact, quotas, and maintenance-related settings have backend support. | `Keep` + `Improve` | P2 | Separate personal preferences from global settings; validate settings; show preview/change history for settings that affect users. |
| **Scheduled notification campaigns** *(backend capability without visible page found)* | Campaign listing/save endpoints and a 30-second scheduled processor are present; the inspected UI calls only the immediate notifications endpoint. | `Add` UI or `Investigate` | P2 | Confirm whether scheduling is an intended product feature. If yes, add draft/scheduled/sent/failed states, editing/canceling, time-zone clarity and dispatch audit. Otherwise document the backend API as internal and prevent confusing orphaned behavior. |
| **Global admin search** | No unified search spanning students, payments, tickets, audit and schedules was found in the inspected navigation/page wiring. | `Add` *(optional)* | P3 | Consider only after common workflows are measured; use role-scoped server search and never mix sensitive result sets indiscriminately. |
| **Content/SEO CMS** | Public content appears substantially code/static-data driven; no first-party broad CMS workflow was established by this audit. | `Investigate` | P3 | Do not build a generic CMS by default. First identify which public text/pages genuinely need business-user editing, then choose a small structured editor or keep content in code. |

## 5.1 Cross-cutting “keep” decisions

Preserve these foundations unless runtime verification reveals a defect:

- server-side role checks and persistent rate limiting on owner-console routes;
- guarded owner bootstrap with explicit enable flag and database transaction/advisory locking;
- request-origin checks for state-changing `/api/*` calls;
- payment submission and entitlement records as authoritative business data;
- product price history and admin audit log data;
- existing Drizzle migration history and indexes;
- responsive admin layout and shared `Page`, `ErrorBox`, `InlineNotice`, `Btn` and data-fetching utilities;
- existing public schedule-builder workflow and its local-state/result-signature protections.

These are preservation recommendations, not a guarantee that every edge case is correct in production.

---

# 6. Detailed UX/UI and workflow review

## 6.1 Navigation and route state

**Observed:** `src/AdminApp.tsx:33` stores `activeTab` in component state initialized to `dashboard`; `AdminLayout` calls `setActiveTab` from sidebar buttons. No URL-based tab/deep-link mapping was found in this path.

**Impact:** refreshing the page can return an administrator to the dashboard rather than the same report; a tab cannot easily be bookmarked/shared; browser back/forward may not reflect their admin navigation. This is not a data-integrity bug, but it reduces usability and frustrates support/debugging.

**Recommendation:** introduce a stable route or query/hash representation for admin modules while preserving authorization redirects. Maintain filter/query state in the URL only where useful and safe—never place tokens or sensitive data in it.

**Acceptance:** opening `/admin/analytics` (or the chosen canonical route) lands on Analytics after refresh; back/forward behaves predictably; an unauthorized role cannot load the restricted route even if manually entered.

## 6.2 Stale academic-term labels

**Observed:** the top bar in `src/components/admin/AdminLayout.tsx:267` displays “MIU Fall/Spring 2024–2025”. The notification composer also has a stale example placeholder referring to “Spring 2025”.

**Impact:** the product is intended to be operated across academic terms; stale labels signal an unmaintained interface and risk sending out outdated announcements.

**Recommendation:** derive term information from the academic-period configuration and effective date, or omit it where no confident current-term determination exists. Example copy should be generic or generated from the selected campaign term.

## 6.3 Visual consistency and design-system direction

The admin area uses recurring slate/emerald utility classes and rounded panels, while other parts of the app include distinct paper/brand token conventions. This is not evidence that the current look is unusable; it suggests that styling has evolved across layers. Brand assets exist under `public/brand/`.

**Recommendation:** standardize the admin experience around tokens already present in the product rather than redesigning from scratch. Document:

- color roles (surface, muted surface, border, primary, success, warning, danger, focus);
- typography and spacing scale;
- button/input/table states;
- empty/loading/error/permission-denied states;
- badge and metric-card semantics;
- drawer/dialog behavior and focus management;
- mobile rules for tables, charts and action bars.

Maintain suitable information density for daily administrative work. Avoid oversized decorative KPI cards where a dense table is more useful.

## 6.4 Accessibility and interactions

A static accessibility audit passed 23/23 checks, and a responsive implementation audit passed 25/25. This is encouraging but proves only that those source checks matched expected patterns; it does not verify real keyboard/screen-reader behavior.

Specific items to test manually or in browser automation:

- nav buttons should expose their current state (`aria-current`, `aria-selected` or equivalent as appropriate);
- the mobile drawer needs coherent dialog/navigation semantics, focus entry/return and Escape behavior;
- icon-only buttons need accessible names;
- clickable KPI cards should be real links/buttons, not generic clickable containers;
- the student quota modal should trap/return focus, support Escape if safe, announce errors, and not close unexpectedly while saving;
- tables must have accessible captions/headers and a practical mobile pattern;
- chart alternatives should provide numeric context and accessible data, not just color;
- forms need field-level errors and preserve the entered values after failed submissions.

## 6.5 Common workflow improvements

The most valuable immediate usability fixes are not animations or a visual overhaul; they are clarity and confidence:

- show “what changed” and “why” after payment, access, quota, role, term, notification and configuration mutations;
- display the current record status rather than defaults or hardcoded status values;
- provide an audit/history side panel for sensitive records;
- provide a recipient count and final audience summary before broadcasts;
- retain search filters when viewing and returning from a student/ticket/payment detail;
- show data freshness, date range and metric definitions beside numbers;
- replace ambiguous green “success/operational” status with a timestamped, evidence-backed state;
- disable repeated submits while requests are in flight and distinguish uncertain network outcome from confirmed backend success.

---

# 7. Analytics and measurement plan

## 7.1 What exists now

The inspected analytics API derives metrics from business/application records including:

- total students and active/verified students;
- active paid entitlements and plan breakdowns;
- total and failed run sessions;
- recent active students based on activity-audit events;
- new registrations over 30 days;
- approved payment submissions in a recent period;
- daily signups/runs/revenue series.

These are useful beginnings for **product and business analytics**. They should be labeled accurately and kept distinct from page-traffic analytics.

## 7.2 What is not established by the archive

The source reviewed does not establish a complete, persisted first-party web analytics platform for page views/sessions/acquisition. `server/observability.ts` shows that `recordServerMetric` logs metrics only in debug mode outside production and otherwise does not persist them; the public web-vitals path records through this function. The inspected RUM code captures selected performance metrics, not a full page/event/marketing funnel.

Consequently, reports for page views, traffic sources, campaign attribution, device/browser/geography, visitor sessions, cohort retention or public-page conversion should not be promised as already available. Some can be added, but their data model, consent/privacy approach, sampling, bot exclusion, retention and definitions must first be decided.

## 7.3 Suggested metric dictionary

Before extending the analytics UI, define metrics such as:

| Metric | Proposed definition to approve | Source needed | Important caveat |
|---|---|---|---|
| Registered students | Count of non-deleted student accounts as of report cutoff | Student/account table | Clarify treatment of tombstoned/deleted accounts and test accounts. |
| Verified/active students | Count where account status meets defined active/verification semantics | Student table | Do not conflate email verification with active account status without a shared definition. |
| Weekly active students | Distinct student IDs with one or more qualifying product events in trailing 7 days | Persisted product activity events | Define qualifying events and exclude admin/test jobs. |
| Solver runs | Count of actual run-session records created in range | Run sessions | Decide if retries count as new runs and how abandoned/failed runs are categorized. |
| Solver success rate | Completed qualifying runs divided by all eligible runs in the same period | Run sessions | Use a consistent denominator; document excluded statuses. |
| OCR success rate | Successful extractions divided by valid OCR attempts | OCR event/session store | Persist latency, failures, and sanitized error categories. |
| Paid conversion | Defined eligible student cohort with active paid entitlement divided by corresponding registered cohort | Students + entitlements | Lifetime ratios differ from period-cohort conversion; label which is used. |
| Gross approved payment submissions | Sum/count of approved submission records in range | Payment submissions | Can differ from settlement/net revenue and refund-adjusted figures. |
| Net revenue/receipts | Owner-approved accounting definition after applicable refunds/adjustments | Payments + adjustments/provider settlement if applicable | Requires reconciliation rules and consistent currency/time zone. |
| Renewal/expiry rate | Eligible entitlements renewing/expiring in period based on lifecycle state | Entitlements/history | Requires reliable entitlement lifecycle events, not only present status. |
| Page views/sessions | Consent-compliant first-party event/session definitions | Event collection/storage | Not currently established as complete; don’t infer total market traffic from first-party events alone. |

## 7.4 Suggested analytics delivery order

1. **P1 — Correct current metrics:** range wiring, labels, formula parity, revenue definition, timezone and export parity.
2. **P2 — Data trust:** freshness indicator, last successful event/query time, missing event warnings, source and definition on hover/detail, reconciliation checks.
3. **P2 — Product funnel:** registration → first course set → first successful solver run → saved schedule → paid pass, but only after durable event instrumentation has been verified.
4. **P2/P3 — Cohorts and retention:** define cohorts from signup period and retention events; allow date comparison and export.
5. **P3 — Web traffic/campaign analytics:** decide consent, retention and event taxonomies; collect UTMs and landing pages only where privacy requirements permit.
6. **P3 — Saved/custom reports, anomaly alerts and scheduled delivery:** only after the underlying metrics are stable and trusted.

---

# 8. Security and access-control assessment

## 8.1 Existing controls to preserve and verify

The static code review found:

- `requireAuth`, `requireAdmin`, and `requireAdminRole` middleware, with per-route role sets;
- route helper wrappers that combine role gating and persistent rate limiting;
- origin/referer safeguards for state-changing API calls in `server/requestSecurity.ts`;
- guarded admin bootstrap using an explicit environment flag, and transactional/advisory-lock handling in the bootstrap script;
- audit logging for many privileged operations;
- owner-only controls for administrator role management, security summary/session revocation and exports UI;
- a prohibition on removing the last owner/self-suspending in relevant flows, according to inspected source;
- a database migration history that includes an admin audit log and account-deletion/payment integrity steps.

This is a strong base. The highest-return security work is to fix the concrete gaps, then verify every sensitive path with direct API calls as each role, rather than replacing the authorization design.

## 8.2 Role and permission matrix to explicitly approve

The current sidebar suggests these typical capabilities (the route-level role list remains authoritative and should be documented centrally):

| Capability | Intended roles to decide | Key risk/check |
|---|---|---|
| Dashboard/product operations | Owner, Admin; finance/support may receive limited view | Ensure metrics do not leak more than role requires. |
| Full analytics | Owner/Admin/Finance in current nav | Restrict PII and admin-only information in drill-downs. |
| Financial reports and payment verification | Owner/Admin/Finance | Separate viewing, approve/reject, refund/correction actions. |
| Student directory | Owner/Admin/Support currently appears likely | Separate read vs status mutation vs quota adjustment. |
| Support desk | Owner/Admin/Support | Ticket content may contain personal data; exports/replies need scope. |
| Products/pricing | Owner/Admin | Protect price/availability changes and audit old/new values. |
| Payment-method configuration | Owner/Finance according to nav | Destinations/instructions are sensitive business configuration. |
| Entitlement changes | Owner/Admin/Finance | Separate grant/revoke/extend and complimentary access privileges. |
| Announcements | Owner/Admin | Protect broad dispatch and make audience semantics correct. |
| System health/maintenance | Owner/Admin | Avoid exposing raw infrastructure internals; restrict high-impact changes. |
| Administrator roles/security center | Owner-only per nav | MFA, role change confirmation, last-owner protection and session audit. |
| Full-record data exports | Owner-only in UI, broader server gate now | Align server and UI and grant granular data export permissions. |

Recommended future permission model: use explicit permissions such as `students.read`, `students.status.write`, `students.quota.write`, `payments.read`, `payments.review`, `payments.refund`, `entitlements.write`, `products.write`, `notifications.broadcast`, `notifications.schedule`, `exports.students`, `exports.finance`, `security.sessions.revoke`, and `settings.global.write`. The current role framework can remain, mapping roles to capabilities server-side. This does not require a third-party IAM platform.

## 8.3 Additional security checks recommended

- Verify that every mutation validates input on the server and that object IDs cannot be substituted to affect records outside the actor’s permissions.
- Test race conditions/double-clicks for payment approval, entitlement changes, scheduled campaign dispatch and quota adjustments.
- Check whether event/audit writes and business mutations are atomic for each critical action.
- Ensure upload/OCR failure logs do not store full images, tokens, or excessive user-provided payloads.
- Confirm production secrets are injected at deploy time and excluded from the repository/build/archive artifact.
- Verify database backup encryption/access/restore procedure and retention policy before treating backup capability as complete.
- Verify session revocation actually invalidates the intended sessions across all auth-provider/session caches.
- Ensure error responses to admins are helpful but do not expose SQL, secret values or stack traces.
- Test that export/download fallback URLs do not expose bearer tokens in query strings, browser history, referrer headers or logs. The current export fallback may append `auth_token` to a URL if a Blob download fails; prefer an authenticated same-origin download path without placing tokens in query strings.
- Review whether `isMiuEmail` exceptions for a small number of external Gmail/support addresses are production policy or test exceptions. The server allowlist and frontend MIU-email check differ; document/gate any intentional exception and test that an unintended external user cannot become an admin/student through inconsistency.

---

# 9. Data governance, exports, and privacy

## 9.1 Current risks

- Whole-table exports can include more columns than a business user needs.
- The current export limit is record-count based, not a byte/memory budget; 20,000 wide records can be large.
- Preview retrieves full JSON, not just a sample.
- JSON and CSV have inconsistent audit behavior.
- Bulk export success counting is unreliable: `executeDownload` catches errors and handles its own banner without rethrowing, while the caller increments `successCount` after any resolved call. As a result, the final bulk summary can count a failed download as successful. Evidence: `DataExportsModule.tsx:198-219` plus `executeDownload` error handling earlier in the same file.
- CSV values are quoted but spreadsheet formula injection is not visibly mitigated.
- The export page describes a “full history” of support and “complete system tables”; that should be pared back to explicit, permission-aware datasets and fields.

## 9.2 Export controls to consider

1. **Per-dataset permissions:** do not treat the ability to view a dashboard as sufficient to export every underlying record.
2. **Least-data field allowlists:** export exactly the defined business fields rather than spreading all table columns.
3. **Bounded preview:** return 10 or 20 sanitized rows and metadata (total estimate/date coverage) without transferring the full result.
4. **Filters and pagination:** allow date range, status, academic term, and student-level scope where justified.
5. **Audit:** actor, dataset, format, filters, row count, timestamp, result status, correlation ID.
6. **Safer download:** avoid tokenized query-string fallback; use protected same-origin fetch/streaming.
7. **Safe formats:** spreadsheet-injection controls for CSV, consistent UTF-8, formula-safe text fields.
8. **Retention:** define where exported files can be stored/shared and whether temporary server files need cleanup.
9. **Bulk export correctness:** report each dataset result accurately, continue after a failure only with a clear partial-results summary, and do not display overall “success” while one or more datasets failed.
10. **Abuse safeguards:** rate-limit potentially expensive exports, cap concurrency, audit denied or unusually large requests, and avoid repeatedly scanning entire tables without a strong reason.

---

# 10. Operations, reliability, performance, and maintainability

## 10.1 Monitoring/observability

`server/observability.ts`’s `recordServerMetric` only prints selected development debug metrics; it does not persist a telemetry series. The web-vitals endpoint therefore should not be presented as a complete historical performance analytics source based on this implementation alone.

**Potential P2 improvement:** integrate with existing hosting/monitoring where practical, show last successful check and the source of every status, and add persisted bounded measurements only for questions the team needs to answer. Do not rebuild a full logging/monitoring stack inside the admin UI if the deploy platform already provides it.

Recommended health signals, subject to infrastructure availability:

- liveness/readiness and DB query check;
- API 4xx/5xx rate and latency by route category;
- solver run success/failure duration;
- OCR success/failure/latency;
- payment queue age and pending count;
- campaign queue due/failed count;
- email/provider connectivity only if an email integration actually exists;
- database pool/error indicators;
- backup result and last verified restore;
- release version and deployment time.

Every signal should display its timestamp and indicate unknown/stale separately from healthy.

## 10.2 Database/API behavior to examine under load

- Admin list and export routes should use server-side pagination or carefully defined limits and indexes.
- The support flow appears to load tickets and may then fetch message/thread information across multiple tickets; confirm whether it performs one query per ticket and cap/replace fan-out as volume grows.
- Exports currently fetch and serialize result sets in memory. Consider streaming and query pagination for large datasets.
- Analytics API executes multiple aggregates in parallel; appropriate indexes and query plans should be validated on realistic volume rather than assumed from migration names.
- Use idempotency/transaction rules for payment approval/rejection, entitlement grants, scheduled notification dispatch and admin role changes.
- Ensure campaign processing is safe if two server instances are active simultaneously. The inspected processor selects due campaigns and updates them after dispatch; verify that multiple instances cannot send the same campaign twice. Use transactional claiming/locking or an idempotent dispatch key if needed.
- Ensure failed scheduled campaigns keep enough sanitized error metadata to diagnose and retry safely; the current processor sets status `FAILED` on caught exceptions but detailed retry management was not visible in the processor.

## 10.3 Code organization and legacy material

The current admin has an intentional modular layer under `src/components/admin/modules/` plus a façade/re-export file `AdminOwnerModules.tsx`. There are also older standalone files and several one-off scaffold/rewrite scripts at the root. Static searches suggest some older dashboard/product/student/settings components may no longer be the rendered path, but this should be proven with dependency-aware dead-code analysis before deletion.

**Action:** `Investigate` / `Consolidate`, P2.  
**Recommendation:** identify canonical modules, public imports, compatibility routes and scripts; document which remain supported; then remove dead files only after tests/build confirm no references. Avoid running unreviewed rewrite/scaffold scripts during routine development. Keep each route handler focused and make large domain files easier to review, without changing behavior in the same patch as a broad refactor.

## 10.4 Documentation/readiness

The root `README.md` is generic/AI Studio boilerplate and points to a Gemini key in `.env.local`, while the archive contains a different environment-file convention. The source archive lacks `OPERATIONS.md`, although release verification requires it. Important environment setup, migration, backup/restore, seed/bootstrap, role assignment, deployment, and incident recovery instructions are not available as a single clear operational guide in the inspected root.

**Action:** `Improve`, P1.  
**Recommended docs:**

- `README.md`: product purpose, architecture, supported Node/Bun/npm versions, local setup, tests, build and start commands;
- `.env.example`: accurate placeholder-only variables and short purpose/required-by-environment notes;
- `OPERATIONS.md`: deployment, migration, health checks, backup/restore, rollbacks, secrets rotation, maintenance mode, incident contact and post-deploy smoke tests;
- `ADMIN_GUIDE.md`: role matrix, each admin workflow, financial metric definitions, audience semantics, and audit/export behavior;
- `ANALYTICS_DICTIONARY.md`: metrics and data-source definitions;
- `SECURITY.md` or equivalent: reporting and secret-handling process.

---

# 11. Recommended target admin architecture (not implementation)

This is a proposed organization to evaluate, not a request to create new pages automatically. Existing modules should remain where the current workflow is sound; the proposal is mainly about clarity and grouping.

## Everyday operations

- **Overview:** product KPIs, pending actions, system state with freshness and alerts.
- **Students:** directory/profile, status, support context, usage and entitlement summary, account-safe actions.
- **Support:** queues, ticket detail/history, assignment and response metrics.
- **Announcements:** immediate broadcast plus scheduled/draft campaigns if those workflows are desired.

## Product and monetization

- **Payments:** pending verification queue, submission detail, review history, corrections/refunds if supported.
- **Access:** subscriptions/passes, entitlement timeline, complimentary grants, free-run quotas.
- **Catalog & payment instructions:** plans/pricing, payment-method configuration, price history.
- **Academic calendar:** active term and historical periods.

## Product analytics

- **Usage:** solver runs, OCR attempts, errors and latency, with authoritative source and date definitions.
- **Growth:** registration and first-use funnel only when instrumentation supports it.
- **Revenue:** gross/net definitions, payment method mix, refunds/adjustments reconciliation.
- **Data quality:** missing events, stale metrics, unprocessed jobs and report calculation warnings.

## Operations and governance

- **Health:** DB/API checks, scheduled campaign processor, integration state, release version, backups.
- **Security:** administrator roles and sessions, policy-relevant events, suspicious-activity monitoring status.
- **Audit:** searchable privileged-action history.
- **Configuration:** global settings and maintenance mode separated from individual admin preferences.
- **Exports:** per-dataset governed export permissions, filters, samples and audit.

## Navigation principles

- The common operations should be first-class and easy to find; rare owner-only settings can remain grouped lower in the sidebar.
- Avoid creating a top-level item just because an API route exists. A module should have a clear user, workflow and operational owner.
- Use stable URL routes; role gating must remain on the server.
- A badge/counter should only display when its data source is trustworthy and fresh.
- Preserve contextual navigation from a KPI to the filtered list that explains it.

---

# 12. Prioritized roadmap with dependencies and acceptance criteria

This roadmap is grouped by risk reduction and dependency. It does not imply permission to implement yet.

## Phase A — Contain and restore confidence

### A1. Clean archive and secret handling
- **Priority:** P0
- **Dependencies:** owner confirms which credentials/providers may be live.
- **Work:** purge sensitive local files from distribution; add `.gitignore`; assess/rotate potentially live material; add secret scan.
- **Acceptance:** clean source package has no secrets/session files; checks pass; any rotation is verified.

### A2. Fix notification audience behavior
- **Priority:** P1
- **Dependencies:** agree precise definitions for `ALL`, `VERIFIED`, `PAID`, `FREE`, `EXPIRING`, per-student/custom audiences.
- **Work:** reject unsupported targets, implement predicates, add preview recipient count, audit dispatch.
- **Acceptance:** API tests prove every scope’s recipient set; invalid scope sends nothing.

### A3. Correct security headers/cookie policy
- **Priority:** P1
- **Dependencies:** list legitimate embedding origins and deployment/proxy topology.
- **Work:** tighten `frame-ancestors`, review CSP exceptions, enforce production Secure policy through trusted proxy config.
- **Acceptance:** header and cookie integration tests pass in local/staging proxy setups; required login/embedding still works.

### A4. Repair student status display and lifecycle actions
- **Priority:** P1
- **Dependencies:** approve which roles can suspend/reactivate and whether a reason is required.
- **Work:** map backend status to UI; expose role-appropriate lifecycle control; add audit/history/context.
- **Acceptance:** actual suspended records show suspended; server blocks unauthorized actions; audit logs actor/reason.

## Phase B — Trustworthy records and release gates

### B1. Make analytics correct before expanding it
- **Priority:** P1
- **Dependencies:** business definitions for runs/error rate/revenue/conversion/timezone.
- **Work:** wire range filters, fix lifetime-vs-30-day query/UI mismatch, reconcile financial metric definitions, remove unsupported status values.
- **Acceptance:** fixture-based metric tests pass; UI and CSV agree; each metric has a documented definition.

### B2. Govern exports
- **Priority:** P1
- **Dependencies:** explicit role/dataset/field policy.
- **Work:** log all formats; align route and UI permissions; bounded previews; safer CSV; correct bulk-export counts; field allowlists and limits.
- **Acceptance:** direct API role tests, audit tests, preview-size tests, formula-input tests and bulk failure simulation all pass.

### B3. Establish reproducible CI/release process
- **Priority:** P1
- **Dependencies:** choose npm or Bun as canonical package manager.
- **Work:** commit corresponding lockfile, reconcile scripts/workflows, provide operational documents/scripts that the verifier genuinely requires, pin/harden workflow actions as policy requires.
- **Acceptance:** clean checkout installation, typecheck, build, selected static test suite and release verification all pass.

### B4. Classify and repair stale QA checks
- **Priority:** P1/P2
- **Dependencies:** canonical source structure and target CI gate.
- **Work:** map every failure to a real risk or stale test; prioritize behavior-level tests for A2, A3, A4, B1 and B2.
- **Acceptance:** no unexplained red tests in release gate; static vs integration coverage is documented.

## Phase C — Common workflow and operational usability

### C1. Student/support table quality
- **Priority:** P2
- **Work:** server pagination/sort/filter, preserved filters, student/ticket detail context, accessible dialogs, audit history.
- **Acceptance:** realistic large data set is responsive; no lost filters; keyboard and narrow viewport acceptance passes.

### C2. Notification campaign management
- **Priority:** P2 (only if scheduling is a real need)
- **Work:** expose drafts/scheduled/sent/failed campaigns, edit/cancel/retry safely, show timezone/audience preview, monitor processor health and idempotency.
- **Acceptance:** multiple server instances or retry scenarios cannot send duplicates; status and result count match actual recipients.

### C3. Health dashboard semantics
- **Priority:** P2
- **Work:** real probes and timestamps; `unknown/stale/degraded` states; remove hardcoded “Operational” and suspicious-event zero unless measured.
- **Acceptance:** stopping a dependency causes the correct degraded/unavailable state; no false healthy state on missing data.

### C4. Navigation and design system consistency
- **Priority:** P2
- **Work:** URL-based tab state, active navigation semantics, shared tokens/components, responsive/focus refinements, term labels from academic settings.
- **Acceptance:** deep links survive refresh/back-forward; consistent focus/contrast/empty/error states across all modules.

## Phase D — Advanced features only after foundations

### D1. Product growth funnel/cohorts
- **Priority:** P2
- **Dependencies:** reliable event taxonomy and retention policy.
- **Acceptance:** event delivery/duplication quality checks and metric definitions are documented; metrics reconcile to underlying records.

### D2. First-party page/campaign analytics
- **Priority:** P3
- **Dependencies:** product need, privacy/consent design, retention rules and data minimization.
- **Acceptance:** clearly defined first-party event/session measures, documented bot/consent handling, and no misleading claims about traffic that cannot be observed.

### D3. Saved reports, alerts and scheduled delivery
- **Priority:** P3
- **Dependencies:** stable, trusted metrics and delivery channel/provider decision.
- **Acceptance:** alerts are actionable, deduplicated, quiet-hours aware where needed, and tested under provider failure.

### D4. Global search / selective content management
- **Priority:** P3, `Investigate` first
- **Dependencies:** user research/operational evidence; identify which public content should be editable by non-developers.
- **Acceptance:** each feature has an explicit workflow and permission boundary before implementation is selected.

---

# 13. Static test results and verification gaps

These results are from selected custom scripts run against the extracted source archive. **They are not a full build, browser test, or production security verification.**

| Script / check | Result observed | Interpretation |
|---|---|---|
| `scripts/test-accessibility-audit.mjs` | **23/23 passed** | Static source-contract coverage passed; runtime keyboard/screen-reader behavior remains unverified. |
| `scripts/test-responsive-mobile-desktop-implementation.mjs` | **25/25 passed** | Static responsive-contract coverage passed; real device layout is unverified. |
| `scripts/test-error-loading-resilience-audit.mjs` | **28/28 passed** | Source-level error/loading conventions matched the script’s assertions. |
| `scripts/test-data-state-api-contract.mjs` | **25/25 passed** | Source-level data/API contracts matched assertions; endpoint behavior still requires integration testing. |
| `scripts/test-admin-surfaces-redteam.mjs` | **28/30 passed** | Two failures: a stored-record role assertion and an `.env.example` bootstrap-default expectation. They need triage against the intended policy; do not dismiss without review. |
| `scripts/test-owner-admin-console-comprehensive.mjs` | **20/48 passed** | Many failures appear tied to stale assumptions about module implementations/re-exports; at least one meaningful gap was also found (scheduled campaign UI not connected). Audit each failure rather than treating the raw score as a bug count. |
| `scripts/test-cookie-environment-static-audit.mjs` | **Failed** on production auth cookies forced `Secure` invariant | Supports SEC-03; confirm actual deployment proxy/cookie behavior with an integration test. |
| `scripts/test-git-repository-exposure-35.mjs` | Failed before completing because `.gitignore` is missing | Repository-hygiene gate requires a file absent from the archive; its intended checks still matter. |
| `scripts/test-secrets-redteam-31.mjs` | Failed when it attempted to read `.gitignore` | Same repository-hygiene blocker; the secret scan result is not a clean pass. |

## Tests not run

- `npm test`/the full chained suite;
- `npm run typecheck`, `npm run lint` or `npm run build`;
- dependency install/audit;
- live Neon/Auth/Gemini integration tests;
- migration application or rollback;
- database-backed authorization/business-logic tests;
- Playwright/browser test suite and real responsive screenshots;
- accessibility audit with actual keyboard and assistive technology;
- performance/load/abuse testing against a staging environment.

**Conclusion:** the existing static test investment is valuable, but release confidence is presently **unverified** in this review. The first reproducible next step after the owner selects work is to restore clean dependency/release inputs and run the full gates in an isolated environment—not to deploy directly from this audit.

---

# 14. Detailed future feature gap matrix

This table separates **core requirements** from additions that should be conditional on product need.

| Capability | Current evidence | Gap / recommendation | Priority |
|---|---|---|---|
| Real-time/accurate dashboard KPIs | Existing DB-backed dashboard | Correct labels and status trust; add source/time range/freshness | P1 |
| Search/filter/pagination | Student search and filters in some lists; student table filtering is partly client-side | Consistent server pagination, sorting, total counts, retained filters for high-volume lists | P2 |
| Role/permission management | Admin roles + backend guards | Document capability matrix and verify each route/field/action; consider permission-level granularity if role ambiguity grows | P1/P2 |
| Account state lifecycle | Server status endpoint; UI status incorrect/no control visible | Display status, suspend/reactivate workflow, reason, audit and recovery | P1 |
| Payment manual review | Present | Validate race/idempotency, expose review history, ensure finance definitions/reconciliation | P1/P2 |
| Financial reconciliation | Aggregate and payment adjustment structures present | Formal gross/net definition, export/ledger tie-out, refunds/corrections treatment | P1 |
| Entitlement timeline | Current entitlement tools | Per-student before/after/audit timeline; expiration/renewal clarity | P2 |
| Product/pricing history | Price history endpoint/table exists | Show user-friendly history and safe preview; implement availability scheduling only if needed | P2 |
| Announcement broadcast | Present, audience scope bug | Fix audience predicates; recipient preview, send confirmation, dispatch audit | P1 |
| Scheduled campaign UI | Backend endpoints/worker; no corresponding frontend endpoint use found | Build management UI only if scheduling is an intended user requirement | P2 |
| Solver metrics | Run-session/activity counts | Correct dates/error definitions; drill-down to anonymized/safe failure categories | P1/P2 |
| OCR quality/latency | OCR/product events implied | Verify persistence and data source; add durable success/failure/latency view as needed | P2 |
| First-party traffic analytics | Not established; selected RUM path does not persist a complete time series | New instrumentation and privacy model required if needed | P3 |
| Funnel/cohort/retention | Basic funnel card; no trustworthy complete event taxonomy established | Define event model first, then cohorts/retention | P2/P3 |
| Custom and saved reports | Static/dataset exports are present; saved reports not established | Add only after metrics are stable and common report use cases are known | P3 |
| Scheduled report delivery | Not established in UI | Needs delivery provider, consent, retry/failure handling and preference model | P3 |
| Actionable alerts | Some health/maintenance UI; general alert center not established | Start with failed jobs/payments/campaigns and verified signals before anomaly detection | P2/P3 |
| Support SLAs/assignment | Basic support tickets/messages and assignment behavior | Confirm assignment UI, response-time tracking and ticket pagination | P2 |
| Email delivery monitoring | Not established in inspected feature set | Do not build unless the system sends transactional/admin email and has provider events to monitor | Investigate |
| CMS/SEO controls | No broad CMS/SEO module proven | Keep public content in code unless specific frequent edits justify a limited CMS | P3/Investigate |
| Redirect manager/search-console integration | Not established | Build only with a validated business case and proper external credentials/API integration | P3 |
| Backups/restore UI | Backup script is required by release verifier but absent from archive | First decide and validate backup/restore process; UI status is secondary | P1/P2 |
| Import tools | Not established for core admin datasets | Introduce only where there is a real recurring import workflow; validate CSV, preview, dry-run, rollback | P3 |
| Admin workspace preferences | Not established beyond in-page state | Saved filters/default views only if operator feedback shows value | P3 |
| Global search | Not found | Optional; permission-aware cross-entity search should be scoped and justified | P3 |

---

# 15. Specific design/engineering acceptance checklist

Use these as a future implementation definition of done. Do not claim completion until executed.

## Functional and data correctness

- [ ] Every sidebar item opens the correct module; route links survive refresh and browser back/forward.
- [ ] Student status is taken from the server record; suspended/pending/active states are visually distinct.
- [ ] Every notification scope maps to an explicit tested query; unsupported values send zero notices.
- [ ] Broadcast recipient count matches the actual database selection and final send result.
- [ ] Analytics range controls alter data; displayed dates, chart data, cards and exports agree.
- [ ] KPI definitions and timezone are documented; error-rate numerator/denominator are consistent.
- [ ] Finance reports reconcile to documented gross/net definitions and adjustment policy.
- [ ] CSV/JSON preview and exports honor actor permissions, filters and fields.
- [ ] JSON and CSV exports are audited; bulk failures are reported accurately.
- [ ] Sensitive changes persist and show server-confirmed success only after the backend succeeds.
- [ ] Payment/entitlement/campaign actions are safe against concurrent retries and duplicate submission.

## Security and privacy

- [ ] Unauthenticated users are redirected/rejected on every admin route and API endpoint.
- [ ] Each role is tested with direct requests for allowed and disallowed read/write/export actions.
- [ ] CSP `frame-ancestors` has only explicitly approved origins; policy exceptions are documented.
- [ ] Production auth cookies are `Secure` under the actual deployment path.
- [ ] State-changing requests are origin-protected; CSRF regression tests pass.
- [ ] PII fields in admin screens/exports are minimized by role and purpose.
- [ ] CSV formula injection cases are sanitized.
- [ ] Download fallback does not put auth tokens in URLs.
- [ ] Secret scans and archive tests pass without printing secrets.
- [ ] Sensitive actions are logged without leaking private payloads.

## Responsive and accessible UX

- [ ] Narrow mobile, large mobile, tablet, laptop and desktop viewports are browser-tested.
- [ ] No unexpected horizontal overflow or clipped controls.
- [ ] Mobile drawer manages focus, Escape and return focus; icon-only buttons have names.
- [ ] All functionality is keyboard-accessible; visible focus and semantic active states exist.
- [ ] Modals announce errors, return focus, and preserve typed form content.
- [ ] Tables have meaningful mobile behavior; key data is not hidden without an alternative.
- [ ] Charts include accessible numeric/table alternatives.
- [ ] Loading/empty/error/stale/permission-denied/unknown states are all distinct.

## Delivery/reliability

- [ ] One package manager is canonical and its lockfile is committed.
- [ ] CI installs with the exact frozen/reproducible command from a clean checkout.
- [ ] Typecheck, build, required audit/test suite and release verifier pass.
- [ ] Database migrations apply and rollback/recovery procedure is documented/tested.
- [ ] Backup and restore have been rehearsed; operations docs match deployed infrastructure.
- [ ] Health statuses have a source and timestamp; stale or unavailable checks are not displayed as healthy.
- [ ] No severe known regression remains; every unverified integration is explicitly identified.

---

# 16. Owner decision menu

The next work should be chosen by outcome, not by how many admin pages can be added. The menu below offers independently selectable work packages.

| Option | Package | Includes | Suggested priority |
|---|---|---|---|
| **A** | **Security & release hygiene** | SEC-01, SEC-02, SEC-03, REL-01, QA-01; secret cleanup, CSP/cookie policy, reproducible release checks | **Recommended first** |
| **B** | **Core correctness repairs** | NOT-01, USER-01, ANA-01, ANA-02, ANA-03, dashboard count/stale-term corrections | **Recommended first** |
| **C** | **Export governance** | DATA-01/DATA-02, safe previews, explicit role/field policy, CSV formula mitigation, accurate bulk results | High value if admins use exports regularly |
| **D** | **Workflow refinement** | URL-based navigation, status-aware student detail, support/task context, accessible mobile dialogs, consistent patterns | After A/B; highest operator-experience value |
| **E** | **Analytics foundations** | Metric dictionary, event quality/freshness, correct product funnel, payment reconciliation and cohorts | After current metric bugs; do this before advanced BI |
| **F** | **Campaign management** | UI for drafts/scheduled/sent/failed campaigns, preview, audience criteria, safe retry and processor health | Choose if scheduled communications are a real need |
| **G** | **Operations and observability** | Real health signals, deploy/backup status, latency/error trends, OCR/solver operational visibility | Choose based on deployment complexity and current pain |
| **H** | **Optional new capabilities** | Global admin search, saved reports, anomaly alerts, targeted content editor, first-party traffic analytics | Defer until operational basics and product needs are clear |

## Recommended minimum first tranche

If the goal is to make the existing console safer and trustworthy without expanding its scope, the best first tranche is **A + B**, followed by the sensitive-data portion of **C**. That fixes the highest-confidence risks and misrepresentations before a visual redesign or advanced analytics build begins.

## Features I would not prioritize yet

Based on the code evidence available, I would **not** start by building a generic e-commerce order/inventory/fulfillment suite, a broad CRM, an appointment system, a full page CMS, complex anomaly detection, or a comprehensive external-tool replacement. Those are not currently justified by the observed product model. If owner interviews or roadmap plans establish those needs later, they can be scoped separately.

---

# 17. Final verdict

Gadwal already has the foundations of a useful product-specific administration console. The current opportunity is to make the existing controls **accurate, secure, auditable, reproducible, and easier to operate** before adding more surface area.

The most consequential immediate findings are:

1. Treat the supplied archive’s environment/cookie artifacts as potentially sensitive and correct repository hygiene.
2. Fix notification audience handling before trusting broad broadcasts.
3. Correct the Content Security Policy and verify production cookie attributes under the real proxy topology.
4. Ensure status displays and analytics labels match actual database fields and query windows.
5. Ensure every export is permission-scoped, data-minimized and audited in every format.
6. Restore a single reproducible build/test/release path and classify the stale static-test failures.

After those are resolved and verified, the strongest next improvements are a governed export experience, status-aware student workflows, better metric definitions/data quality, and (only if required) a proper scheduled campaign UI. A new admin design system should refine the existing brand and components while preserving working product and security logic—not replace them without evidence.

**Audit boundary:** this is a static review of the supplied source archive as provided. It is not a claim of production exploitability, a live-system health assessment, or a verified pass of the full build/test/deployment pipeline. No application implementation has been performed.

---

# Appendix A — Key source locations referenced

- `metadata.json` — product metadata/description.
- `package.json` — runtime/build/test/release scripts and dependencies.
- `.github/workflows/ci.yml` — CI install/typecheck/build workflow.
- `.env`, `.env.example`, `cookies.txt`, `.gcloudignore` — archive hygiene/secret-handling review; sensitive values intentionally not reproduced.
- `README.md` — local setup guidance (currently generic/stale for this project).
- `src/main.tsx`, `src/App.tsx`, `src/AdminApp.tsx` — product/admin entry point and tab state.
- `src/components/admin/AdminLayout.tsx` — navigation/role visibility/mobile layout/stale term label.
- `src/components/admin/AdminOwnerModules.tsx` — module façade/re-exports and shared data components.
- `src/components/admin/adminShared.tsx` — shared admin page/form/state UI utilities.
- `src/components/admin/modules/DashboardModule.tsx` — owner dashboard; payment-method count and static status badge.
- `src/components/admin/modules/AnalyticsModule.tsx` — analytics period controls and metric labels.
- `src/components/admin/modules/StudentsModule.tsx` — student listing, filtering, quota workflow and hardcoded status.
- `src/components/admin/modules/NotificationsModule.tsx` — immediate broadcast composer and target audience options.
- `src/components/admin/modules/DataExportsModule.tsx` — export/preview/bulk flow and client-side handling.
- `src/components/admin/modules/PaymentsModule.tsx`, `EntitlementsModule.tsx`, `ProductsModule.tsx`, `FinancialsModule.tsx`, `SupportModule.tsx`, `SystemAdminModules.tsx`, `AcademicModule.tsx`, `PaymentMethodsModule.tsx`, `OperationsModule.tsx` — relevant module implementations.
- `server.ts` — Express server, route setup and notification campaign processor startup.
- `server/adminOwnerRoutes.ts` — owner-console routes, analytics, notifications, student status, role gating and data export.
- `server/authRoutes.ts` — upstream auth-cookie normalization.
- `server/authMiddleware.ts`, `server/authPolicy.ts`, `server/requestSecurity.ts` — identity, role policy and request/origin protections.
- `server/securityHeaders.ts` — CSP and security response headers.
- `server/services/adminOwnerService.ts` — dashboard/financial/operational aggregates.
- `server/services/notificationCampaigns.ts` — scheduled campaign processor.
- `server/observability.ts` and `src/utils/rum.ts` — current metric recording/RUM behavior.
- `server/db/schema.ts`, `server/db/migrations/0000_*.sql` through `0020_*.sql` — DB entities and migration history.
- `scripts/verify-release-config.mjs` — expected release files and lockfile.
- `scripts/test-cookie-environment-static-audit.mjs`, `scripts/test-git-repository-exposure-35.mjs`, `scripts/test-secrets-redteam-31.mjs`, `scripts/test-admin-surfaces-redteam.mjs`, `scripts/test-owner-admin-console-comprehensive.mjs`, `scripts/test-accessibility-audit.mjs`, `scripts/test-responsive-mobile-desktop-implementation.mjs`, `scripts/test-error-loading-resilience-audit.mjs`, `scripts/test-data-state-api-contract.mjs` — selected static checks described in Section 13.

# Appendix B — Classification legend

- **Keep:** Working or valuable capability to preserve.
- **Improve:** Existing capability with a worthwhile UX, reliability, performance, accessibility or maintainability opportunity.
- **Repair:** Incorrect, broken, unsafe or materially misleading behavior to correct.
- **Add:** Capability not established in the current system and worth considering.
- **Consolidate:** Overlapping or legacy implementations that should become a clearer canonical path after dependency checks.
- **Remove:** Unnecessary/obsolete behavior; no broad removals are recommended until dead-code/reference checks are complete.
- **Investigate:** Evidence is insufficient for a safe decision; verify before scope is approved.

Priority convention:

- **P0:** contain critical exposure or risk before normal work proceeds.
- **P1:** essential correctness/security/release-trust work.
- **P2:** significant workflow, visibility and maintainability improvements.
- **P3:** optional enhancements that depend on validated demand and stable foundations.
