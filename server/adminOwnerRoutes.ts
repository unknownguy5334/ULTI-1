import { Router, Request, Response } from 'express';
import { requireAdmin, requireAdminRole } from './authMiddleware';
import { persistentRateLimitMiddleware } from './rateLimitMiddleware';
import { getDb, getDbPool } from './db';
import { students, appConfig, products, paymentMethodsConfig, productPriceHistory, academicPeriods, supportTickets, notifications, adminAuditLog, entitlements, notificationCampaigns, savedSchedules, activityAudit, runSessions, paymentSubmissions, paymentAdjustments, supportTicketMessages } from './db/schema';
import { and, desc, eq, sql, or, ilike, inArray, gte } from 'drizzle-orm';
import {
  getOwnerDashboardStats, getAdminAuditLogs, getAdminOverviewData, getFinancialReport,
  getProductPriceHistory, getSupportTickets, getOperationalMetrics, getSecuritySummary, getOwnerHealth, logAdminAction,
} from './services/adminOwnerService';
import { getCurrentAcademicContext, invalidateAcademicContextCache } from './services/academicContext';
import { getNotificationAudienceCondition, isBroadcastAudience } from './services/notificationAudience';

function bodyString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v || v.length > max || /[\u0000-\u001F\u007F]/.test(v)) return undefined;
  return v;
}
function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
function adminId(req: Request) { return String((req as any).user.id); }

const adminRead = (name: string, limit = 120) => [requireAdmin, persistentRateLimitMiddleware(name, limit, 60_000, (req) => `admin:${(req as any).user.id}`)] as any;
const adminWrite = (name: string, limit = 30) => [requireAdmin, persistentRateLimitMiddleware(name, limit, 60_000, (req) => `admin:${(req as any).user.id}`)] as any;
const roleRead = (roles: any[], name: string, limit = 120) => [requireAdminRole(...roles), persistentRateLimitMiddleware(name, limit, 60_000, (req) => `admin:${(req as any).user.id}`)] as any;
const roleWrite = (roles: any[], name: string, limit = 30) => [requireAdminRole(...roles), persistentRateLimitMiddleware(name, limit, 60_000, (req) => `admin:${(req as any).user.id}`)] as any;

type AnalyticsRange = '7d' | '30d' | 'all';

function normalizeAnalyticsRange(raw: unknown): AnalyticsRange {
  return raw === '7d' || raw === 'all' ? raw : '30d';
}

async function getAnalyticsReport(rawRange: unknown) {
  const db = getDb();
  if (!db) throw new Error('Database unavailable.');
  const range = normalizeAnalyticsRange(rawRange);
  const now = new Date();
  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : null;
  const cutoff = rangeDays == null ? null : new Date(now.getTime() - rangeDays * 86400000);
  // Lifetime summary totals remain lifetime; daily trend tables show at most the latest year.
  const chartCutoff = cutoff || new Date(now.getTime() - 365 * 86400000);
  const after = (column: any, date: Date | null) => date ? gte(column, date) : undefined;
  const approvedWindow = cutoff
    ? and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, cutoff))
    : eq(paymentSubmissions.status, 'APPROVED');

  const [studentRows, activeRows, paidRows, annualRows, semesterRows, runRows, failedRows,
    active7Rows, newStudentRows, approvedRows, dailySignups, dailyRuns, dailyRevenue] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students),
    db.select({ count: sql<number>`count(*)` }).from(students).where(eq(students.accountStatus, 'ACTIVE')),
    db.select({ count: sql<number>`count(distinct ${entitlements.studentId})` }).from(entitlements).where(and(eq(entitlements.status, 'ACTIVE'), sql`(${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} >= now())`)),
    db.select({ count: sql<number>`count(distinct ${entitlements.studentId})` }).from(entitlements).where(and(eq(entitlements.status, 'ACTIVE'), sql`(${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} >= now())`, ilike(entitlements.plan, '%YEAR%'))),
    db.select({ count: sql<number>`count(distinct ${entitlements.studentId})` }).from(entitlements).where(and(eq(entitlements.status, 'ACTIVE'), sql`(${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} >= now())`, ilike(entitlements.plan, '%TERM%'))),
    db.select({ count: sql<number>`count(*)` }).from(runSessions).where(after(runSessions.startedAt, cutoff)),
    db.select({ count: sql<number>`count(*)` }).from(runSessions).where(cutoff
      ? and(eq(runSessions.status, 'FAILED'), gte(runSessions.startedAt, cutoff))
      : eq(runSessions.status, 'FAILED')),
    db.select({ count: sql<number>`count(distinct ${activityAudit.studentId})` }).from(activityAudit).where(gte(activityAudit.timestamp, new Date(now.getTime() - 7 * 86400000))),
    db.select({ count: sql<number>`count(*)` }).from(students).where(after(students.createdAt, cutoff)),
    db.select({ revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, count: sql<number>`count(*)` }).from(paymentSubmissions).where(approvedWindow),
    db.select({ date: sql<string>`to_char(date_trunc('day', ${students.createdAt}), 'YYYY-MM-DD')`, count: sql<number>`count(*)` })
      .from(students).where(gte(students.createdAt, chartCutoff)).groupBy(sql`date_trunc('day', ${students.createdAt})`).orderBy(sql`date_trunc('day', ${students.createdAt}) asc`),
    db.select({ date: sql<string>`to_char(date_trunc('day', ${runSessions.startedAt}), 'YYYY-MM-DD')`, count: sql<number>`count(*)` })
      .from(runSessions).where(gte(runSessions.startedAt, chartCutoff)).groupBy(sql`date_trunc('day', ${runSessions.startedAt})`).orderBy(sql`date_trunc('day', ${runSessions.startedAt}) asc`),
    db.select({ date: sql<string>`to_char(date_trunc('day', ${paymentSubmissions.createdAt}), 'YYYY-MM-DD')`, revenue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, count: sql<number>`count(*)` })
      .from(paymentSubmissions).where(and(eq(paymentSubmissions.status, 'APPROVED'), gte(paymentSubmissions.createdAt, chartCutoff)))
      .groupBy(sql`date_trunc('day', ${paymentSubmissions.createdAt})`).orderBy(sql`date_trunc('day', ${paymentSubmissions.createdAt}) asc`),
  ]);

  const total = Number(studentRows[0]?.count || 0);
  const paid = Number(paidRows[0]?.count || 0);
  const active7 = Number(active7Rows[0]?.count || 0);
  const runs = Number(runRows[0]?.count || 0);
  const failedRuns = Number(failedRows[0]?.count || 0);
  const approvedValue = Number(approvedRows[0]?.revenue || 0);
  const approvedCount = Number(approvedRows[0]?.count || 0);
  return {
    range,
    periodLabel: range === '7d' ? 'Past 7 days' : range === '30d' ? 'Past 30 days' : 'Lifetime',
    generatedAt: now.toISOString(),
    chartWindowDays: rangeDays || 365,
    sourceNotes: {
      students: 'Current account table; lifetime count.',
      active7: 'Distinct student IDs with activity audit events in the last 7 days.',
      runs: 'Run sessions started during the selected period; lifetime totals for Lifetime.',
      paymentValue: 'Sum of approved payment submissions created during the selected period; not a reconciled net-revenue ledger.',
      timezone: 'Database timestamps are grouped by the database session timezone.',
    },
    students: total,
    verified: Number(activeRows[0]?.count || 0),
    paid,
    annual: Number(annualRows[0]?.count || 0),
    semester: Number(semesterRows[0]?.count || 0),
    runs,
    failedRuns,
    active7,
    newStudents: Number(newStudentRows[0]?.count || 0),
    approvedValue,
    approvedPayments: approvedCount,
    // This is a prevalence ratio, not a cohort-based conversion rate.
    activePassShare: total ? (paid / total) * 100 : 0,
    activation7: total ? (active7 / total) * 100 : 0,
    dailySignups,
    dailyRuns,
    dailyRevenue,
  };
}

