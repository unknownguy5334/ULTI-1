import { getDb, getDbPool, testDbConnection } from '../db';
import { students, paymentSubmissions, entitlements, appConfig, paymentMethodsConfig, adminAuditLog, activityAudit, savedCourses, savedSchedules, runSessions, notifications, products, productPriceHistory, academicPeriods, supportTickets } from '../db/schema';
import { eq, desc, count, sql, and, or, ilike, gte, lte, inArray } from 'drizzle-orm';
import { getCurrentAcademicContext } from './academicContext';

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');
  return db;
}

export async function getOwnerDashboardStats() {
  const db = dbOrThrow();
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
  const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(dayStart); monthStart.setDate(1);
  const [studentRows, activeEntitlements, activeEntitlementPlans, paymentGroups, usageGroups, pendingPayments, openTickets] = await Promise.all([ 
    db.select({ total: count(), active: sql<number>`count(*) filter (where ${students.accountStatus} = 'ACTIVE')`, admins: sql<number>`count(*) filter (where ${students.role} in ('ADMIN','OWNER'))` }).from(students),
    db.select({ count: count() }).from(entitlements).where(and(eq(entitlements.status, 'ACTIVE'), sql`(${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} >= now())`)),
    db.select({ plan: entitlements.plan, count: count() }).from(entitlements).where(and(eq(entitlements.status, 'ACTIVE'), sql`(${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} >= now())`)).groupBy(entitlements.plan),
    db.select({ status: paymentSubmissions.status, totalAmount: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, count: count() }).from(paymentSubmissions).groupBy(paymentSubmissions.status),
    db.select({ accessType: runSessions.accessType, status: runSessions.status, count: count() }).from(runSessions).groupBy(runSessions.accessType, runSessions.status),
    db.select({ count: count() }).from(paymentSubmissions).where(eq(paymentSubmissions.status, 'PENDING')),
    db.select({ count: count() }).from(supportTickets).where(or(eq(supportTickets.status, 'OPEN'), eq(supportTickets.status, 'IN_PROGRESS'))),
  ]);
  const context = await getCurrentAcademicContext();
  const [expiringRows, revenueDay, revenueWeek, revenueMonth, revenueAcademicYear, runsDay, runsWeek, usageToday] = await Promise.all([
    db.select({ count: sql<number>`count(distinct ${entitlements.studentId})` }).from(entitlements).where(and(eq(entitlements.status,'ACTIVE'), sql`${entitlements.expiresAt} IS NOT NULL`, sql`${entitlements.expiresAt} >= now()`, sql`${entitlements.expiresAt} <= now() + interval '30 days'`)),

    db.select({ total: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)` }).from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, dayStart))),
    db.select({ total: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)` }).from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, weekStart))),
    db.select({ total: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)` }).from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, monthStart))),
    db.select({ total: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)` }).from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), eq(paymentSubmissions.academicYear, context.academicYear))),
    db.select({ count: count() }).from(runSessions).where(gte(runSessions.startedAt, dayStart)),
    db.select({ count: count() }).from(runSessions).where(gte(runSessions.startedAt, weekStart)),
    db.select({ eventType: activityAudit.eventType, count: count() }).from(activityAudit).where(gte(activityAudit.timestamp, dayStart)).groupBy(activityAudit.eventType),
  ]);
  const totalStudents = Number(studentRows[0]?.total || 0);
  const paid = Number(activeEntitlements[0]?.count || 0);
  const annual = Number((activeEntitlementPlans||[]).find((x:any)=>x.plan==='ACADEMIC_YEAR')?.count || 0);
  const semester = Number((activeEntitlementPlans||[]).find((x:any)=>x.plan==='CURRENT_TERM')?.count || 0);
  const usageMap = Object.fromEntries((usageToday||[]).map((x:any)=>[x.eventType,Number(x.count||0)]));
  const ocr = Object.entries(usageMap).filter(([k])=>/OCR|EXTRACT/i.test(k)).reduce((n,[,v])=>n+Number(v),0);
  const generation = Object.entries(usageMap).filter(([k])=>/RUN|SCHEDULE/i.test(k)).reduce((n,[,v])=>n+Number(v),0);
  const failed = Number((usageGroups||[]).filter((x:any)=>x.status==='FAILED').reduce((n:number,x:any)=>n+Number(x.count||0),0));
  return {
    students: { total: totalStudents, active: Number(studentRows[0]?.active || 0), paid, annual, semester, admins: Number(studentRows[0]?.admins || 0) },
    payments: paymentGroups,
    usage: usageGroups,
    revenue: { day: Number(revenueDay[0]?.total || 0), week: Number(revenueWeek[0]?.total || 0), month: Number(revenueMonth[0]?.total || 0), academicYear: Number(revenueAcademicYear[0]?.total || 0) },
    funnel: { active: Number(studentRows[0]?.active || 0), paid, firstGeneration: generation, paidPassShareOfAccounts: totalStudents ? paid / totalStudents * 100 : null, annualShare: paid ? Number(((activeEntitlementPlans||[]).find((x:any)=>x.plan==='ACADEMIC_YEAR')?.count||0))/paid*100 : 0 },
    // Security-event monitoring is not backed by a reliable event feed here. Do not fabricate a zero-risk value.
    security: null,
    usageSummary: { ocr, generations: generation, success: Math.max(0,generation-failed), failed },
    operations: { pendingPayments: Number(pendingPayments[0]?.count || 0), openTickets: Number(openTickets[0]?.count || 0), expiringAccess30d: Number(expiringRows[0]?.count || 0), runsDay: Number(runsDay[0]?.count || 0), runsWeek: Number(runsWeek[0]?.count || 0) },
  };
}

