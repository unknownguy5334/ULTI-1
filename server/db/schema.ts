import { pgTable, text, timestamp, date, integer, jsonb, uuid, pgEnum, customType, index, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const freeRunStatusEnum = pgEnum("free_run_status", ["available", "in-progress", "used"]);
export const termOverrideModeEnum = pgEnum("term_override_mode", ["AUTO", "FALL", "SPRING", "SUMMER"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
export const runStatusEnum = pgEnum("run_status", ["IN_PROGRESS", "SUCCEEDED", "FAILED", "CANCELLED"]);
export const accessStatusEnum = pgEnum("access_status", ["ACTIVE", "REVOKED"]);

export const paymentAdjustmentTypeEnum = pgEnum("payment_adjustment_type", ["CORRECTION", "REFUND", "REVERSAL"]);


export const accountDeletionTombstones = pgTable("account_deletion_tombstones", {
  userIdHash: text("user_id_hash").primaryKey(),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
});

export const students = pgTable("students", {
  id: text("id").primaryKey(), // Neon Auth User ID
  email: text("email").notNull(),
  displayName: text("display_name"),
  role: text("role").notNull().default("STUDENT"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  accountStatus: text("account_status").notNull().default("ACTIVE"),
  suspensionReason: text("suspension_reason"),
  freeRunsRemaining: integer("free_runs_remaining").notNull().default(1),
  adminRole: text("admin_role").notNull().default("NONE"),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  
  freeRunStatus: freeRunStatusEnum("free_run_status").notNull().default("available"),
  freeRunStartedAt: timestamp("free_run_started_at"),
  freeRunCompletedAt: timestamp("free_run_completed_at"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  deletionRequestedAt: timestamp("deletion_requested_at"),
  deletionScheduledFor: timestamp("deletion_scheduled_for"),
}, (table) => ({
  roleIdx: index("students_role_idx").on(table.role),
  lastActiveIdx: index("students_last_active_idx").on(table.lastActiveAt),
}));

export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey(), // e.g., 'singleton'
  termOverrideMode: termOverrideModeEnum("term_override_mode").notNull().default("AUTO"),
  freeRunAllowance: integer("free_run_allowance").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),
  businessLocation: text("business_location"),
  maintenanceEnabled: integer("maintenance_enabled").notNull().default(0),
  maintenanceMessage: text("maintenance_message"),
  maintenanceStartsAt: timestamp("maintenance_starts_at"),
  maintenanceEndsAt: timestamp("maintenance_ends_at"),
  registrationWindows: jsonb("registration_windows").notNull().default({}),
  accessPolicy: jsonb("access_policy").notNull().default({}),
  featureFlags: jsonb("feature_flags").notNull().default({}),
}, (table) => ({
  updatedIdx: index("app_config_updated_idx").on(table.updatedAt),
}));

export const runSessions = pgTable("run_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  accessType: text("access_type").notNull(), // FREE_RUN | PAID
  status: runStatusEnum("status").notNull().default("IN_PROGRESS"),
  academicYear: text("academic_year").notNull(),
  term: text("term").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  resultCreated: integer("result_created").notNull().default(0),
  resultTokenHash: text("result_token_hash"),
}, (table) => ({
  studentStatusIdx: index("run_sessions_student_status_idx").on(table.studentId, table.status),
  studentStartedIdx: index("run_sessions_student_started_idx").on(table.studentId, table.startedAt),
  studentTypeStatusIdx: index("run_sessions_student_type_status_idx").on(table.studentId, table.accessType, table.status),
}));

export const products = pgTable("products", {
  id: text("id").primaryKey(), // CURRENT_TERM | ACADEMIC_YEAR
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("EGP"),
  enabled: integer("enabled").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  version: integer("version").notNull().default(1),
  durationDays: integer("duration_days"),
  accessScope: text("access_scope").notNull().default("REGISTRATION"),
  description: text("description"),
  shortDescription: text("short_description"),
  marketingLabel: text("marketing_label"),
  bestValue: integer("best_value").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  availabilityStart: timestamp("availability_start"),
  availabilityEnd: timestamp("availability_end"),
}, (table) => ({
  enabledIdx: index("products_enabled_idx").on(table.enabled),
}));

export const savedCourses = pgTable("saved_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  courseData: jsonb("course_data").notNull(), // Array of course records
  academicYear: text("academic_year").notNull(),
  term: text("term").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  studentIdx: index("saved_courses_student_idx").on(table.studentId),
  studentContextIdx: index("saved_courses_student_context_idx").on(table.studentId, table.academicYear, table.term),
  studentContextUnique: uniqueIndex("saved_courses_student_context_unique").on(table.studentId, table.academicYear, table.term),
  idStudentUnique: uniqueIndex("saved_courses_id_student_unique").on(table.id, table.studentId),
}));

