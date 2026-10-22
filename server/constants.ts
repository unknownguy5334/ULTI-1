/**
 * Non-secret deployment defaults only. Credentials must be supplied through
 * environment variables or the deployment platform's secret manager.
 */
export const PERMANENT_CONFIG = {
  DATABASE_URL: '',
  NEON_AUTH_URL: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  ADMIN_BOOTSTRAP_ENABLED: 'false',
  APP_ORIGIN: 'https://gadwal.app',
  ALLOWED_ORIGINS: 'https://gadwal.app,https://www.gadwal.app',
} as const;
