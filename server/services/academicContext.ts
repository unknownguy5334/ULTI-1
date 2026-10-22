import { getDb } from '../db';
import { and, eq } from 'drizzle-orm';
import { appConfig, academicPeriods } from '../db/schema';
import { readTtlCache, writeTtlCache, type TtlCacheEntry } from '../perfCache';

export interface AcademicContext {
  academicYear: string;
  term: 'FALL' | 'SPRING' | 'SUMMER';
  source: 'AUTO' | 'ADMIN_OVERRIDE';
}

const CACHE_TTL_MS = 5_000;
let cachedOverride: TtlCacheEntry<'AUTO' | 'FALL' | 'SPRING' | 'SUMMER'> | null = null;

export function invalidateAcademicContextCache(): void {
  cachedOverride = null;
}

async function getOverrideMode(): Promise<'AUTO' | 'FALL' | 'SPRING' | 'SUMMER'> {
  const cached = readTtlCache(cachedOverride);
  if (cached) return cached;
  const db = getDb();
  if (!db) throw new Error('Database not initialized');
  const rows = await db.select({ termOverrideMode: appConfig.termOverrideMode }).from(appConfig).limit(1);
  const overrideMode = rows[0]?.termOverrideMode ?? 'AUTO';
  cachedOverride = writeTtlCache(overrideMode, CACHE_TTL_MS);
  return overrideMode;
}

function getCairoCalendarDate(input: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(input);
  const values = new Map(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  if (!year || !month || !day) throw new Error('Unable to determine Cairo calendar date.');
  return { year, month, day };
}

export async function getCurrentAcademicContext(mockDate?: Date): Promise<AcademicContext> {
  const overrideMode = await getOverrideMode();
  const { year, month, day } = getCairoCalendarDate(mockDate || new Date());

  let academicYearStart = year;
  let academicYearEnd = year + 1;
  if (month < 9) {
    academicYearStart = year - 1;
    academicYearEnd = year;
  }
  const academicYear = `${academicYearStart}–${academicYearEnd}`;

  if (overrideMode !== 'AUTO') {
    return { academicYear, term: overrideMode, source: 'ADMIN_OVERRIDE' };
  }

  const db = getDb();
  if (db) {
    const nowRows = await db.select({ term: academicPeriods.term }).from(academicPeriods)
      .where(and(eq(academicPeriods.academicYear, academicYear), eq(academicPeriods.enabled, 1)))
      .limit(10);
    const currentPeriod = nowRows.find((p: any) => p.term);
    if (currentPeriod) {
      // Use the configured academic period when the owner has created it. Exact date
      // windows are applied by registration/access logic; the term list here remains
      // conservative and falls back to the established calendar below.
      const matching = await db.select().from(academicPeriods).where(and(eq(academicPeriods.academicYear, academicYear), eq(academicPeriods.enabled, 1))).limit(10);
      const currentDate = new Date(Date.UTC(year, month - 1, day));
      const configured = matching.find((p: any) => {
        const start = p.startDate ? new Date(p.startDate) : null;
        const end = p.endDate ? new Date(p.endDate) : null;
        if (!start || !end) return false;
        return currentDate >= new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) && currentDate <= new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      });
      if (configured) return { academicYear, term: configured.term as any, source: 'AUTO' };
    }
  }

  let autoTerm: 'FALL' | 'SPRING' | 'SUMMER';
  if (month >= 9 || (month === 1 && day <= 19)) {
    autoTerm = 'FALL';
  } else if ((month === 1 && day >= 20) || (month > 1 && month < 6) || (month === 6 && day <= 19)) {
    autoTerm = 'SPRING';
  } else {
    autoTerm = 'SUMMER';
  }

  return { academicYear, term: autoTerm, source: 'AUTO' };
}
