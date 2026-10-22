import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { entitlements, students, runSessions, academicPeriods } from '../db/schema';
import { getCurrentAcademicContext } from './academicContext';
import { canContinuePaidRun as canContinuePaidRunPolicy, evaluateScheduleAccess } from './purePolicies';

function getCairoOffsetMs(utcInstant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    timeZoneName: 'longOffset',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(utcInstant);
  const value = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT+00:00';
  const match = value.match(/^GMT([+-])(\d{2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const [, sign, hourRaw, minuteRaw = '00'] = match;
  const minutes = Number(hourRaw) * 60 + Number(minuteRaw);
  return (sign === '+' ? 1 : -1) * minutes * 60_000;
}

function cairoLocalDateToUtc(year: number, month: number, day: number, hour = 23, minute = 59, second = 59, millisecond = 999): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  // Egypt's DST transition dates do not occur at the term-end cutoffs used by Gadwal,
  // so resolving the offset at the candidate instant is stable for these calendar dates.
  const offsetMs = getCairoOffsetMs(new Date(naiveUtcMs));
  return new Date(naiveUtcMs - offsetMs);
}

function getExpiryFallback(academicYear: string, term: string): Date {
  const startYear = Number(String(academicYear).slice(0, 4));
  if (!Number.isFinite(startYear)) return new Date('2099-12-31T23:59:59.999Z');
  if (term === 'FALL') return cairoLocalDateToUtc(startYear + 1, 1, 19);
  if (term === 'SPRING') return cairoLocalDateToUtc(startYear, 6, 19);
  return cairoLocalDateToUtc(startYear, 8, 31);
}


async function getConfiguredExpiry(academicYear: string, term: string): Promise<Date> {
  const db = getDb();
  if (db) {
    const rows = await db.select({ accessExpiry: academicPeriods.accessExpiry, endDate: academicPeriods.endDate })
      .from(academicPeriods)
      .where(and(eq(academicPeriods.academicYear, academicYear), eq(academicPeriods.term, term), eq(academicPeriods.enabled, 1)))
      .limit(1);
    const configured = rows[0]?.accessExpiry || rows[0]?.endDate;
    if (configured) {
      const d = new Date(configured);
      d.setUTCHours(23,59,59,999);
      return d;
    }
  }
  return getExpiryFallback(academicYear, term);
}

export async function getAccessState(studentId: string) {
  const db = getDb();
  if (!db) throw new Error('DB not initialized');
  const studentRows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  const student = studentRows[0];
  if (!student) throw new Error('Student not found');
  let freeRunStatus = Number((student as any).freeRunsRemaining ?? 1) > 0 ? (student.freeRunStatus as 'available' | 'in-progress' | 'used') : 'used';
  if (freeRunStatus === 'in-progress') {
    const activeRun = await db.select({ id: runSessions.id }).from(runSessions).where(and(eq(runSessions.studentId, studentId), eq(runSessions.accessType, 'FREE_RUN'), eq(runSessions.status, 'IN_PROGRESS'), gt(runSessions.expiresAt, new Date()))).limit(1);
    if (!activeRun.length) {
      await db.update(students).set({ freeRunStatus: 'available', freeRunStartedAt: null, lastActiveAt: new Date() }).where(eq(students.id, studentId));
      freeRunStatus = 'available';
    }
  }
  const context = await getCurrentAcademicContext();
  const allEnts = await db.select().from(entitlements).where(eq(entitlements.studentId, studentId));
  const complimentary = allEnts.find((e:any) => e.status === 'ACTIVE' && String(e.grantType || '') === 'COMPLIMENTARY');
  if (complimentary) {
    return {
      academicYear: context.academicYear, term: context.term, freeRunStatus, hasScheduleAccess: true, effectivePlan: 'COMPLIMENTARY',
      accessLabel: 'Complimentary · Unlimited', expiresOn: null, daysRemaining: null, hasActiveAccess: true,
      previousAccessExpired: false, previousAccessLabel: null, upgradeAvailable: false, complimentaryUnlimited: true, complimentaryEntitlementId: complimentary.id,
      hasFreeRun: freeRunStatus === 'available' || freeRunStatus === 'in-progress',
      hasCurrentTerm: false,
      hasAcademicYear: false,
    };
  }
  const ents = await db.select().from(entitlements).where(and(eq(entitlements.studentId, studentId), eq(entitlements.status, 'ACTIVE'), sql`(${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} > now())`));
  const decision = evaluateScheduleAccess(freeRunStatus, { academicYear: context.academicYear, term: context.term }, ents.map(e => ({ plan: e.plan as 'CURRENT_TERM' | 'ACADEMIC_YEAR', academicYear: e.academicYear, term: e.term as 'FALL'|'SPRING'|'SUMMER'|null, status: e.status as 'ACTIVE'|'REVOKED' })));
  const ay = ents.find(e => e.plan === 'ACADEMIC_YEAR' && e.academicYear === context.academicYear);
  const termEnt = ents.find(e => e.plan === 'CURRENT_TERM' && e.academicYear === context.academicYear && e.term === context.term);
  const effectivePlan = ay ? 'ACADEMIC_YEAR' : termEnt ? 'CURRENT_TERM' : freeRunStatus !== 'used' ? 'FREE_RUN' : 'NONE';
  const expiresOn = ay ? await getConfiguredExpiry(context.academicYear, 'SUMMER') : termEnt ? await getConfiguredExpiry(context.academicYear, context.term) : null;
  const daysRemaining = expiresOn ? Math.max(0, Math.ceil((expiresOn.getTime() - Date.now()) / 86400000)) : null;
  return {
    academicYear: context.academicYear, term: context.term, freeRunStatus, ...decision, effectivePlan,
    accessLabel: ay ? `Academic Year · ${context.academicYear}` : termEnt ? `Current Term · ${context.term}` : freeRunStatus !== 'used' ? 'Free run remaining' : 'No active access',
    expiresOn: expiresOn?.toISOString() || null, daysRemaining,
    hasActiveAccess: Boolean(decision.hasScheduleAccess),
    previousAccessExpired: !decision.hasScheduleAccess && allEnts.some(e => {
      if (e.status !== 'ACTIVE') return false;
      if (e.plan === 'ACADEMIC_YEAR') return e.academicYear !== context.academicYear;
      return e.academicYear !== context.academicYear || e.term !== context.term;
    }),
    previousAccessLabel: !decision.hasScheduleAccess ? (() => {
      const previous = allEnts.filter(e => e.status === 'ACTIVE' && (e.academicYear !== context.academicYear || e.term !== context.term)).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      return previous ? `${previous.plan === 'ACADEMIC_YEAR' ? 'Academic Year' : 'Current Term'} access has ended` : null;
    })() : null,
    upgradeAvailable: Boolean(termEnt && !ay),
  };
}

export async function requireScheduleAccessState(studentId: string) {
  const state = await getAccessState(studentId);
  if (!state.hasScheduleAccess) throw new Error('Access denied: your free run has been used and no active Gadwal access was found.');
  return state;
}


export async function canContinuePaidRun(studentId: string, runAcademicYear: string, runTerm: 'FALL' | 'SPRING' | 'SUMMER') {
  const db = getDb();
  if (!db) throw new Error('DB not initialized');
  const context = await getCurrentAcademicContext();
  const entRows = await db.select().from(entitlements)
    .where(and(eq(entitlements.studentId, studentId), eq(entitlements.status, 'ACTIVE')));
  if (entRows.some((e:any) => String(e.grantType || '') === 'COMPLIMENTARY' && (!e.expiresAt || new Date(e.expiresAt).getTime() > Date.now()))) return true;
  return canContinuePaidRunPolicy(
    { academicYear: runAcademicYear, term: runTerm },
    { academicYear: context.academicYear, term: context.term },
    entRows.map((e) => ({
      plan: e.plan as 'CURRENT_TERM' | 'ACADEMIC_YEAR',
      academicYear: e.academicYear,
      term: e.term as 'FALL' | 'SPRING' | 'SUMMER' | null,
      status: e.status as 'ACTIVE' | 'REVOKED',
    })),
  );
}
