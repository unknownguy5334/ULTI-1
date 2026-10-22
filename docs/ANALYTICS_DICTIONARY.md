# Analytics Dictionary

These definitions describe the available first-party data model. They are deliberately explicit about limitations; metric names must not imply data the system does not measure.

| Metric | Definition | Source | Window | Limitations |
|---|---|---|---|---|
| Registered students | Count of rows in the `students` account table | `students` | Lifetime | Accounts only; not anonymous visitors |
| Active accounts | Count of accounts whose `accountStatus` is `ACTIVE` | `students.accountStatus` | Current state | Not the same as recently active users |
| Students active in last 7 days | Distinct non-null student IDs with an `activityAudit` event in the last seven days | `activityAudit.timestamp`, `studentId` | Rolling 7 days | Event coverage varies by tracked workflow; not complete web sessions |
| New students | Count of student account rows created during the selected range | `students.createdAt` | Selected 7d/30d/lifetime range | Not an acquisition source or conversion metric |
| Students with active passes | Distinct students with `ACTIVE` entitlements whose expiry is null or at/after current database time | `entitlements.status`, `expiresAt` | Current state | Entitlement semantics depend on migration/data quality |
| Active pass share of accounts | Students with active passes divided by registered students, times 100 | Derived from account and entitlement counts | Current totals | A prevalence ratio, not a conversion/cohort rate |
| Schedule runs | Count of `runSessions` started during the selected range | `runSessions.startedAt` | Selected 7d/30d/lifetime range | Does not measure all front-end interactions |
| Failed runs | Count of run sessions with `FAILED` status started during selected range | `runSessions.status`, `startedAt` | Selected range | Classification is only as accurate as run status writes |
| Approved payment-submission value | Sum of amounts on `APPROVED` payment-submission records created within the selected range | `paymentSubmissions.amount`, `status`, `createdAt` | Selected range | Not net revenue; should be reconciled with refunds/adjustments and accounting records |
| Approved submissions | Count of `APPROVED` payment-submission rows created during the selected period | `paymentSubmissions` | Selected range | Submission count is not necessarily distinct customers or captured payment count |
| Daily signup trend | Account rows grouped by database `date_trunc('day', createdAt)` | `students.createdAt` | Range: selected period or latest 365 days for lifetime chart | Uses database session timezone, not necessarily Cairo-local date boundaries |
| Daily run trend | Run sessions grouped by database day | `runSessions.startedAt` | Same chart window behavior | Only persisted run session events |
| Daily approved payment trend | Approved submissions summed and counted by database day | `paymentSubmissions` | Same chart window behavior | Not adjusted for refunds/fees unless separate reconciliation is added |

## Data freshness and quality

The analytics response includes `generatedAt`, the requested range, chart window and explanatory source notes. These describe when the server response was produced, not a guarantee every event was ingested without delay. No external search-engine attribution, complete browser-session tracking, cross-device identity resolution, or full visitor geography is implied by these database aggregates.

## Future work not represented as current functionality

UTM attribution, session/page-view analytics, funnel conversion, retention cohorts, scheduled report delivery, anomalies, and alerts require deliberate instrumentation, privacy/consent choices, event definitions, storage/retention policy and verification. Do not fill gaps with synthetic or assumed data.
