import type { Request, Response, NextFunction } from 'express';
import { getServerConfig } from './config';

function approvedFrameAncestors(configured: string, isHardenedDeployment: boolean): string {
  const candidates = String(configured || "'self'").split(/\s+/).filter(Boolean);
  const allowed: string[] = [];
  for (const candidate of candidates) {
    if (candidate === "'self'" || candidate === "'none'") {
      if (candidate === "'none'" && candidates.length > 1) continue;
      allowed.push(candidate);
      continue;
    }
    // Framing is opt-in by exact HTTPS origin. Wildcards and arbitrary schemes are rejected.
    if (candidate.includes('*')) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' && !( !isHardenedDeployment && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) continue;
      if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) continue;
      allowed.push(url.origin);
    } catch {
      // Ignore malformed environment-supplied origins and keep the remaining allowlist.
    }
  }
  const unique = [...new Set(allowed)];
  if (unique.includes("'none'")) return "'none'";
  return unique.length ? unique.join(' ') : "'self'";
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const config = getServerConfig();
  const isHardenedDeployment = config.deploymentEnv !== 'development';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isHardenedDeployment) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  const connectSources = isHardenedDeployment
    ? "'self' https://generativelanguage.googleapis.com https://accounts.google.com https://oauth2.googleapis.com"
    : "'self' ws: wss: http: https: https://generativelanguage.googleapis.com https://accounts.google.com https://oauth2.googleapis.com";
  const frameAncestors = approvedFrameAncestors(config.frameAncestors, isHardenedDeployment);
  const scriptPolicy = `script-src 'self' ${isHardenedDeployment ? '' : "'unsafe-eval' 'unsafe-inline'"} https://accounts.google.com https://accounts.google.com/gsi/client https://apis.google.com`;
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    scriptPolicy,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' data: blob: https: https://*.googleusercontent.com",
    "font-src 'self' data: https:",
    `connect-src ${connectSources}`,
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    `frame-ancestors ${frameAncestors}`,
    "form-action 'self'",
    "worker-src 'self' blob:",
  ].join('; '));

  if (req.path.startsWith('/api/')) {
    res.removeHeader('ETag');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Vary', 'Cookie, Authorization');
  }
  if (/^\/(?:health(?:z|\/ready|\/neon-auth|\/db)?|api\/health(?:\/live|\/ready|\/neon-auth|\/db)?)$/.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
