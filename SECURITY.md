# Security and Disclosure Notes

- Do not commit `.env`, browser cookies, session state, provider credentials, database dumps, private keys or customer exports.
- Use the secret manager for deployment credentials and rotate/revoke any values that may have been shared outside approved channels.
- Keep authorization checks server-side. Sidebar visibility is not authorization.
- Require reasoned, audited admin mutations and keep export access narrow.
- Report suspected vulnerabilities privately to the system owner; include reproduction steps and impact, not secrets or live customer data.
- Validate all changes on a staging deployment before production; test role denials, CSRF/origin controls, cookies, CSP and sensitive data handling against the real reverse-proxy setup.
