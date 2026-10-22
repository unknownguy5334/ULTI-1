import { eq, sql } from 'drizzle-orm';
import { entitlements, students } from '../db/schema';

export const BROADCAST_AUDIENCES = ['ALL', 'ACTIVE', 'PAID', 'FREE', 'EXPIRING', 'STUDENT'] as const;
export type BroadcastAudience = typeof BROADCAST_AUDIENCES[number];

export function isBroadcastAudience(value: string): value is BroadcastAudience {
  return (BROADCAST_AUDIENCES as readonly string[]).includes(value);
}

/** One canonical server-side definition for notification recipient scopes. */
export function getNotificationAudienceCondition(scope: string, studentId?: string) {
  switch (scope) {
    case 'ALL':
      return undefined;
    case 'ACTIVE':
    case 'VERIFIED': // Backward compatibility for previously saved campaigns.
      return eq(students.accountStatus, 'ACTIVE');
    case 'PAID':
      return sql`EXISTS (SELECT 1 FROM ${entitlements} WHERE ${entitlements.studentId} = ${students.id} AND ${entitlements.status} = 'ACTIVE' AND (${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} >= now()))`;
    case 'FREE':
      return sql`NOT EXISTS (SELECT 1 FROM ${entitlements} WHERE ${entitlements.studentId} = ${students.id} AND ${entitlements.status} = 'ACTIVE' AND (${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} >= now()))`;
    case 'EXPIRING':
      return sql`EXISTS (SELECT 1 FROM ${entitlements} WHERE ${entitlements.studentId} = ${students.id} AND ${entitlements.status} = 'ACTIVE' AND ${entitlements.expiresAt} IS NOT NULL AND ${entitlements.expiresAt} >= now() AND ${entitlements.expiresAt} <= now() + interval '30 days')`;
    case 'STUDENT':
      if (!studentId) throw new Error('A student is required for a student-targeted campaign.');
      return eq(students.id, studentId);
    default:
      throw new Error('Unsupported notification audience.');
  }
}

export function notificationAudienceLabel(scope: string): string {
  const labels: Record<string, string> = {
    ALL: 'All registered students',
    ACTIVE: 'Accounts with active status',
    VERIFIED: 'Active accounts',
    PAID: 'Students with an active pass',
    FREE: 'Registered students without an active pass',
    EXPIRING: 'Passes expiring within 30 days',
    STUDENT: 'One student',
  };
  return labels[scope] || 'Unknown audience';
}
