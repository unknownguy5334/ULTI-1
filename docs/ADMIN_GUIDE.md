# Admin Console Guide

## Navigation

The console uses five groups: **Overview**, **Students**, **Payments & access**, **Product**, and **Operations & settings**. Search with “Find a section”, select a section, and use the browser URL/history to revisit a page. The mobile menu opens as a drawer and closes with Escape or the close control.

## Roles

The sidebar is a convenience layer, not an authorization boundary. Server routes remain authoritative. In broad terms:

- **Owner:** full administration including security, administrator roles, governed exports and configuration.
- **Admin:** routine student/product/support/operations capabilities allowed by server routes.
- **Finance:** finance and payment-focused capabilities; raw exports are narrower than dashboard visibility.
- **Support:** support-focused student visibility and support workflows; no raw administrative data exports or administrator account changes.

Always use the route's current server-side role checks to determine whether an action is allowed. This guide intentionally does not promise that every role can perform every visible operation.

## Student directory

Use search, role and status filters, and server-side pagination. The status displayed comes from the student record, not a UI default. Suspending a student requires a reason and is audited. Your own account cannot be suspended from this workflow, and the last active Owner cannot be suspended. Quota adjustments are separate from account status.

## Access entitlements

Manual grants require a student, package, duration and reason. The term/year is derived from configured current academic context, not a historical hard-coded term. Revoke/extend/restore actions should be used only with an operational reason and verified against the payment/access history.

## Announcements

The four immediate-campaign audiences are:

- **All registered students:** every account in the `students` table.
- **Active accounts:** accounts whose `accountStatus` is `ACTIVE`.
- **Students with an active pass:** an active entitlement that has no expiry or has not yet expired.
- **Registered students without an active pass:** registered accounts without an active, unexpired entitlement; anonymous visitors cannot be targeted.

The same backend predicate powers recipient preview and delivery. Sends are confirmed, capped at 10,000 recipients and recorded with `sentCount`. Drafts and scheduled campaigns share the same history. The campaign worker runs inside the server process and should be monitored in the deployed environment.

## Analytics

Range buttons request a different server-side data period (`7d`, `30d`, `all`). Lifetime student totals are identified as lifetime totals; period counts use the chosen range. Approved payment-submission value is a source metric, not a reconciled accounting net-revenue measure. Read `ANALYTICS_DICTIONARY.md` before interpreting a chart.

## Exports

Exports must only be used for an approved operational purpose. Route-level role checks govern both CSV and JSON, export actions are audit logged before the response is released, preview data is limited to ten rows, and sensitive table columns are excluded. CSV text is guarded against common spreadsheet formula execution. An export file is not a database backup; store it only in approved, access-controlled locations.

## System health and audit trail

Read health state with its last-checked time/source where provided. `Unknown` means a trustworthy measurement is unavailable; it is not a failure nor a green status. Audit records should be treated as privileged operational records and not edited casually.
