import { Request, Response, NextFunction } from 'express';
import { deriveNeonAuthBaseUrl } from './neonAuthUrl';
import { getDbPool } from './db';
import { getOrCreateStudentProfile } from './services/studentProfile';
import { isMiuEmail } from './authPolicy';
import { fetchWithTimeout } from './upstream';

export type AdminRole = 'OWNER' | 'ADMIN' | 'FINANCE' | 'SUPPORT';
export interface AuthenticatedUser { id: string; name?: string; email: string; emailVerified: boolean; role: string; profile?: any; adminRole?: AdminRole; accountStatus?: string; }

export function resolveUserRole(_neonAuthRole: string | null | undefined, profile?: any): 'OWNER' | 'ADMIN' | 'FINANCE' | 'SUPPORT' | 'STUDENT' {
  // Privileged access is assigned only in Gadwal's application profile. The auth
  // provider's generic role field is not an administrator-authority source.
  const storedAdminRole = String(profile?.adminRole || 'NONE').toUpperCase();
  const storedAppRole = String(profile?.role || 'STUDENT').toUpperCase();
  if (storedAdminRole === 'OWNER' || storedAppRole === 'OWNER') return 'OWNER';
  if (['ADMIN', 'FINANCE', 'SUPPORT'].includes(storedAdminRole)) return storedAdminRole as AdminRole;
  if (storedAppRole === 'ADMIN') return 'ADMIN';
  return 'STUDENT';
}

function accountIsDisabled(user: AuthenticatedUser): boolean {
  const status = String(user.accountStatus || user.profile?.accountStatus || 'ACTIVE').toUpperCase();
  return status !== 'ACTIVE';
}

function rejectDisabledAccount(user: AuthenticatedUser, res: Response): boolean {
  if (!accountIsDisabled(user)) return false;
  res.status(403).json({ error: 'This account is suspended or disabled. Contact an administrator for help.', code: 'ACCOUNT_DISABLED' });
  return true;
}

export function extractSessionToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const raw = auth.slice(7).trim();
    if (raw) return raw.split('.')[0];
  }
  const cookieStr = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  const match = cookieStr.match(/(?:(?:__Secure-)?(?:better-auth|neon-auth)\.session_token)=([^;]+)/);
  if (match && match[1]) {
    const rawVal = decodeURIComponent(match[1].trim());
    return rawVal.split('.')[0] || null;
  }
  return null;
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
  const authBase = deriveNeonAuthBaseUrl();
  const pool = getDbPool();

  // 1. First attempt upstream better-auth /get-session
  if (authBase) {
    const headers: Record<string, string> = {};
    const origin = process.env.APP_ORIGIN?.trim();
    if (origin) headers['Origin'] = origin;
    if (req.headers.cookie) headers['Cookie'] = req.headers.cookie;
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    try {
      const response = await fetchWithTimeout(`${authBase}/get-session`, { headers, timeoutMs: 6_000 });
      if (response.ok) {
        const data = await response.json();
        if (data?.user?.id && isMiuEmail(data.user.email) && pool) {
          const dbUser = await pool.query<{ emailVerified: boolean }>('SELECT "emailVerified" FROM neon_auth.user WHERE id=$1', [data.user.id]);
          const emailVerified = dbUser.rows.length > 0 && Boolean(dbUser.rows[0].emailVerified);
          if (!emailVerified) {
            return { id: data.user.id, name: data.user.name, email: String(data.user.email).trim().toLowerCase(), emailVerified: false, role: 'STUDENT' };
          }
          const profile = await getOrCreateStudentProfile(data.user.id, data.user.email, data.user.name);
          const role = resolveUserRole(null, profile);
          const isOwner = role === 'OWNER';
          const isAdmin = ['OWNER', 'ADMIN', 'FINANCE', 'SUPPORT'].includes(role);
          return { id: data.user.id, name: data.user.name, email: String(data.user.email).trim().toLowerCase(), emailVerified: true, role, adminRole: isOwner ? 'OWNER' : (isAdmin ? role as any : undefined), profile, accountStatus: String(profile.accountStatus || 'ACTIVE').toUpperCase() };
        }
      }
    } catch {
      // Proceed to direct DB lookup fallback
    }
  }

  // 2. Direct Postgres session fallback (resolves raw session tokens and cookie signatures)
  if (!pool) return null;
  const token = extractSessionToken(req);
  if (!token) return null;

  try {
    const res = await pool.query<{ id: string; name?: string; email: string; emailVerified: boolean }>(
      `SELECT u.id, u.name, u.email, u."emailVerified"
       FROM neon_auth.session s
       JOIN neon_auth.user u ON u.id = s."userId"
       WHERE s.token = $1 AND s."expiresAt" > NOW()
       LIMIT 1`,
      [token]
    );
    if (res.rows.length === 0) return null;
    const userRow = res.rows[0];
    if (!isMiuEmail(userRow.email)) return null;

    if (!userRow.emailVerified) {
      return { id: userRow.id, name: userRow.name, email: userRow.email.trim().toLowerCase(), emailVerified: false, role: 'STUDENT' };
    }

    const profile = await getOrCreateStudentProfile(userRow.id, userRow.email, userRow.name);
    const role = resolveUserRole(null, profile);
    const isOwner = role === 'OWNER';
    const isAdmin = ['OWNER', 'ADMIN', 'FINANCE', 'SUPPORT'].includes(role);

    return { id: userRow.id, name: userRow.name, email: userRow.email.trim().toLowerCase(), emailVerified: true, role, adminRole: isOwner ? 'OWNER' : (isAdmin ? role as any : undefined), profile, accountStatus: String(profile.accountStatus || 'ACTIVE').toUpperCase() };
  } catch (err) {
    console.error('[AuthMiddleware] DB session fallback error:', err);
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error:'Unauthorized', code:'UNAUTHORIZED' });
  if (!user.emailVerified) return res.status(403).json({ error:'Email verification is required to access this feature.', code:'UNVERIFIED' });
  if (rejectDisabledAccount(user, res)) return;
  (req as any).user = user; next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error:'Authentication required for admin access', code:'UNAUTHORIZED' });
  if (!user.emailVerified) return res.status(403).json({ error:'Email verification is required for admin access.', code:'UNVERIFIED' });
  if (rejectDisabledAccount(user, res)) return;
  if (!['OWNER','ADMIN','FINANCE','SUPPORT'].includes(String(user.role))) return res.status(403).json({ error:'Forbidden: Admin access required', code:'FORBIDDEN' });
  (req as any).user = user; next();
}


export function requireAdminRole(...allowed: AdminRole[]) {
  return async function roleGuard(req: Request, res: Response, next: NextFunction) {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error:'Authentication required for admin access', code:'UNAUTHORIZED' });
    if (!user.emailVerified) return res.status(403).json({ error:'Email verification is required for admin access.', code:'UNVERIFIED' });
    if (rejectDisabledAccount(user, res)) return;
    const role = (user.adminRole || user.role) as AdminRole;
    if (role !== 'OWNER' && !allowed.includes(role)) return res.status(403).json({ error:'Forbidden: insufficient administrator privileges', code:'INSUFFICIENT_ADMIN_ROLE' });
    (req as any).user = user; next();
  };
}