export async function getAdminAuditLogs(filters: { limit?: number; action?: string; adminId?: string; targetType?: string; targetId?: string; from?: Date; to?: Date } = {}) {
  const db = dbOrThrow();
  const limit = Math.min(Math.max(Number(filters.limit || 200), 1), 500);
  const clauses = [] as any[];
  if (filters.action) clauses.push(eq(adminAuditLog.action, filters.action));
  if (filters.adminId) clauses.push(eq(adminAuditLog.adminId, filters.adminId));
  if (filters.targetType) clauses.push(eq(adminAuditLog.targetType, filters.targetType));
  if (filters.targetId) clauses.push(eq(adminAuditLog.targetId, filters.targetId));
  if (filters.from) clauses.push(gte(adminAuditLog.timestamp, filters.from));
  if (filters.to) clauses.push(lte(adminAuditLog.timestamp, filters.to));
  return db.select().from(adminAuditLog).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(adminAuditLog.timestamp)).limit(limit);
}

export async function logAdminAction(adminId: string, action: string, targetType: string, targetId: string | null, metadata: any) {
  const db = dbOrThrow();
  await db.insert(adminAuditLog).values({ adminId, action, targetType, targetId: targetId || null, metadata });
}

export async function getAdminOverviewData() {
  const db = dbOrThrow();
  const [
    configRows, methods, productRows, periods, tickets, recentNotifications, priceHistory,
    studentCount, activeStudentCount, entitlementCount, pendingCount, revenueSum, openTicketCount
  ] = await Promise.all([
    db.select().from(appConfig).limit(1),
    db.select().from(paymentMethodsConfig).orderBy(paymentMethodsConfig.id),
    db.select().from(products).orderBy(products.id),
    db.select().from(academicPeriods).orderBy(desc(academicPeriods.startDate)).limit(24),
    db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(200),
    db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100),
    db.select().from(productPriceHistory).orderBy(desc(productPriceHistory.createdAt)).limit(200),
    db.select({ count: count() }).from(students),
    db.select({ count: count() }).from(students).where(eq(students.accountStatus, 'ACTIVE')),
    db.select({ count: count() }).from(entitlements).where(eq(entitlements.status, 'ACTIVE')),
    db.select({ count: count() }).from(paymentSubmissions).where(eq(paymentSubmissions.status, 'PENDING')),
    db.select({ revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)` }).from(paymentSubmissions).where(eq(paymentSubmissions.status, 'APPROVED')),
    db.select({ count: count() }).from(supportTickets).where(or(eq(supportTickets.status, 'OPEN'), eq(supportTickets.status, 'IN_PROGRESS'))),
  ]);

  const studentsCount = Number(studentCount[0]?.count || 0);
  const activeStudentsCount = Number(activeStudentCount[0]?.count || 0);
  const activeEntitlementsCount = Number(entitlementCount[0]?.count || 0);
  const pendingPaymentsCount = Number(pendingCount[0]?.count || 0);
  const totalRevenue = Number(revenueSum[0]?.revenue || 0);
  const openSupportCount = Number(openTicketCount[0]?.count || 0);

  return {
    config: configRows[0] || null,
    paymentMethods: methods,
    products: productRows,
    academicPeriods: periods,
    tickets,
    recentNotifications,
    priceHistory,
    studentsCount,
    activeStudentsCount,
    activeEntitlementsCount,
    pendingPaymentsCount,
    totalRevenue,
    openSupportCount,
  };
}

export async function getFinancialReport(range: { from?: Date; to?: Date } = {}) {
  const db = dbOrThrow();
  const clauses = [eq(paymentSubmissions.status, 'APPROVED')] as any[];
  if (range.from) clauses.push(gte(paymentSubmissions.createdAt, range.from));
  if (range.to) clauses.push(lte(paymentSubmissions.createdAt, range.to));

  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
  const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(dayStart); monthStart.setDate(1);

  const [summary, monthSum, weekSum, daySum, byPlan, byMethod, daily] = await Promise.all([
    db.select({ revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, payments: count() }).from(paymentSubmissions).where(and(...clauses)),
    db.select({ revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, payments: count() }).from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, monthStart))),
    db.select({ revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, payments: count() }).from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, weekStart))),
    db.select({ revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, payments: count() }).from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, dayStart))),
    db.select({ plan: paymentSubmissions.plan, total: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, count: count(), payments: count() }).from(paymentSubmissions).where(and(...clauses)).groupBy(paymentSubmissions.plan),
    db.select({ method: paymentSubmissions.paymentMethod, total: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, count: count(), payments: count() }).from(paymentSubmissions).where(and(...clauses)).groupBy(paymentSubmissions.paymentMethod),
    db.select({ date: sql<string>`to_char(date_trunc('day', ${paymentSubmissions.createdAt}), 'YYYY-MM-DD')`, total: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, count: count(), payments: count() }).from(paymentSubmissions).where(and(...clauses)).groupBy(sql`date_trunc('day', ${paymentSubmissions.createdAt})`).orderBy(sql`date_trunc('day', ${paymentSubmissions.createdAt}) desc`).limit(180),
  ]);

  const rawSum = summary[0] || { revenue: 0, payments: 0 };
  const totalRev = Number(rawSum.revenue || 0);
  const totalCount = Number(rawSum.payments || 0);
  const avg = totalCount > 0 ? Math.round(totalRev / totalCount) : 0;

  return {
    summary: {
      totalRevenue: totalRev,
      revenue: totalRev,
      approvedCount: totalCount,
      payments: totalCount,
      monthRevenue: Number(monthSum[0]?.revenue || 0),
      weekRevenue: Number(weekSum[0]?.revenue || 0),
      dayRevenue: Number(daySum[0]?.revenue || 0),
      averageOrderValue: avg,
    },
    byPlan,
    byMethod,
    methods: byMethod,
    daily,
  };
}

export async function getProductPriceHistory(productId?: string) {
  const db = dbOrThrow();
  return db.select().from(productPriceHistory).where(productId ? eq(productPriceHistory.productId, productId) : undefined).orderBy(desc(productPriceHistory.createdAt)).limit(300);
}

export async function getSupportTickets(filters: { status?: string; priority?: string; search?: string; page?: number; pageSize?: number } = {}) {
  const db = dbOrThrow();
  const page = Math.max(1, Math.floor(Number(filters.page) || 1));
  const pageSize = Math.min(50, Math.max(10, Math.floor(Number(filters.pageSize) || 25)));
  const clauses = [] as any[];
  const status = String(filters.status || 'ALL').toUpperCase();
  if (status === 'OPEN') clauses.push(inArray(supportTickets.status, ['OPEN', 'IN_PROGRESS']));
  else if (status === 'RESOLVED') clauses.push(inArray(supportTickets.status, ['RESOLVED', 'CLOSED']));
  else if (status !== 'ALL') throw new Error('Invalid support status filter.');
  const priority = String(filters.priority || 'ALL').toUpperCase();
  if (priority !== 'ALL') {
    if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) throw new Error('Invalid support priority filter.');
    clauses.push(eq(supportTickets.priority, priority));
  }
  const searchText = String(filters.search || '').trim().slice(0, 120);
  if (searchText) {
    // Treat user text literally instead of allowing `%` or `_` to become SQL wildcards.
    const q = `%${searchText.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push(or(
      ilike(supportTickets.subject, q),
      ilike(supportTickets.description, q),
      ilike(students.email, q),
      ilike(students.displayName, q),
    ));
  }
  const where = clauses.length ? and(...clauses) : undefined;
  const [tickets, totalRows] = await Promise.all([
    db.select({
      id: supportTickets.id,
      studentId: supportTickets.studentId,
      category: supportTickets.category,
      subject: supportTickets.subject,
      description: supportTickets.description,
      priority: supportTickets.priority,
      status: supportTickets.status,
      assignedAdminId: supportTickets.assignedAdminId,
      internalNotes: supportTickets.internalNotes,
      resolution: supportTickets.resolution,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      resolvedAt: supportTickets.resolvedAt,
      studentEmail: students.email,
      studentName: students.displayName,
    }).from(supportTickets)
      .leftJoin(students, eq(supportTickets.studentId, students.id))
      .where(where)
      .orderBy(desc(supportTickets.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(supportTickets)
      .leftJoin(students, eq(supportTickets.studentId, students.id))
      .where(where),
  ]);
  return { tickets, total: Number(totalRows[0]?.total || 0), page, pageSize };
}

export async function getOperationalMetrics() {
  const db = dbOrThrow();
  const [runs, activity, ocrEvents, scheduleEvents] = await Promise.all([
    db.select({ status: runSessions.status, accessType: runSessions.accessType, count: count(), avgSeconds: sql<number>`coalesce(avg(extract(epoch from (coalesce(${runSessions.completedAt}, ${runSessions.failedAt}, now()) - ${runSessions.startedAt}))),0)` }).from(runSessions).groupBy(runSessions.status, runSessions.accessType),
    db.select({ eventType: activityAudit.eventType, count: count() }).from(activityAudit).groupBy(activityAudit.eventType),
    db.select({ eventType: activityAudit.eventType, count: count() }).from(activityAudit).where(or(ilike(activityAudit.eventType, '%OCR%'), ilike(activityAudit.eventType, '%EXTRACT%'))).groupBy(activityAudit.eventType),
    db.select({ eventType: activityAudit.eventType, count: count() }).from(activityAudit).where(or(ilike(activityAudit.eventType, '%SCHEDULE%'), ilike(activityAudit.eventType, '%RUN%'))).groupBy(activityAudit.eventType),
  ]);
  return { runs, activity, ocrEvents, scheduleEvents };
}

export async function getSecuritySummary() {
  const db = dbOrThrow();
  const [admins, recentAdminActions] = await Promise.all([
    db.select({ id: students.id, email: students.email, displayName: students.displayName, role: students.role, accountStatus: students.accountStatus, lastActiveAt: students.lastActiveAt }).from(students).where(or(eq(students.role, 'ADMIN'), eq(students.role, 'OWNER'))).orderBy(desc(students.lastActiveAt)),
    db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.timestamp)).limit(100),
  ]);
  let sessions: any[] = [];
  try {
    const pool = getDbPool();
    if (pool) {
      const result = await pool.query(`SELECT s.id, s."userId", s."expiresAt", s."createdAt", u.email FROM neon_auth.session s JOIN neon_auth.user u ON u.id = s."userId" ORDER BY s."createdAt" DESC LIMIT 200`);
      sessions = result.rows;
    }
  } catch { sessions = []; }
  return { admins, recentAdminActions, sessions };
}

export async function getOwnerHealth() {
  const checkedAt = new Date().toISOString();
  const database = await testDbConnection();
  let auth = { ok: false, configured: Boolean(process.env.NEON_AUTH_URL || process.env.NEON_AUTH_BASE_URL) };
  let gemini = { ok: false, configured: Boolean(process.env.GEMINI_API_KEY) };
  let storage = { ok: false, configured: Boolean(process.env.DATABASE_URL) };
  const db = getDb();
  try { if (db) { await db.execute(sql`select 1`); storage = { ok: true, configured: true }; } } catch {}
  const authBase = process.env.NEON_AUTH_URL || process.env.NEON_AUTH_BASE_URL || '';
  if (authBase) {
    try { const r = await fetch(authBase.replace(/\/$/, '') + '/get-session', { method:'GET', signal: AbortSignal.timeout(3000) }); auth = { ok: r.status < 500, configured: true }; } catch { auth = { ok:false, configured:true }; }
  }
  if (process.env.GEMINI_API_KEY) {
    try { const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(process.env.GEMINI_API_KEY), { signal: AbortSignal.timeout(3500) }); gemini = { ok: r.ok, configured:true }; } catch { gemini = { ok:false, configured:true }; }
  }
  return { checkedAt, database, auth, gemini, storage, api: { ok:true }, scheduleGeneration: { ok: Boolean(database.ok) }, ocr: { ok: Boolean(database.ok && gemini.ok) } };
}
