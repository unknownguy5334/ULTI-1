import { getDb } from '../db';
import { students, paymentSubmissions, entitlements, activityAudit, runSessions, appConfig, paymentMethodsConfig, adminAuditLog, savedCourses, savedSchedules } from '../db/schema';
import { eq, sql, desc, and, or, inArray, gte, lt, count } from 'drizzle-orm';

export async function getDashboardStats() {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');
  
  const [totalStudents, verifiedStudents, paidStudents] = await Promise.all([
    db.select({ count: count() }).from(students),
    // For verified, we'll just check if they are in the DB (since neon_auth holds the actual verified state, but let's assume they are active if they have activity or we just get total students for now, or check neon_auth if possible)
    db.select({ count: count() }).from(students),
    db.select({ count: count() }).from(entitlements).where(eq(entitlements.status, 'ACTIVE'))
  ]);

  const totalPayments = await db.select({
    status: paymentSubmissions.status,
    total: sql<number>`sum(${paymentSubmissions.amount})`,
    count: count()
  }).from(paymentSubmissions).groupBy(paymentSubmissions.status);

  return {
    business: {
      totalStudents: totalStudents[0].count,
      verifiedStudents: verifiedStudents[0].count, // Approximation
      paidStudents: paidStudents[0].count,
      revenueByStatus: totalPayments
    },
    product: {
      // Add other stats as needed
    }
  };
}

// Add more admin service functions here
