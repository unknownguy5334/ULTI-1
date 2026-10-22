import { getDb } from '../db';
import { notificationCampaigns, notifications, students, adminAuditLog } from '../db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getNotificationAudienceCondition } from './notificationAudience';

const MAX_CAMPAIGN_RECIPIENTS = 10_000;
const CHUNK_SIZE = 500;

/**
 * Claim each due campaign before doing recipient work. The claim is committed separately
 * from delivery so failures remain observable and two workers cannot dispatch the same row.
 */
export async function processScheduledNotificationCampaigns() {
  const db = getDb();
  if (!db) return { processed: 0, sent: 0, failed: 0 };
  // A crashed process can leave an item claimed forever. Expire old claims; the dispatch transaction
  // locks the campaign row before creating notifications, so an in-flight delivery wins atomically.
  await db.update(notificationCampaigns).set({ status: 'FAILED', processingAt: null, failureReason: 'Delivery worker stopped before completing this campaign. It can be retried safely.' })
    .where(and(eq(notificationCampaigns.status, 'PROCESSING'), sql`(${notificationCampaigns.processingAt} IS NULL OR ${notificationCampaigns.processingAt} <= now() - interval '60 minutes')`));

  const due = await db.select({ id: notificationCampaigns.id }).from(notificationCampaigns).where(and(
    eq(notificationCampaigns.status, 'SCHEDULED'),
    sql`${notificationCampaigns.scheduledAt} IS NOT NULL`,
    sql`${notificationCampaigns.scheduledAt} <= now()`,
  )).orderBy(notificationCampaigns.scheduledAt).limit(50);

  let sent = 0;
  let failed = 0;
  let claimedCount = 0;
  for (const candidate of due) {
    const claimed = await db.update(notificationCampaigns).set({ status: 'PROCESSING', processingAt: new Date(), failureReason: null })
      .where(and(eq(notificationCampaigns.id, candidate.id), eq(notificationCampaigns.status, 'SCHEDULED')))
      .returning({ id: notificationCampaigns.id });
    if (!claimed.length) continue;
    claimedCount++;

    try {
      await db.transaction(async (tx) => {
        const campaign = (await tx.select().from(notificationCampaigns)
          .where(and(eq(notificationCampaigns.id, candidate.id), eq(notificationCampaigns.status, 'PROCESSING')))
          .for('update').limit(1))[0];
        if (!campaign) throw new Error('CLAIMED_CAMPAIGN_NOT_FOUND');

        const condition = getNotificationAudienceCondition(campaign.targetScope, campaign.targetStudentId || undefined);
        const targets = await tx.select({ id: students.id }).from(students).where(condition).limit(MAX_CAMPAIGN_RECIPIENTS + 1);
        if (targets.length > MAX_CAMPAIGN_RECIPIENTS) throw new Error('RECIPIENT_LIMIT_EXCEEDED');
        if (targets.length === 0) throw new Error('NO_CAMPAIGN_RECIPIENTS');

        for (let offset = 0; offset < targets.length; offset += CHUNK_SIZE) {
          const chunk = targets.slice(offset, offset + CHUNK_SIZE);
          if (chunk.length) await tx.insert(notifications).values(chunk.map((target) => ({
            studentId: target.id,
            type: 'INFO',
            title: campaign.title,
            message: campaign.message,
          })));
        }
        const sentRows = await tx.update(notificationCampaigns).set({
          status: 'SENT', sentAt: new Date(), sentCount: targets.length, processingAt: null, failureReason: null,
        }).where(and(eq(notificationCampaigns.id, campaign.id), eq(notificationCampaigns.status, 'PROCESSING'))).returning({ id: notificationCampaigns.id });
        if (!sentRows.length) throw new Error('CAMPAIGN_CLAIM_LOST');
        await tx.insert(adminAuditLog).values({
          adminId: campaign.createdBy,
          action: 'NOTIFICATION_CAMPAIGN_SENT',
          targetType: 'NOTIFICATION_CAMPAIGN',
          targetId: campaign.id,
          metadata: { scope: campaign.targetScope, recipients: targets.length, priority: campaign.priority, delivery: 'SCHEDULED' },
        });
      });
      sent++;
    } catch (error: any) {
      failed++;
      // The failed delivery transaction rolls back to PROCESSING, so this state is durable.
      const failureReason = error?.message === 'RECIPIENT_LIMIT_EXCEEDED' ? 'Audience exceeds the 10,000-recipient limit.'
        : error?.message === 'NO_CAMPAIGN_RECIPIENTS' ? 'The audience had no recipients at dispatch time.'
        : 'Delivery failed. Check service health, confirm no messages were sent, then retry.';
      const failedRows = await db.update(notificationCampaigns).set({ status: 'FAILED', sentCount: 0, processingAt: null, failureReason })
        .where(and(eq(notificationCampaigns.id, candidate.id), eq(notificationCampaigns.status, 'PROCESSING')))
        .returning({ id: notificationCampaigns.id, createdBy: notificationCampaigns.createdBy, targetScope: notificationCampaigns.targetScope })
        .catch(() => [] as Array<{ id: string; createdBy: string; targetScope: string }>);
      if (failedRows[0]) {
        await db.insert(adminAuditLog).values({
          adminId: failedRows[0].createdBy,
          action: 'NOTIFICATION_CAMPAIGN_FAILED',
          targetType: 'NOTIFICATION_CAMPAIGN',
          targetId: failedRows[0].id,
          metadata: { scope: failedRows[0].targetScope, reason: failureReason },
        }).catch(() => {});
      }
    }
  }
  return { processed: claimedCount, sent, failed };
}

export function startNotificationCampaignProcessor() {
  void processScheduledNotificationCampaigns();
  return setInterval(() => { void processScheduledNotificationCampaigns(); }, 30_000);
}