export const courseSetRevisions = pgTable("course_set_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseSetId: uuid("course_set_id").notNull().references(() => savedCourses.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  courseData: jsonb("course_data").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  courseSetCreatedIdx: index("course_set_revisions_course_set_created_idx").on(table.courseSetId, table.createdAt),
  studentCreatedIdx: index("course_set_revisions_student_created_idx").on(table.studentId, table.createdAt),
  courseSetStudentFk: foreignKey({
    columns: [table.courseSetId, table.studentId],
    foreignColumns: [savedCourses.id, savedCourses.studentId],
    name: "course_set_revisions_course_set_student_fk",
  }),
}));

export const savedSchedules = pgTable("saved_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => runSessions.id, { onDelete: "set null" }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  academicYear: text("academic_year").notNull(),
  term: text("term").notNull(),
  title: text("title"),
  isFavorite: integer("is_favorite").notNull().default(0),
  scheduleData: jsonb("schedule_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  studentCreatedIdx: index("saved_schedules_student_created_idx").on(table.studentId, table.createdAt),
  academicTermIdx: index("saved_schedules_academic_term_idx").on(table.academicYear, table.term),
  studentFavoriteIdx: index("saved_schedules_student_favorite_idx").on(table.studentId, table.isFavorite),
}));

export const activityAudit = pgTable("activity_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  studentTimeIdx: index("activity_audit_student_time_idx").on(table.studentId, table.timestamp),
  eventTimeIdx: index("activity_audit_event_time_idx").on(table.eventType, table.timestamp),
}));

export const paymentMethodsConfig = pgTable("payment_methods_config", {
  id: text("id").primaryKey(), // e.g., 'instapay', 'telda', 'vodafone_cash'
  enabled: integer("enabled").notNull().default(1),
  destination: text("destination").notNull(),
  instructions: text("instructions"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  enabledIdx: index("payment_methods_enabled_idx").on(table.enabled),
}));

export const paymentProofs = pgTable("payment_proofs", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull(), 
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  submissionIdx: index("payment_proofs_submission_idx").on(table.submissionId),
  submissionPairUnique: uniqueIndex("payment_proofs_id_submission_unique").on(table.id, table.submissionId),
  submissionFk: foreignKey({
    columns: [table.submissionId],
    foreignColumns: [paymentSubmissions.id],
    name: "payment_proofs_submission_fk",
  }),
}));

export const paymentSubmissions = pgTable("payment_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(), 
  amount: integer("amount").notNull(),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  productVersion: integer("product_version").notNull().default(1),
  paymentMethod: text("payment_method").notNull(), 
  clientRequestId: text("client_request_id"),
  academicYear: text("academic_year").notNull(),
  term: text("term"), 
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  teldaUsername: text("telda_username"),
  proofId: uuid("proof_id").references(() => paymentProofs.id), 
  status: paymentStatusEnum("payment_status").notNull().default("PENDING"),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"), 
  adminNotes: text("admin_notes"),
  refundAmount: integer("refund_amount").notNull().default(0),
  refundedAt: timestamp("refunded_at"),
  refundedBy: text("refunded_by"),
  refundReason: text("refund_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusCreatedIdx: index("payment_submissions_status_created_idx").on(table.status, table.createdAt),
  studentCreatedIdx: index("payment_submissions_student_created_idx").on(table.studentId, table.createdAt),
  clientRequestIdx: index("payment_submissions_client_request_idx").on(table.clientRequestId),
  proofSubmissionFk: foreignKey({
    columns: [table.proofId, table.id],
    foreignColumns: [paymentProofs.id, paymentProofs.submissionId],
    name: "payment_submissions_proof_submission_fk",
  }),
}));