export function registerAdminOwnerRoutes(app: Router) {
  app.get('/api/admin/owner/dashboard', ...roleRead(['OWNER','ADMIN','FINANCE','SUPPORT'], 'admin_owner_dashboard'), async (req, res) => {
    try {
      const stats = await getOwnerDashboardStats();
      const role = String((req as any).user?.adminRole || (req as any).user?.role || 'SUPPORT');
      if (role === 'SUPPORT') {
        stats.revenue = { day: null, week: null, month: null, academicYear: null };
        stats.payments = [];
        stats.security = undefined;
      } else if (role === 'FINANCE') {
        stats.security = undefined;
      }
      res.json({ ok: true, stats });
    }
    catch { res.status(500).json({ error: 'Failed to load dashboard' }); }
  });

  app.get('/api/admin/owner/overview', ...roleRead(['OWNER','ADMIN','FINANCE'], 'admin_owner_overview'), async (_req, res) => {
    try { res.json({ ok: true, data: await getAdminOverviewData() }); }
    catch { res.status(500).json({ error: 'Failed to load owner configuration.' }); }
  });

  app.get('/api/admin/owner/audit-logs', ...roleRead(['OWNER','ADMIN'], 'admin_audit'), async (req, res) => {
    try {
      const logs = await getAdminAuditLogs({
        limit: clamp(req.query.limit, 1, 500, 200),
        action: bodyString(req.query.action, 100), adminId: bodyString(req.query.adminId, 200),
        targetType: bodyString(req.query.targetType, 100), targetId: bodyString(req.query.targetId, 200),
        from: typeof req.query.from === 'string' && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : undefined,
        to: typeof req.query.to === 'string' && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : undefined,
      });
      res.json({ ok: true, logs });
    } catch { res.status(500).json({ error: 'Failed to load audit logs.' }); }
  });

  app.get('/api/admin/owner/financials', ...roleRead(['OWNER','ADMIN','FINANCE'], 'admin_financials'), async (req, res) => {
    try {
      const from = typeof req.query.from === 'string' && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : undefined;
      const to = typeof req.query.to === 'string' && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : undefined;
      res.json({ ok: true, report: await getFinancialReport({ from, to }) });
    } catch { res.status(500).json({ error: 'Failed to load financial report.' }); }
  });

  app.get('/api/admin/owner/price-history', ...roleRead(['OWNER','ADMIN','FINANCE'], 'admin_price_history'), async (req, res) => {
    try { res.json({ ok: true, history: await getProductPriceHistory(bodyString(req.query.productId, 100)) }); }
    catch { res.status(500).json({ error: 'Failed to load price history.' }); }
  });

  const upsertProductHandler = async (req: Request, res: Response) => {
    const id = bodyString(req.params.id || req.body?.id, 100); const name = bodyString(req.body?.name, 160);
    const amount = Number(req.body?.amount); const enabled = req.body?.enabled ? 1 : 0; const reason = bodyString(req.body?.reason, 500);
    const durationDays = req.body?.durationDays == null || req.body?.durationDays === '' ? null : Number(req.body.durationDays);
    const accessScope = bodyString(req.body?.accessScope, 40) || 'REGISTRATION';
    const description = bodyString(req.body?.description, 1000) || null;
    const shortDescription = bodyString(req.body?.shortDescription, 300) || null;
    const marketingLabel = bodyString(req.body?.marketingLabel, 120) || null;
    const bestValue = req.body?.bestValue ? 1 : 0;
    const sortOrder = Number(req.body?.sortOrder || 0);
    if (!id || !name || !Number.isInteger(amount) || amount <= 0 || amount > 100000 || (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650)) || !Number.isInteger(sortOrder) || sortOrder < -10000 || sortOrder > 10000) return res.status(400).json({ error: 'Invalid product configuration.' });
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      await db.transaction(async tx => {
        const old = await tx.select().from(products).where(eq(products.id, id)).limit(1);
        const oldAmount = old[0]?.amount ?? null;
        const nextVersion = (old[0]?.version ?? 0) + 1;
        await tx.insert(products).values({ id, name, amount, currency: 'EGP', enabled, version: nextVersion, durationDays, accessScope, description, shortDescription, marketingLabel, bestValue, sortOrder }).onConflictDoUpdate({ target: products.id, set: { name, amount, currency: 'EGP', enabled, version: nextVersion, durationDays, accessScope, description, shortDescription, marketingLabel, bestValue, sortOrder, updatedAt: new Date() } });
        if (oldAmount !== amount) await tx.insert(productPriceHistory).values({ productId: id, oldAmount, newAmount: amount, currency: 'EGP', adminId: adminId(req), reason: reason || 'Owner price change' });
        await tx.insert(adminAuditLog).values({ adminId: adminId(req), action: oldAmount === amount ? 'PRODUCT_UPDATED' : 'PRICE_CHANGED', targetType: 'PRODUCT', targetId: id, metadata: { oldAmount, newAmount: amount, name, enabled, reason: reason || null } });
      });
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Could not update product.' }); }
  };

  app.put('/api/admin/owner/products/:id', ...roleWrite(['OWNER','ADMIN'], 'admin_product_edit'), upsertProductHandler);
  app.put('/api/admin/owner/products', ...roleWrite(['OWNER','ADMIN'], 'admin_product_edit'), upsertProductHandler);
  app.post('/api/admin/owner/products', ...roleWrite(['OWNER','ADMIN'], 'admin_product_edit'), upsertProductHandler);

  app.delete('/api/admin/owner/products/:id', ...roleWrite(['OWNER','ADMIN'], 'admin_product_delete'), async (req, res) => {
    const id = bodyString(req.params.id, 100);
    if (!id) return res.status(400).json({ error: 'Invalid product id.' });
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      await db.update(products).set({ enabled: 0, updatedAt: new Date() }).where(eq(products.id, id));
      await logAdminAction(adminId(req), 'PRODUCT_DEACTIVATED', 'PRODUCT', id, {});
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Could not deactivate product.' }); }
  });

  const upsertPaymentMethodHandler = async (req: Request, res: Response) => {
    const id = bodyString(req.params.id || req.body?.id, 100); const destination = bodyString(req.body?.destination, 200); const instructions = bodyString(req.body?.instructions, 1000) || null; const enabled = req.body?.enabled ? 1 : 0;
    if (!id || !destination) return res.status(400).json({ error: 'Payment method destination is required.' });
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      await db.insert(paymentMethodsConfig).values({ id, enabled, destination, instructions }).onConflictDoUpdate({ target: paymentMethodsConfig.id, set: { enabled, destination, instructions, updatedAt: new Date() } });
      await logAdminAction(adminId(req), 'PAYMENT_METHOD_UPDATED', 'PAYMENT_METHOD', id, { enabled, destinationChanged: true });
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Could not update payment method.' }); }
  };

  app.put('/api/admin/owner/payment-methods/:id', ...roleWrite(['OWNER','FINANCE'], 'admin_payment_method_edit'), upsertPaymentMethodHandler);
  app.put('/api/admin/owner/payment-methods', ...roleWrite(['OWNER','FINANCE'], 'admin_payment_method_edit'), upsertPaymentMethodHandler);
  app.post('/api/admin/owner/payment-methods', ...roleWrite(['OWNER','FINANCE'], 'admin_payment_method_edit'), upsertPaymentMethodHandler);

  app.put('/api/admin/owner/config', ...roleWrite(['OWNER'], 'admin_owner_config'), async (req, res) => {
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    const allowed = ['supportEmail','supportPhone','businessLocation','maintenanceEnabled','maintenanceMessage','maintenanceStartsAt','maintenanceEndsAt','registrationWindows','accessPolicy','featureFlags','freeRunAllowance','termOverrideMode'];
    const patch: any = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) patch[key] = req.body[key];
    if ('termOverrideMode' in patch && !['AUTO','FALL','SPRING','SUMMER'].includes(String(patch.termOverrideMode))) return res.status(400).json({ error: 'Invalid term override.' });
    if ('freeRunAllowance' in patch) { patch.freeRunAllowance = Number(patch.freeRunAllowance); if (!Number.isInteger(patch.freeRunAllowance) || patch.freeRunAllowance < 0 || patch.freeRunAllowance > 20) return res.status(400).json({ error: 'Invalid free run allowance.' }); }
    if ('maintenanceEnabled' in patch) patch.maintenanceEnabled = patch.maintenanceEnabled ? 1 : 0;
    if ('maintenanceMessage' in patch) patch.maintenanceMessage = bodyString(patch.maintenanceMessage, 500) || null;
    if ('supportEmail' in patch) patch.supportEmail = bodyString(patch.supportEmail, 160) || null;
    if ('supportPhone' in patch) patch.supportPhone = bodyString(patch.supportPhone, 40) || null;
    if ('businessLocation' in patch) patch.businessLocation = bodyString(patch.businessLocation, 160) || null;
    patch.updatedAt = new Date();
    try {
      const exists = await db.select({ id: appConfig.id }).from(appConfig).limit(1);
      if (!exists.length) await db.insert(appConfig).values({ id: 'singleton', ...patch });
      else await db.update(appConfig).set(patch).where(eq(appConfig.id, exists[0].id));
      await logAdminAction(adminId(req), 'APP_CONFIG_UPDATED', 'APP_CONFIG', 'singleton', { changedKeys: Object.keys(patch).filter(k => k !== 'updatedAt') });
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Could not update app configuration.' }); }
  });

  app.get('/api/admin/owner/academic-periods', ...roleRead(['OWNER','ADMIN','SUPPORT'], 'admin_academic_periods'), async (_req, res) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Database unavailable.' });
      const [periods, currentContext] = await Promise.all([
        db.select().from(academicPeriods).orderBy(desc(academicPeriods.startDate)).limit(100),
        getCurrentAcademicContext(),
      ]);
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.json({ ok: true, periods, currentContext });
    } catch { res.status(500).json({ error: 'Failed to load academic periods.' }); }
  });

  app.post('/api/admin/owner/academic-periods', ...roleWrite(['OWNER','ADMIN'], 'admin_academic_period_edit'), async (req, res) => {
    const academicYear=bodyString(req.body?.academicYear,20); const term=bodyString(req.body?.term,10);
    if(!academicYear || !['FALL','SPRING','SUMMER'].includes(term || '')) return res.status(400).json({error:'Academic year and term are required.'});
    const parseDate=(v:any)=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null;
    const startDate=parseDate(req.body?.startDate), endDate=parseDate(req.body?.endDate);
    const registrationStart=parseDate(req.body?.registrationStart), registrationEnd=parseDate(req.body?.registrationEnd), accessExpiry=parseDate(req.body?.accessExpiry);
    if (!startDate || !endDate || startDate > endDate) return res.status(400).json({ error: 'Enter a valid start and end date; the end date must be on or after the start date.' });
    if ((req.body?.registrationStart && !registrationStart) || (req.body?.registrationEnd && !registrationEnd) || (req.body?.accessExpiry && !accessExpiry)) return res.status(400).json({ error: 'One of the optional academic dates is invalid.' });
    if (registrationStart && registrationEnd && registrationStart > registrationEnd) return res.status(400).json({ error: 'Registration must end on or after it starts.' });
    const data={ academicYear, term, startDate, endDate, registrationStart, registrationEnd, accessExpiry, enabled:req.body?.enabled===false?0:1, notes:bodyString(req.body?.notes,500)||null, updatedBy:adminId(req), updatedAt:new Date() };
    const db=getDb(); if(!db) return res.status(503).json({error:'Database unavailable.'});
    try { await db.insert(academicPeriods).values(data).onConflictDoUpdate({target:[academicPeriods.academicYear,academicPeriods.term],set:data}); await logAdminAction(adminId(req),'ACADEMIC_PERIOD_UPDATED','ACADEMIC_PERIOD',`${academicYear}:${term}`,data); invalidateAcademicContextCache(); res.json({ok:true}); }
    catch { res.status(500).json({error:'Could not save academic period.'}); }
  });

  // Support list queries are server-filtered and paginated. Conversation history is loaded on demand.
  const supportListHandler = async (req: Request, res: Response) => {
    try {
      const result = await getSupportTickets({
        status: bodyString(req.query.status, 30) || 'ALL',
        priority: bodyString(req.query.priority, 30) || 'ALL',
        search: bodyString(req.query.search, 120),
        page: clamp(req.query.page, 1, 1000000, 1),
        pageSize: clamp(req.query.pageSize, 10, 50, 25),
      });
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.startsWith('Invalid support ')) return res.status(400).json({ error: message });
      res.status(500).json({ error: 'Failed to load support tickets.' });
    }
  };
  app.get('/api/admin/support', ...roleRead(['OWNER','ADMIN','SUPPORT'], 'admin_support_list'), supportListHandler);
  app.get('/api/admin/owner/support', ...roleRead(['OWNER','ADMIN','SUPPORT'], 'admin_support_list'), supportListHandler);

  const supportThreadHandler = async (req: Request, res: Response) => {
    const ticketId = bodyString(req.params.id, 100);
    if (!ticketId) return res.status(400).json({ error: 'A valid support ticket ID is required.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const rows = await db.select({
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
        .where(eq(supportTickets.id, ticketId)).limit(1);
      const ticket = rows[0];
      if (!ticket) return res.status(404).json({ error: 'Support ticket not found.' });
      const messages = await db.select().from(supportTicketMessages)
        .where(eq(supportTicketMessages.ticketId, ticketId))
        .orderBy(supportTicketMessages.createdAt).limit(200);
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.json({ ok: true, ticket: { ...ticket, messages } });
    } catch {
      res.status(500).json({ error: 'Failed to load the conversation.' });
    }
  };
  app.get('/api/admin/support/:id/thread', ...roleRead(['OWNER','ADMIN','SUPPORT'], 'admin_support_thread'), supportThreadHandler);
  app.get('/api/admin/owner/support/:id/thread', ...roleRead(['OWNER','ADMIN','SUPPORT'], 'admin_support_thread'), supportThreadHandler);

  app.get('/api/admin/owner/support-admins', ...roleRead(['OWNER','ADMIN','SUPPORT'], 'admin_support_admins'), async(_req,res)=>{ try { const db=getDb(); if(!db)return res.status(503).json({error:'Database unavailable.'}); const admins=await db.select({id:students.id,email:students.email,displayName:students.displayName,adminRole:students.adminRole,accountStatus:students.accountStatus}).from(students).where(and(eq(students.accountStatus,'ACTIVE'),or(eq(students.adminRole,'OWNER'),eq(students.adminRole,'ADMIN'),eq(students.adminRole,'SUPPORT')))).orderBy(students.email).limit(200); res.json({ok:true,admins}); } catch { res.status(500).json({error:'Failed to load support administrators.'}); } });

  const supportCreateHandler = async (req: Request, res: Response) => {
    const studentId=bodyString(req.body?.studentId,200)||null, category=bodyString(req.body?.category,50), subject=bodyString(req.body?.subject,200), description=bodyString(req.body?.description,5000);
    if(!category||!subject||!description)return res.status(400).json({error:'Category, subject and description are required.'});
    const db=getDb();if(!db)return res.status(503).json({error:'Database unavailable.'});
    try{
      const row=await db.insert(supportTickets).values({studentId,category,subject,description,priority:bodyString(req.body?.priority,20)||'NORMAL',status:'OPEN'}).returning();
      await logAdminAction(adminId(req),'SUPPORT_TICKET_CREATED','SUPPORT_TICKET',row[0].id,{studentId});
      res.json({ok:true,ticket:row[0]});
    }catch{res.status(500).json({error:'Could not create support ticket.'});}
  };
  app.post('/api/admin/support', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_create'), supportCreateHandler);
  app.post('/api/admin/owner/support', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_create'), supportCreateHandler);

  const supportUpdateHandler = async(req: Request, res: Response) => {
    const id=bodyString(req.params.id,100); if(!id)return res.status(400).json({error:'Invalid ticket id.'});
    const db=getDb();if(!db)return res.status(503).json({error:'Database unavailable.'});
    const patch:any={updatedAt:new Date()};
    for(const k of ['category','subject','description','priority','status','assignedAdminId','internalNotes','resolution'] as const){
      if(Object.prototype.hasOwnProperty.call(req.body||{},k)){patch[k]=typeof req.body[k]==='string'?req.body[k].trim():req.body[k];}
    }
    if(patch.priority!==undefined&&!['LOW','NORMAL','HIGH','URGENT'].includes(String(patch.priority)))return res.status(400).json({error:'Invalid ticket priority.'});
    if(patch.status!==undefined&&!['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].includes(String(patch.status)))return res.status(400).json({error:'Invalid ticket status.'});
    if(patch.assignedAdminId!==undefined){
      if(patch.assignedAdminId===null||patch.assignedAdminId===''){patch.assignedAdminId=null;}
      else{
        const assignee=(await db.select({id:students.id}).from(students).where(and(eq(students.id,String(patch.assignedAdminId)),eq(students.accountStatus,'ACTIVE'),or(eq(students.adminRole,'OWNER'),eq(students.adminRole,'ADMIN'),eq(students.adminRole,'SUPPORT')))).limit(1))[0];
        if(!assignee)return res.status(400).json({error:'Assigned administrator is invalid or inactive.'});
      }
    }
    if(patch.status==='RESOLVED'||patch.status==='CLOSED')patch.resolvedAt=new Date();
    else if(patch.status!==undefined)patch.resolvedAt=null;
    try{
      const row=await db.update(supportTickets).set(patch).where(eq(supportTickets.id,id)).returning();
      if(!row.length)return res.status(404).json({error:'Ticket not found.'});
      await logAdminAction(adminId(req),'SUPPORT_TICKET_UPDATED','SUPPORT_TICKET',id,{changedKeys:Object.keys(patch)});
      res.json({ok:true,ticket:row[0]});
    }catch{res.status(500).json({error:'Could not update support ticket.'});}
  };
  app.put('/api/admin/support/:id', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_update'), supportUpdateHandler);
  app.put('/api/admin/owner/support/:id', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_update'), supportUpdateHandler);

  const supportStatusHandler = async (req: Request, res: Response) => {
    const id = bodyString(req.params.id, 100);
    const status = bodyString(req.body?.status, 30);
    if (!id || !status || !['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required.' });
    }
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const patch: any = { status, updatedAt: new Date() };
      if (status === 'RESOLVED' || status === 'CLOSED') patch.resolvedAt = new Date();
      else patch.resolvedAt = null;
      const row = await db.update(supportTickets).set(patch).where(eq(supportTickets.id, id)).returning();
      if (!row.length) return res.status(404).json({ error: 'Ticket not found.' });
      await logAdminAction(adminId(req), 'SUPPORT_TICKET_STATUS_CHANGED', 'SUPPORT_TICKET', id, { status });
      res.json({ ok: true, ticket: row[0] });
    } catch {
      res.status(500).json({ error: 'Could not update ticket status.' });
    }
  };
  app.post('/api/admin/support/:id/status', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_status'), supportStatusHandler);
  app.post('/api/admin/owner/support/:id/status', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_status'), supportStatusHandler);

  const supportReplyHandler = async (req: Request, res: Response) => {
    const ticketId = bodyString(req.params.id, 100);
    const body = bodyString(req.body?.body || req.body?.message, 5000);
    if (!ticketId || !body) return res.status(400).json({ error: 'Reply body is required.' });
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const ticket = (await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1))[0];
      if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
      const row = await db.transaction(async tx => {
        const message = (await tx.insert(supportTicketMessages).values({ ticketId, authorId: adminId(req), authorType: 'ADMIN', body }).returning())[0];
        const nextStatus = ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status;
        await tx.update(supportTickets).set({ status: nextStatus, assignedAdminId: ticket.assignedAdminId || adminId(req), updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
        await tx.insert(adminAuditLog).values({ adminId: adminId(req), action: 'SUPPORT_TICKET_REPLIED', targetType: 'SUPPORT_TICKET', targetId: ticketId, metadata: { status: nextStatus, messageId: message.id } });
        return message;
      });
      if (ticket.studentId) {
        try {
          const { createNotification } = await import('./services/notificationService');
          await createNotification(ticket.studentId, 'INFO', 'Support reply', `There is a new reply on your support ticket: ${ticket.subject}`);
        } catch {}
      }
      res.json({ ok: true, message: row });
    } catch {
      res.status(500).json({ error: 'Could not send support reply.' });
    }
  };
  app.post('/api/admin/support/:id/reply', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_reply'), supportReplyHandler);
  app.post('/api/admin/owner/support/:id/reply', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_support_reply'), supportReplyHandler);

  // Broadcast and recipient preview share the same server-side audience predicate.
  app.get('/api/admin/owner/notifications/recipients', ...roleRead(['OWNER', 'ADMIN'], 'admin_notification_recipients'), async (req, res) => {
    const scope = String(req.query.scope || 'ALL').toUpperCase();
    const studentId = bodyString(req.query.studentId, 200);
    if (!isBroadcastAudience(scope)) return res.status(400).json({ error: 'Choose a supported notification audience.' });
    if (scope === 'STUDENT' && !studentId) return res.status(400).json({ error: 'Choose a student for this audience.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const condition = getNotificationAudienceCondition(scope, studentId);
      const rows = await db.select({ count: sql<number>`count(*)` }).from(students).where(condition);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, scope, recipients: Number(rows[0]?.count || 0), maximumRecipients: 10000 });
    } catch {
      res.status(500).json({ error: 'Could not calculate the recipient count.' });
    }
  });

  const broadcastNotificationHandler = async (req: Request, res: Response) => {
    const title = bodyString(req.body?.title, 160);
    const message = bodyString(req.body?.message || req.body?.body, 2000);
    const rawScope = String(req.body?.targetAudience || req.body?.scope || 'ALL').toUpperCase();
    const studentId = bodyString(req.body?.studentId, 200) || null;
    const priority = String(req.body?.priority || req.body?.type || 'NORMAL').toUpperCase();
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required.' });
    if (!isBroadcastAudience(rawScope)) return res.status(400).json({ error: 'Unsupported notification audience.' });
    if (rawScope === 'STUDENT' && !studentId) return res.status(400).json({ error: 'Choose a student for this audience.' });
    if (!['NORMAL', 'HIGH', 'URGENT'].includes(priority)) return res.status(400).json({ error: 'Choose a valid announcement priority.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const condition = getNotificationAudienceCondition(rawScope, studentId || undefined);
      const targetRows = await db.select({ id: students.id }).from(students).where(condition).limit(10001);
      if (targetRows.length > 10000) return res.status(413).json({ error: 'This audience has more than 10,000 recipients. Narrow the audience before sending.', code: 'RECIPIENT_LIMIT_EXCEEDED' });
      if (targetRows.length === 0) return res.status(409).json({ error: 'This audience has no recipients. Nothing was sent.' });

      const sentCount = targetRows.length;
      const result = await db.transaction(async (tx) => {
        const campaign = (await tx.insert(notificationCampaigns).values({
          title,
          message,
          type: 'INFO',
          priority,
          targetScope: rawScope,
          targetStudentId: studentId,
          status: 'SENT',
          createdBy: adminId(req),
          sentAt: new Date(),
          sentCount,
        }).returning())[0];
        for (let offset = 0; offset < targetRows.length; offset += 500) {
          const chunk = targetRows.slice(offset, offset + 500);
          if (chunk.length) await tx.insert(notifications).values(chunk.map((target) => ({
            studentId: target.id,
            type: 'INFO',
            title,
            message,
          })));
        }
        await tx.insert(adminAuditLog).values({
          adminId: adminId(req),
          action: 'NOTIFICATION_BROADCAST',
          targetType: 'NOTIFICATION_CAMPAIGN',
          targetId: campaign.id,
          metadata: { scope: rawScope, recipients: sentCount, priority, title },
        });
        return campaign;
      });
      res.json({ ok: true, sent: sentCount, campaign: result });
    } catch {
      res.status(500).json({ error: 'Could not send the announcement. No success was recorded.' });
    }
  };
  app.post('/api/admin/owner/notifications/broadcast', ...roleWrite(['OWNER','ADMIN'], 'admin_notification_broadcast'), broadcastNotificationHandler);
  app.post('/api/admin/owner/notifications', ...roleWrite(['OWNER','ADMIN'], 'admin_notification_broadcast'), broadcastNotificationHandler);

  app.get('/api/admin/owner/notifications', ...roleRead(['OWNER','ADMIN'], 'admin_notifications'), async (_req, res) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Database unavailable.' });
      const campaigns = await db.select().from(notificationCampaigns).orderBy(desc(notificationCampaigns.createdAt)).limit(300);
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.json({ ok: true, campaigns });
    } catch {
      res.status(500).json({ error: 'Failed to load announcement history.' });
    }
  });

  app.get('/api/admin/owner/operations', ...roleRead(['OWNER','ADMIN'], 'admin_operations'), async(_req,res)=>{try{res.json({ok:true,metrics:await getOperationalMetrics()});}catch{res.status(500).json({error:'Failed to load operational metrics.'});}});

  app.post('/api/admin/owner/operations/clear-cache', ...roleWrite(['OWNER','ADMIN'], 'admin_operations_clear_cache'), async (req, res) => {
    try {
      invalidateAcademicContextCache();
      const { invalidatePaymentConfigCache } = await import('./services/paymentService');
      invalidatePaymentConfigCache();
      await logAdminAction(adminId(req), 'CACHE_PURGED', 'SYSTEM', 'operations', {});
      res.json({ ok: true, cleared: true, timestamp: new Date().toISOString() });
    } catch {
      res.json({ ok: true, cleared: true });
    }
  });

  app.get('/api/admin/owner/health', ...roleRead(['OWNER','ADMIN'], 'admin_health'), async(_req,res)=>{try{res.json({ok:true,health:await getOwnerHealth()});}catch{res.status(500).json({error:'Failed to load health information.'});}});

  app.get('/api/admin/owner/security', ...roleRead(['OWNER'], 'admin_security'), async(_req,res)=>{try{res.json({ok:true,security:await getSecuritySummary()});}catch{res.status(500).json({error:'Failed to load security summary.'});}});

  app.post('/api/admin/owner/security/sessions/:id/revoke', ...roleWrite(['OWNER'], 'admin_session_revoke'), async(req,res)=>{ const sid=bodyString(req.params.id,200); if(!sid)return res.status(400).json({error:'Invalid session id.'}); const pool=getDbPool(); if(!pool)return res.status(503).json({error:'Database unavailable.'}); try{const result=await pool.query('DELETE FROM neon_auth.session WHERE id=$1 RETURNING id', [sid]); if(!result.rowCount)return res.status(404).json({error:'Session not found.'}); await logAdminAction(adminId(req),'ADMIN_SESSION_REVOKED','SESSION',sid,{}); res.json({ok:true});}catch{res.status(500).json({error:'Could not revoke session.'});} });

  app.post('/api/admin/owner/students/:id/status', ...roleWrite(['OWNER','ADMIN'], 'admin_student_status'), async (req, res) => {
    const id = bodyString(req.params.id, 200);
    const status = bodyString(req.body?.status, 20);
    const reason = bodyString(req.body?.reason, 500) || null;
    if (!id || !['ACTIVE', 'SUSPENDED'].includes(status || '')) return res.status(400).json({ error: 'Invalid account status.' });
    if (status === 'SUSPENDED' && !reason) return res.status(400).json({ error: 'A reason is required before suspending an account.' });
    if (id === adminId(req)) return res.status(400).json({ error: 'You cannot suspend your own account.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const target = (await db.select({ id: students.id, role: students.role, adminRole: students.adminRole, accountStatus: students.accountStatus })
        .from(students).where(eq(students.id, id)).limit(1))[0];
      if (!target) return res.status(404).json({ error: 'Student not found.' });
      const actorRole = String((req as any).user?.adminRole || (req as any).user?.role || '').toUpperCase();
      const targetRole = String(target.adminRole || target.role || '').toUpperCase();
      if (targetRole !== 'STUDENT' && targetRole !== 'NONE' && actorRole !== 'OWNER') {
        return res.status(403).json({ error: 'Only an Owner can change the status of an administrator account.' });
      }
      if (targetRole === 'OWNER' && status === 'SUSPENDED') {
        const activeOwners = await db.select({ count: sql<number>`count(*)` }).from(students)
          .where(and(eq(students.adminRole, 'OWNER'), eq(students.accountStatus, 'ACTIVE')));
        if (Number(activeOwners[0]?.count || 0) <= 1) return res.status(409).json({ error: 'The last active Owner cannot be suspended.' });
      }
      const rows = await db.update(students).set({
        accountStatus: status,
        suspensionReason: status === 'SUSPENDED' ? reason : null,
        updatedAt: new Date(),
      }).where(eq(students.id, id)).returning({ id: students.id, accountStatus: students.accountStatus });
      await logAdminAction(adminId(req), 'STUDENT_STATUS_CHANGED', 'STUDENT', id, { status, reason, previousStatus: target.accountStatus });
      res.json({ ok: true, student: rows[0] });
    } catch {
      res.status(500).json({ error: 'Could not update student status.' });
    }
  });



  app.get('/api/admin/owner/maintenance', ...roleRead(['OWNER','ADMIN'], 'admin_maintenance'), async(_req,res)=>{try{const db=getDb();if(!db)return res.status(503).json({error:'Database unavailable.'});const row=(await db.select().from(appConfig).limit(1))[0];res.json({ok:true,maintenance:{enabled:Boolean(row?.maintenanceEnabled),message:row?.maintenanceMessage||'',startsAt:row?.maintenanceStartsAt,endAt:row?.maintenanceEndsAt}});}catch{res.status(500).json({error:'Failed to load maintenance state.'});}});

  app.get('/api/admin/owner/analytics', ...roleRead(['OWNER','ADMIN','FINANCE'], 'admin_analytics'), async (req, res) => {
    try {
      const analytics = await getAnalyticsReport(req.query.range);
      res.json({ ok: true, analytics });
    } catch {
      res.status(500).json({ error: 'Failed to load analytics.' });
    }
  });

  // Administrators directory & role management
  const adminsListHandler = async (_req: Request, res: Response) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Database unavailable.' });
      const adminRows = await db.select({
        id: students.id,
        email: students.email,
        displayName: students.displayName,
        role: students.role,
        adminRole: students.adminRole,
        accountStatus: students.accountStatus,
        lastActiveAt: students.lastActiveAt
      }).from(students).where(or(
        eq(students.role, 'ADMIN'),
        eq(students.role, 'OWNER'),
        inArray(students.adminRole, ['OWNER', 'ADMIN', 'FINANCE', 'SUPPORT'])
      )).orderBy(desc(students.lastActiveAt)).limit(500);
      res.json({ ok: true, admins: adminRows });
    } catch {
      res.status(500).json({ error: 'Failed to load administrators.' });
    }
  };
  app.get('/api/admin/owner/admins', ...roleRead(['OWNER', 'ADMIN'], 'admin_admins'), adminsListHandler);
  app.get('/api/admin/owner/administrators', ...roleRead(['OWNER', 'ADMIN'], 'admin_administrators'), adminsListHandler);

  const adminRoleHandler = async (req: Request, res: Response) => {
    const studentId = bodyString(req.params.studentId, 200);
    const role = bodyString(req.body?.role, 20);
    if (!studentId || !['OWNER', 'ADMIN', 'FINANCE', 'SUPPORT', 'NONE'].includes(role || '')) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (studentId === adminId(req) && role === 'NONE') {
      return res.status(400).json({ error: 'You cannot remove your own administrator access.' });
    }
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const current = (await db.select({ id: students.id, email: students.email, role: students.role, adminRole: students.adminRole, accountStatus: students.accountStatus }).from(students).where(eq(students.id, studentId)).limit(1))[0];
      if (!current) return res.status(404).json({ error: 'Student not found.' });
      if (String(current.adminRole) === 'OWNER' && role !== 'OWNER') {
        const owners = await db.select({ count: sql<number>`count(*)` }).from(students).where(eq(students.adminRole, 'OWNER'));
        if (Number(owners[0]?.count || 0) <= 1) return res.status(409).json({ error: 'The last Owner cannot be removed or downgraded.' });
      }
      const appRole = role === 'NONE' ? 'STUDENT' : role === 'OWNER' ? 'OWNER' : 'ADMIN';
      const rows = await db.update(students).set({ role: appRole, adminRole: role, updatedAt: new Date() }).where(eq(students.id, studentId)).returning({ id: students.id, email: students.email, role: students.role, adminRole: students.adminRole });
      await logAdminAction(adminId(req), 'ADMIN_ROLE_CHANGED', 'STUDENT', studentId, { previousRole: current.adminRole, newRole: role, previousAppRole: current.role, newAppRole: appRole });
      res.json({ ok: true, user: rows[0] });
    } catch {
      res.status(500).json({ error: 'Could not change administrator role.' });
    }
  };
  app.post('/api/admin/owner/admins/:studentId/role', ...roleWrite(['OWNER'], 'admin_admin_role', 20), adminRoleHandler);
  app.post('/api/admin/owner/administrators/:studentId/role', ...roleWrite(['OWNER'], 'admin_administrator_role', 20), adminRoleHandler);

  app.get('/api/admin/owner/notifications/campaigns', ...roleRead(['OWNER','ADMIN'], 'admin_notification_campaigns'), async(_req,res)=>{try{const db=getDb();if(!db)return res.status(503).json({error:'Database unavailable.'});res.setHeader('Cache-Control','no-store');res.json({ok:true,campaigns:await db.select().from(notificationCampaigns).orderBy(desc(notificationCampaigns.createdAt)).limit(500)});}catch{res.status(500).json({error:'Failed to load campaigns.'});}});

  app.post('/api/admin/owner/notifications/campaigns', ...roleWrite(['OWNER','ADMIN'], 'admin_notification_campaign_save'), async (req, res) => {
    const title = bodyString(req.body?.title, 160);
    const message = bodyString(req.body?.message, 2000);
    const priority = (bodyString(req.body?.priority, 40) || 'NORMAL').toUpperCase();
    const scope = (bodyString(req.body?.scope, 40) || 'ALL').toUpperCase();
    const studentId = bodyString(req.body?.studentId, 200) || null;
    const status = bodyString(req.body?.status, 20) || 'DRAFT';
    if (!title || !message || !['NORMAL','HIGH','URGENT'].includes(priority) || !['ALL','ACTIVE','VERIFIED','PAID','FREE','EXPIRING','STUDENT'].includes(scope) || !['DRAFT','SCHEDULED','SEND'].includes(status)) {
      return res.status(400).json({ error: 'Invalid notification campaign.' });
    }
    if (scope === 'STUDENT' && !studentId) return res.status(400).json({ error: 'A student is required for a student-targeted campaign.' });
    if (status === 'SCHEDULED' && (!req.body?.scheduledAt || Number.isNaN(Date.parse(req.body.scheduledAt)) || new Date(req.body.scheduledAt).getTime() <= Date.now())) {
      return res.status(400).json({ error: 'Scheduled campaigns require a valid future date/time.' });
    }
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const scheduledAt = req.body?.scheduledAt && !Number.isNaN(Date.parse(req.body.scheduledAt)) ? new Date(req.body.scheduledAt) : null;
      const result = await db.transaction(async (tx) => {
        let targets: Array<{ id: string }> = [];
        if (status === 'SEND') {
          const condition = getNotificationAudienceCondition(scope, studentId || undefined);
          targets = await tx.select({ id: students.id }).from(students).where(condition).limit(10001);
          if (targets.length > 10000) throw new Error('RECIPIENT_LIMIT_EXCEEDED');
          if (targets.length === 0) throw new Error('NO_CAMPAIGN_RECIPIENTS');
        } else if (studentId) {
          const target = (await tx.select({ id: students.id }).from(students).where(eq(students.id, studentId)).limit(1))[0];
          if (!target) throw new Error('TARGET_STUDENT_NOT_FOUND');
        }
        const campaign = (await tx.insert(notificationCampaigns).values({
          title, message, type: 'INFO', priority, targetScope: scope, targetStudentId: studentId,
          status: status === 'SEND' ? 'SENT' : status,
          scheduledAt, processingAt: null, failureReason: null, createdBy: adminId(req), sentAt: status === 'SEND' ? new Date() : null,
          sentCount: targets.length,
        }).returning())[0];
        if (status === 'SEND') {
          for (let offset = 0; offset < targets.length; offset += 500) {
            const chunk = targets.slice(offset, offset + 500);
            if (chunk.length) await tx.insert(notifications).values(chunk.map((target) => ({ studentId: target.id, type: 'INFO', title, message })));
          }
        }
        await tx.insert(adminAuditLog).values({
          adminId: adminId(req), action: 'NOTIFICATION_CAMPAIGN_SAVED', targetType: 'NOTIFICATION_CAMPAIGN',
          targetId: campaign.id, metadata: { scope, status, sentCount: targets.length, priority },
        });
        return campaign;
      });
      res.json({ ok: true, campaign: result, sent: result.sentCount });
    } catch (error: any) {
      if (error?.message === 'RECIPIENT_LIMIT_EXCEEDED') return res.status(413).json({ error: 'This audience has more than 10,000 recipients. Narrow the audience before sending.' });
      if (error?.message === 'TARGET_STUDENT_NOT_FOUND') return res.status(404).json({ error: 'Target student not found.' });
      if (error?.message === 'NO_CAMPAIGN_RECIPIENTS') return res.status(409).json({ error: 'This audience has no recipients. Nothing was sent.' });
      res.status(500).json({ error: 'Could not save the notification campaign.' });
    }
  });

  app.patch('/api/admin/owner/notifications/campaigns/:id', ...roleWrite(['OWNER','ADMIN'], 'admin_notification_campaign_edit'), async (req, res) => {
    const id = bodyString(req.params.id, 200);
    const title = bodyString(req.body?.title, 160);
    const message = bodyString(req.body?.message, 2000);
    const priority = String(req.body?.priority || 'NORMAL').toUpperCase();
    const scope = String(req.body?.scope || 'ALL').toUpperCase();
    const studentId = bodyString(req.body?.studentId, 200) || null;
    const status = String(req.body?.status || 'DRAFT').toUpperCase();
    if (!id || !title || !message || !['NORMAL','HIGH','URGENT'].includes(priority) || !isBroadcastAudience(scope) || !['DRAFT','SCHEDULED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid campaign update. Only drafts and scheduled campaigns can be edited.' });
    }
    const scheduledAt = status === 'SCHEDULED' && req.body?.scheduledAt && !Number.isNaN(Date.parse(req.body.scheduledAt))
      ? new Date(req.body.scheduledAt) : null;
    if (scope === 'STUDENT' && !studentId) return res.status(400).json({ error: 'Choose a student for this audience.' });
    if (status === 'SCHEDULED' && (!scheduledAt || scheduledAt.getTime() <= Date.now())) {
      return res.status(400).json({ error: 'Choose a future date and time for the scheduled campaign.' });
    }
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const updated = await db.update(notificationCampaigns).set({
        title, message, priority, type: 'INFO', targetScope: scope, targetStudentId: studentId,
        status, scheduledAt, processingAt: null, failureReason: null,
      }).where(and(eq(notificationCampaigns.id, id), inArray(notificationCampaigns.status, ['DRAFT','SCHEDULED'])))
        .returning({ id: notificationCampaigns.id, status: notificationCampaigns.status });
      if (!updated.length) return res.status(409).json({ error: 'This campaign is no longer editable. Refresh the history and try again.' });
      await logAdminAction(adminId(req), 'NOTIFICATION_CAMPAIGN_EDITED', 'NOTIFICATION_CAMPAIGN', id, { status, scope, priority });
      res.json({ ok: true, campaign: updated[0] });
    } catch {
      res.status(500).json({ error: 'Could not update this campaign.' });
    }
  });

  app.post('/api/admin/owner/notifications/campaigns/:id/action', ...roleWrite(['OWNER','ADMIN'], 'admin_notification_campaign_action'), async (req, res) => {
    const id = bodyString(req.params.id, 200);
    const action = String(req.body?.action || '').toUpperCase();
    if (!id || !['CANCEL','RETRY','SEND_NOW'].includes(action)) return res.status(400).json({ error: 'Choose a valid campaign action.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      if (action === 'CANCEL') {
        const changed = await db.update(notificationCampaigns).set({ status: 'CANCELLED', scheduledAt: null, processingAt: null, failureReason: null })
          .where(and(eq(notificationCampaigns.id, id), eq(notificationCampaigns.status, 'SCHEDULED')))
          .returning({ id: notificationCampaigns.id });
        if (!changed.length) return res.status(409).json({ error: 'Only a scheduled campaign can be cancelled. It may already be processing.' });
        await logAdminAction(adminId(req), 'NOTIFICATION_CAMPAIGN_CANCELLED', 'NOTIFICATION_CAMPAIGN', id, {});
        return res.json({ ok: true, message: 'Scheduled announcement cancelled.' });
      }

      if (action === 'RETRY') {
        const retryAt = new Date(Date.now() + 10_000);
        const changed = await db.update(notificationCampaigns).set({ status: 'SCHEDULED', scheduledAt: retryAt, processingAt: null, failureReason: null })
          .where(and(eq(notificationCampaigns.id, id), eq(notificationCampaigns.status, 'FAILED')))
          .returning({ id: notificationCampaigns.id });
        if (!changed.length) return res.status(409).json({ error: 'Only a failed campaign can be retried. Refresh the history and try again.' });
        await logAdminAction(adminId(req), 'NOTIFICATION_CAMPAIGN_RETRY_SCHEDULED', 'NOTIFICATION_CAMPAIGN', id, { scheduledAt: retryAt.toISOString() });
        return res.json({ ok: true, message: 'Retry queued. The server will attempt this campaign shortly.' });
      }

      const claimed = await db.update(notificationCampaigns).set({ status: 'PROCESSING', processingAt: new Date(), failureReason: null })
        .where(and(eq(notificationCampaigns.id, id), eq(notificationCampaigns.status, 'DRAFT')))
        .returning({ id: notificationCampaigns.id });
      if (!claimed.length) return res.status(409).json({ error: 'Only a draft can be sent from this action. Refresh the history and try again.' });

      try {
        const delivered = await db.transaction(async (tx) => {
          const campaign = (await tx.select().from(notificationCampaigns)
            .where(and(eq(notificationCampaigns.id, id), eq(notificationCampaigns.status, 'PROCESSING')))
            .for('update').limit(1))[0];
          if (!campaign) throw new Error('CAMPAIGN_CLAIM_LOST');
          const condition = getNotificationAudienceCondition(campaign.targetScope, campaign.targetStudentId || undefined);
          const targets = await tx.select({ id: students.id }).from(students).where(condition).limit(10001);
          if (targets.length > 10000) throw new Error('RECIPIENT_LIMIT_EXCEEDED');
          if (targets.length === 0) throw new Error('NO_CAMPAIGN_RECIPIENTS');
          for (let offset = 0; offset < targets.length; offset += 500) {
            const chunk = targets.slice(offset, offset + 500);
            await tx.insert(notifications).values(chunk.map((target) => ({ studentId: target.id, type: 'INFO', title: campaign.title, message: campaign.message })));
          }
          const updated = (await tx.update(notificationCampaigns).set({ status: 'SENT', sentAt: new Date(), sentCount: targets.length, processingAt: null, failureReason: null })
            .where(and(eq(notificationCampaigns.id, campaign.id), eq(notificationCampaigns.status, 'PROCESSING')))
            .returning({ id: notificationCampaigns.id }));
          if (!updated.length) throw new Error('CAMPAIGN_CLAIM_LOST');
          await tx.insert(adminAuditLog).values({ adminId: adminId(req), action: 'NOTIFICATION_CAMPAIGN_SENT', targetType: 'NOTIFICATION_CAMPAIGN', targetId: campaign.id, metadata: { scope: campaign.targetScope, recipients: targets.length, priority: campaign.priority } });
          return targets.length;
        });
        return res.json({ ok: true, sent: delivered, message: `Announcement sent to ${delivered.toLocaleString()} students.` });
      } catch (error: any) {
        const failureReason = error?.message === 'RECIPIENT_LIMIT_EXCEEDED' ? 'Audience exceeds the 10,000-recipient limit.'
          : error?.message === 'NO_CAMPAIGN_RECIPIENTS' ? 'The audience had no recipients at dispatch time.'
          : 'The campaign could not be delivered. Check service health and retry.';
        await db.update(notificationCampaigns).set({ status: 'FAILED', sentCount: 0, processingAt: null, failureReason })
          .where(and(eq(notificationCampaigns.id, id), eq(notificationCampaigns.status, 'PROCESSING'))).catch(() => {});
        if (error?.message === 'RECIPIENT_LIMIT_EXCEEDED') return res.status(413).json({ error: failureReason });
        if (error?.message === 'NO_CAMPAIGN_RECIPIENTS') return res.status(409).json({ error: failureReason });
        return res.status(500).json({ error: failureReason });
      }
    } catch {
      return res.status(500).json({ error: 'Could not perform the campaign action.' });
    }
  });

  app.put('/api/admin/owner/maintenance', ...roleWrite(['OWNER','ADMIN'], 'admin_maintenance_write'), async(req,res)=>{const db=getDb();if(!db)return res.status(503).json({error:'Database unavailable.'});const enabled=Boolean(req.body?.enabled);const message=bodyString(req.body?.message,500)||null;const parse=(v:any)=>v&&typeof v==='string'&&!Number.isNaN(Date.parse(v))?new Date(v):null;const startsAt=parse(req.body?.startsAt), endsAt=parse(req.body?.endsAt);try{await db.update(appConfig).set({maintenanceEnabled:enabled?1:0,maintenanceMessage:message,maintenanceStartsAt:startsAt,maintenanceEndsAt:endsAt,updatedAt:new Date()}).where(eq(appConfig.id,'singleton'));await logAdminAction(adminId(req),'MAINTENANCE_UPDATED','APP_CONFIG','singleton',{enabled,startsAt,endsAt});res.json({ok:true});}catch{res.status(500).json({error:'Could not update maintenance mode.'});}});

  app.post('/api/admin/entitlements', ...roleWrite(['OWNER','ADMIN','FINANCE'], 'admin_entitlement_create'), async (req, res) => {
    const studentId = bodyString(req.body?.studentId, 200);
    const plan = bodyString(req.body?.plan, 50) || 'CURRENT_TERM';
    const reason = bodyString(req.body?.reason, 500);
    const days = Math.max(1, Math.min(730, Number(req.body?.days) || 120));
    if (!studentId) return res.status(400).json({ error: 'Student ID is required.' });
    if (!reason) return res.status(400).json({ error: 'A reason is required for a manual access grant.' });
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    try {
      const student = (await db.select({ id: students.id, email: students.email }).from(students).where(eq(students.id, studentId)).limit(1))[0];
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      const expiresAt = new Date(Date.now() + days * 86400000);
      const academicContext = await getCurrentAcademicContext();
      const planNormalized = plan.toLowerCase().includes('year') ? 'ACADEMIC_YEAR' : 'CURRENT_TERM';
      const row = (await db.insert(entitlements).values({
        studentId,
        plan: planNormalized,
        academicYear: academicContext.academicYear,
        term: planNormalized === 'CURRENT_TERM' ? academicContext.term : null,
        status: 'ACTIVE',
        productNameSnapshot: planNormalized === 'ACADEMIC_YEAR' ? 'Full Academic Year' : 'Current Term Access',
        amountPaid: 0,
        currency: 'EGP',
        productVersion: 1,
        expiresAt,
        grantedBy: adminId(req),
        grantReason: reason,
        grantType: 'MANUAL'
      }).returning())[0];
      await logAdminAction(adminId(req), 'ENTITLEMENT_GRANTED', 'ENTITLEMENT', row.id, { studentId, plan: planNormalized, days, reason });
      res.json({ ok: true, entitlement: row });
    } catch {
      res.status(500).json({ error: 'Could not grant entitlement.' });
    }
  });

  app.post('/api/admin/owner/entitlements/:id', ...roleWrite(['OWNER','ADMIN','FINANCE'], 'admin_entitlement_manage'), async(req,res)=>{
    const id=bodyString(req.params.id,100); const action=bodyString(req.body?.action,20)||'EXTEND'; const reason=bodyString(req.body?.reason,500)||'Owner action'; const days=Math.max(1,Math.min(3650,Number(req.body?.days)||30)); const db=getDb();if(!db)return res.status(503).json({error:'Database unavailable.'}); if(!id||!['EXTEND','SHORTEN','REVOKE','RESTORE','REPLACE'].includes(action))return res.status(400).json({error:'Invalid entitlement action.'}); try{const current=await db.select().from(entitlements).where(eq(entitlements.id,id)).limit(1);if(!current.length)return res.status(404).json({error:'Entitlement not found.'});const e=current[0] as any;if(String(e.grantType)==='COMPLIMENTARY' && String((req as any).user?.adminRole || (req as any).user?.role)!=='OWNER')return res.status(403).json({error:'Complimentary entitlements require Owner authorization.'});const base=e.expiresAt?new Date(e.expiresAt):new Date(Date.now()+days*86400000);let patch:any={updatedAt:new Date()};if(action==='EXTEND')patch.expiresAt=new Date(base.getTime()+days*86400000);if(action==='SHORTEN')patch.expiresAt=new Date(base.getTime()-days*86400000);if(action==='REVOKE'){patch.status='REVOKED';patch.revokedAt=new Date();patch.revokedBy=adminId(req);patch.revokeReason=reason;}if(action==='RESTORE'){patch.status='ACTIVE';patch.revokedAt=null;patch.revokedBy=null;patch.revokeReason=null;}if(action==='REPLACE'){patch.expiresAt=new Date(Date.now()+days*86400000);patch.status='ACTIVE';patch.grantedBy=adminId(req);patch.grantReason=reason;}const row=await db.update(entitlements).set(patch).where(eq(entitlements.id,id)).returning();await logAdminAction(adminId(req),`ENTITLEMENT_${action}`,'ENTITLEMENT',id,{reason,days});res.json({ok:true,entitlement:row[0]});}catch{res.status(500).json({error:'Could not update entitlement.'});}
  });

  app.post('/api/admin/owner/students/:id/complimentary-access', ...roleWrite(['OWNER'], 'admin_complimentary_access', 20), async(req,res)=>{
    const studentId=bodyString(req.params.id,200); const action=bodyString(req.body?.action,20); const reason=bodyString(req.body?.reason,500)||null;
    if(!studentId||!['GRANT','REVOKE'].includes(action||''))return res.status(400).json({error:'Invalid complimentary access action.'});
    if(action==='GRANT'&&!reason)return res.status(400).json({error:'A reason is required when granting complimentary unlimited access.'});
    const db=getDb();if(!db)return res.status(503).json({error:'Database unavailable.'});
    try{
      const result=await db.transaction(async tx=>{
        const student=(await tx.select({id:students.id,email:students.email,displayName:students.displayName}).from(students).where(eq(students.id,studentId)).limit(1))[0];
        if(!student)throw Object.assign(new Error('Student not found.'),{status:404});
        const active=(await tx.select().from(entitlements).where(and(eq(entitlements.studentId,studentId),eq(entitlements.status,'ACTIVE'),eq(entitlements.grantType,'COMPLIMENTARY'))).limit(1))[0];
        const before=active?{status:active.status,grantType:active.grantType,expiresAt:active.expiresAt}:null;
        if(action==='GRANT'){
          if(active)return {student,entitlement:active,before,after:before,noop:true};
          const inserted=(await tx.insert(entitlements).values({studentId,plan:'ACADEMIC_YEAR',academicYear:'ALL',term:null,status:'ACTIVE',productNameSnapshot:'Complimentary Unlimited',amountPaid:0,currency:'EGP',productVersion:1,expiresAt:null,grantedBy:adminId(req),grantReason:reason,grantType:'COMPLIMENTARY'}).returning())[0];
          await tx.insert(adminAuditLog).values({adminId:adminId(req),action:'COMPLIMENTARY_ACCESS_GRANTED',targetType:'STUDENT',targetId:studentId,metadata:{administrator:adminId(req),targetUserId:studentId,action:'GRANT',timestamp:new Date().toISOString(),previousAccessState:before,newAccessState:{status:'ACTIVE',grantType:'COMPLIMENTARY',expiresAt:null},reason}});
          return {student,entitlement:inserted,before,after:{status:'ACTIVE',grantType:'COMPLIMENTARY',expiresAt:null},noop:false};
        }
        if(!active)return {student,entitlement:null,before:null,after:null,noop:true};
        const revoked=(await tx.update(entitlements).set({status:'REVOKED',revokedAt:new Date(),revokedBy:adminId(req),revokeReason:reason||'Owner revoked complimentary unlimited access'}).where(eq(entitlements.id,active.id)).returning())[0];
        await tx.insert(adminAuditLog).values({adminId:adminId(req),action:'COMPLIMENTARY_ACCESS_REVOKED',targetType:'STUDENT',targetId:studentId,metadata:{administrator:adminId(req),targetUserId:studentId,action:'REVOKE',timestamp:new Date().toISOString(),previousAccessState:before,newAccessState:{status:'REVOKED',grantType:'COMPLIMENTARY'},reason:reason||null}});
        return {student,entitlement:revoked,before,after:{status:'REVOKED',grantType:'COMPLIMENTARY'},noop:false};
      });
      res.json({ok:true,...result});
    }catch(e:any){const status=Number(e?.status)||500;res.status(status).json({error:status===404?'Student not found.':'Could not change complimentary access.'});}
  });

  const studentFreeRunsHandler = async (req: Request, res: Response) => {
    const id = bodyString(req.params.id, 200);
    const reason = bodyString(req.body?.reason, 500);
    const db = getDb(); if (!db) return res.status(503).json({ error: 'Database unavailable.' });
    if (!id) return res.status(400).json({ error: 'Student ID required.' });
    if (!reason) return res.status(400).json({ error: 'A reason is required for free-run allowance changes.' });
    
    // Support { freeRuns: N } from StudentsModule as well as { action, amount }
    const directRuns = req.body?.freeRuns !== undefined ? Number(req.body.freeRuns) : (req.body?.runs !== undefined ? Number(req.body.runs) : null);
    try {
      const row = await db.select({ id: students.id, freeRunsRemaining: students.freeRunsRemaining }).from(students).where(eq(students.id, id)).limit(1);
      if (!row.length) return res.status(404).json({ error: 'Student not found.' });
      
      let nextRuns = directRuns;
      if (nextRuns === null) {
        const action = bodyString(req.body?.action, 20);
        const amount = Math.min(100, Math.max(0, Number(req.body?.amount) || 0));
        const current = Number(row[0].freeRunsRemaining || 0);
        nextRuns = action === 'ADD' ? current + Math.max(1, amount) : action === 'REMOVE' ? Math.max(0, current - Math.max(1, amount)) : action === 'SET' ? amount : Number(req.body?.amount ?? 1);
      }
      nextRuns = Math.max(0, Math.min(100, nextRuns));

      const updated = await db.update(students).set({
        freeRunsRemaining: nextRuns,
        freeRunStatus: nextRuns > 0 ? 'available' : 'used',
        freeRunStartedAt: null,
        freeRunCompletedAt: null,
        updatedAt: new Date(),
      }).where(eq(students.id, id)).returning({ id: students.id, freeRunsRemaining: students.freeRunsRemaining });

      await logAdminAction(adminId(req), 'FREE_RUNS_ADJUSTED', 'STUDENT', id, { previous: row[0].freeRunsRemaining, freeRunsRemaining: updated[0].freeRunsRemaining, reason });
      res.json({ ok: true, freeRunsRemaining: updated[0].freeRunsRemaining });
    } catch {
      res.status(500).json({ error: 'Could not update free-run balance.' });
    }
  };
  app.post('/api/admin/students/:id/runs', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_student_runs', 40), studentFreeRunsHandler);
  app.post('/api/admin/owner/students/:id/free-runs', ...roleWrite(['OWNER','ADMIN','SUPPORT'], 'admin_student_free_runs', 40), studentFreeRunsHandler);

  app.get('/api/admin/owner/export/:kind', ...roleRead(['OWNER', 'ADMIN', 'FINANCE'], 'admin_export_extended', 20), async (req, res, next) => {
    try {
      const kind = bodyString(req.params.kind, 30);
      const format = String(req.query.format || 'csv').toLowerCase();
      const isPreview = req.query.preview === '1';
      const rowLimit = isPreview ? 10 : 20000;
      if (!kind || !['csv', 'json'].includes(format)) return res.status(400).json({ error: 'Choose a supported export dataset and CSV or JSON format.' });
      const role = String((req as any).user?.adminRole || (req as any).user?.role || 'SUPPORT').toUpperCase();
      const allowedRoles: Record<string, string[]> = {
        analytics: ['OWNER', 'ADMIN', 'FINANCE'],
        payments: ['OWNER', 'FINANCE'],
        entitlements: ['OWNER', 'FINANCE'],
        revenue: ['OWNER', 'FINANCE'],
        students: ['OWNER'], audit: ['OWNER'], support: ['OWNER'], usage: ['OWNER'],
        schedules: ['OWNER'], ocr: ['OWNER'],
      };
      if (!allowedRoles[kind]) return res.status(400).json({ error: 'Unsupported export.' });
      if (!allowedRoles[kind].includes(role)) return res.status(403).json({ error: 'Your role cannot export this dataset.' });
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Database unavailable.' });
      let rows: any[] = [];
      switch (kind) {
        case 'students':
          rows = await db.select({ id: students.id, email: students.email, displayName: students.displayName, role: students.role, adminRole: students.adminRole, accountStatus: students.accountStatus, freeRunsRemaining: students.freeRunsRemaining, createdAt: students.createdAt, lastActiveAt: students.lastActiveAt }).from(students).orderBy(desc(students.createdAt)).limit(rowLimit);
          break;
        case 'payments':
          rows = await db.select({ id: paymentSubmissions.id, studentId: paymentSubmissions.studentId, plan: paymentSubmissions.plan, amount: paymentSubmissions.amount, productNameSnapshot: paymentSubmissions.productNameSnapshot, paymentMethod: paymentSubmissions.paymentMethod, academicYear: paymentSubmissions.academicYear, term: paymentSubmissions.term, status: paymentSubmissions.status, createdAt: paymentSubmissions.createdAt, reviewedAt: paymentSubmissions.reviewedAt, refundAmount: paymentSubmissions.refundAmount, refundedAt: paymentSubmissions.refundedAt }).from(paymentSubmissions).orderBy(desc(paymentSubmissions.createdAt)).limit(rowLimit);
          break;
        case 'entitlements':
          rows = await db.select({ id: entitlements.id, studentId: entitlements.studentId, plan: entitlements.plan, academicYear: entitlements.academicYear, term: entitlements.term, status: entitlements.status, amountPaid: entitlements.amountPaid, currency: entitlements.currency, submissionId: entitlements.submissionId, createdAt: entitlements.createdAt, expiresAt: entitlements.expiresAt, revokedAt: entitlements.revokedAt, grantType: entitlements.grantType }).from(entitlements).orderBy(desc(entitlements.createdAt)).limit(rowLimit);
          break;
        case 'audit':
          rows = await db.select({ id: adminAuditLog.id, adminId: adminAuditLog.adminId, action: adminAuditLog.action, targetType: adminAuditLog.targetType, targetId: adminAuditLog.targetId, metadata: adminAuditLog.metadata, timestamp: adminAuditLog.timestamp }).from(adminAuditLog).orderBy(desc(adminAuditLog.timestamp)).limit(rowLimit);
          break;
        case 'support':
          rows = await db.select({ id: supportTickets.id, studentId: supportTickets.studentId, category: supportTickets.category, subject: supportTickets.subject, priority: supportTickets.priority, status: supportTickets.status, assignedAdminId: supportTickets.assignedAdminId, createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt, resolvedAt: supportTickets.resolvedAt }).from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(rowLimit);
          break;
        case 'revenue':
          rows = await db.select({ date: sql<string>`to_char(date_trunc('day', ${paymentSubmissions.createdAt}), 'YYYY-MM-DD')`, approvedSubmissionValue: sql<number>`coalesce(sum(${paymentSubmissions.amount}),0)`, approvedSubmissions: sql<number>`count(*)` }).from(paymentSubmissions).where(eq(paymentSubmissions.status, 'APPROVED')).groupBy(sql`date_trunc('day', ${paymentSubmissions.createdAt})`).orderBy(desc(sql`date_trunc('day', ${paymentSubmissions.createdAt})`)).limit(isPreview ? 10 : 200);
          break;
        case 'usage':
          rows = await db.select({ id: runSessions.id, studentId: runSessions.studentId, accessType: runSessions.accessType, status: runSessions.status, academicYear: runSessions.academicYear, term: runSessions.term, startedAt: runSessions.startedAt, completedAt: runSessions.completedAt, resultCreated: runSessions.resultCreated }).from(runSessions).orderBy(desc(runSessions.startedAt)).limit(rowLimit);
          break;
        case 'schedules':
          rows = await db.select({ id: savedSchedules.id, studentId: savedSchedules.studentId, academicYear: savedSchedules.academicYear, term: savedSchedules.term, createdAt: savedSchedules.createdAt, updatedAt: savedSchedules.updatedAt }).from(savedSchedules).orderBy(desc(savedSchedules.createdAt)).limit(rowLimit);
          break;
        case 'analytics':
          rows = [await getAnalyticsReport(req.query.range)];
          break;
        case 'ocr':
          rows = await db.select({ id: activityAudit.id, studentId: activityAudit.studentId, eventType: activityAudit.eventType, timestamp: activityAudit.timestamp }).from(activityAudit).where(or(ilike(activityAudit.eventType, '%OCR%'), ilike(activityAudit.eventType, '%EXTRACT%'))).orderBy(desc(activityAudit.timestamp)).limit(rowLimit);
          break;
      }

      // The export itself must be logged before data is released to the caller.
      await logAdminAction(adminId(req), isPreview ? 'DATA_EXPORT_PREVIEW' : 'DATA_EXPORT', 'EXPORT', kind, { format, rows: rows.length, preview: isPreview, range: kind === 'analytics' ? normalizeAnalyticsRange(req.query.range) : undefined });
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const filename = `gadwal-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(JSON.stringify(rows));
      }
      const cols = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
      const csvCell = (value: unknown) => {
        let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        // Guard text cells against Excel/Sheets formula execution without modifying numeric columns.
        if (typeof value === 'string' && /^[\t\r ]*[=+@\-]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
      };
      const csv = [cols.map(csvCell).join(','), ...rows.map((row) => cols.map((col) => csvCell(row[col])).join(','))].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(`\uFEFF${csv}`);
    } catch (error) {
      next(error);
    }
  });
}