export const paymentAdjustments = pgTable("payment_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().references(() => paymentSubmissions.id, { onDelete: "cascade" }),
  adminId: text("admin_id").notNull(),
  type: paymentAdjustmentTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  previousAmount: integer("previous_amount"),
  newAmount: integer("new_amount"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  submissionTimeIdx: index("payment_adjustments_submission_time_idx").on(table.submissionId, table.createdAt),
  adminTimeIdx: index("payment_adjustments_admin_time_idx").on(table.adminId, table.createdAt),
}));

export const entitlements = pgTable("entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  academicYear: text("academic_year").notNull(),
  term: text("term"), 
  status: accessStatusEnum("status").notNull().default("ACTIVE"),
  productNameSnapshot: text("product_name_snapshot").notNull().default(""),
  amountPaid: integer("amount_paid").notNull().default(0),
  currency: text("currency").notNull().default("EGP"),
  productVersion: integer("product_version").notNull().default(1),
  submissionId: uuid("submission_id").references(() => paymentSubmissions.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
  revokedBy: text("revoked_by"),
  revokeReason: text("revoke_reason"),
  expiresAt: timestamp("expires_at"),
  grantedBy: text("granted_by"),
  grantReason: text("grant_reason"),
  grantType: text("grant_type").notNull().default("PAID"),
}, (table) => ({
  studentStatusIdx: index("entitlements_student_status_idx").on(table.studentId, table.status),
  studentCreatedIdx: index("entitlements_student_created_idx").on(table.studentId, table.createdAt),
  academicTermStatusIdx: index("entitlements_academic_term_status_idx").on(table.academicYear, table.term, table.status),
}));


export const productPriceHistory = pgTable("product_price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: text("product_id").notNull(),
  oldAmount: integer("old_amount"),
  newAmount: integer("new_amount").notNull(),
  currency: text("currency").notNull().default("EGP"),
  adminId: text("admin_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  productTimeIdx: index("product_price_history_product_time_idx").on(table.productId, table.createdAt),
}));

export const academicPeriods = pgTable("academic_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  academicYear: text("academic_year").notNull(),
  term: text("term").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  registrationStart: date("registration_start"),
  registrationEnd: date("registration_end"),
  accessExpiry: date("access_expiry"),
  enabled: integer("enabled").notNull().default(1),
  notes: text("notes"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  yearTermIdx: uniqueIndex("academic_periods_year_term_idx").on(table.academicYear, table.term),
}));

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").references(() => students.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("NORMAL"),
  status: text("status").notNull().default("OPEN"),
  assignedAdminId: text("assigned_admin_id"),
  internalNotes: text("internal_notes"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  statusTimeIdx: index("support_tickets_status_time_idx").on(table.status, table.createdAt),
  studentTimeIdx: index("support_tickets_student_time_idx").on(table.studentId, table.createdAt),
}));

export const supportTicketMessages = pgTable("support_ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  authorType: text("author_type").notNull().default("ADMIN"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  ticketTimeIdx: index("support_ticket_messages_ticket_time_idx").on(table.ticketId, table.createdAt),
}));

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  adminTimeIdx: index("admin_audit_log_admin_time_idx").on(table.adminId, table.timestamp),
  actionTimeIdx: index("admin_audit_log_action_time_idx").on(table.action, table.timestamp),
}));

export const notificationCampaigns = pgTable("notification_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("INFO"),
  priority: text("priority").notNull().default("NORMAL"),
  targetScope: text("target_scope").notNull().default("ALL"),
  targetStudentId: text("target_student_id"),
  status: text("status").notNull().default("DRAFT"),
  scheduledAt: timestamp("scheduled_at"),
  processingAt: timestamp("processing_at"),
  failureReason: text("failure_reason"),
  createdBy: text("created_by").notNull(),
  sentAt: timestamp("sent_at"),
  sentCount: integer("sent_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("INFO"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  studentCreatedIdx: index("notifications_student_created_idx").on(table.studentId, table.createdAt),
  studentReadIdx: index("notifications_student_read_idx").on(table.studentId, table.readAt),
}));
