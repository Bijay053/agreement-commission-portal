import { db } from "./db";
import { eq, and, gte, sql } from "drizzle-orm";
import { agreements, universities, countries, agreementNotifications, agreementTerritories } from "@shared/schema";
import { sendExpiryReminderEmail, sendExpiredAgreementEmail, sendRenewalDelayEmail } from "./email";
import { log } from "./index";

const RECIPIENTS = [
  "au@studyinfocentre.com",
  "info@studyinfocentre.com",
  "partners@studyinfocentre.com",
];

const REMINDER_DAYS = [90, 60, 30, 14, 7];

const PORTAL_BASE_URL = process.env.PORTAL_URL || "https://portal.studyinfocentre.com";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

async function hasRecentNotification(agreementId: number, notificationType: string, withinDays: number): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - withinDays);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agreementNotifications)
    .where(
      and(
        eq(agreementNotifications.agreementId, agreementId),
        eq(agreementNotifications.notificationType, notificationType),
        gte(agreementNotifications.sentDate, since)
      )
    );
  return Number(result.count) > 0;
}

async function logNotification(agreementId: number, providerName: string, notificationType: string, daysBeforeExpiry: number | null) {
  await db.insert(agreementNotifications).values({
    agreementId,
    providerName,
    notificationType,
    daysBeforeExpiry: daysBeforeExpiry,
    status: "sent",
    recipientEmails: RECIPIENTS.join(", "),
  });
}

export async function checkAndSendExpiryNotifications() {
  log("Starting agreement expiry notification check...", "notifications");

  try {
    const allAgreements = await db
      .select({
        id: agreements.id,
        title: agreements.title,
        status: agreements.status,
        startDate: agreements.startDate,
        expiryDate: agreements.expiryDate,
        universityName: universities.name,
        countryName: sql<string>`COALESCE(${countries.name}, 'N/A')`,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .leftJoin(countries, eq(universities.countryId, countries.id))
      .where(
        sql`${agreements.status} IN ('active', 'renewal_in_progress', 'expired')`
      );

    let sentCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const agreement of allAgreements) {
      const expiryDate = new Date(agreement.expiryDate);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const agreementLink = `${PORTAL_BASE_URL}/agreements/${agreement.id}`;

      if (agreement.status === "renewal_in_progress" && daysUntilExpiry < 0) {
        const notificationType = "renewal_delay";
        const alreadySent = await hasRecentNotification(agreement.id, notificationType, 6);
        if (!alreadySent) {
          try {
            await sendRenewalDelayEmail(RECIPIENTS, {
              providerName: agreement.universityName,
              expiryDate: formatDate(agreement.expiryDate),
              agreementLink,
            });
            await logNotification(agreement.id, agreement.universityName, notificationType, daysUntilExpiry);
            sentCount++;
            log(`Sent renewal delay alert for ${agreement.universityName}`, "notifications");
          } catch (err) {
            log(`Failed to send renewal delay email for ${agreement.universityName}: ${err}`, "notifications");
          }
        }
        continue;
      }

      if (daysUntilExpiry < 0 && agreement.status !== "renewal_in_progress") {
        const notificationType = "expired";
        const alreadySent = await hasRecentNotification(agreement.id, notificationType, 6);
        if (!alreadySent) {
          try {
            await sendExpiredAgreementEmail(RECIPIENTS, {
              providerName: agreement.universityName,
              country: agreement.countryName,
              expiryDate: formatDate(agreement.expiryDate),
              agreementLink,
            });
            await logNotification(agreement.id, agreement.universityName, notificationType, daysUntilExpiry);
            sentCount++;
            log(`Sent expired agreement alert for ${agreement.universityName}`, "notifications");
          } catch (err) {
            log(`Failed to send expired email for ${agreement.universityName}: ${err}`, "notifications");
          }
        }
        continue;
      }

      if (daysUntilExpiry >= 0 && agreement.status === "active") {
        let matchedTier: number | null = null;
        for (const tier of REMINDER_DAYS) {
          if (daysUntilExpiry <= tier) {
            matchedTier = tier;
          }
        }

        if (matchedTier !== null) {
          const notificationType = `reminder_${matchedTier}d`;
          const dedupWindow = matchedTier <= 7 ? 6 : matchedTier <= 14 ? 13 : matchedTier <= 30 ? 25 : matchedTier <= 60 ? 28 : 28;
          const alreadySent = await hasRecentNotification(agreement.id, notificationType, dedupWindow);
          if (!alreadySent) {
            try {
              await sendExpiryReminderEmail(RECIPIENTS, {
                providerName: agreement.universityName,
                country: agreement.countryName,
                startDate: formatDate(agreement.startDate),
                expiryDate: formatDate(agreement.expiryDate),
                daysRemaining: daysUntilExpiry,
                currentStatus: "Active",
                agreementLink,
              });
              await logNotification(agreement.id, agreement.universityName, notificationType, daysUntilExpiry);
              sentCount++;
              log(`Sent ${matchedTier}-day reminder for ${agreement.universityName} (${daysUntilExpiry} days remaining)`, "notifications");
            } catch (err) {
              log(`Failed to send reminder email for ${agreement.universityName}: ${err}`, "notifications");
            }
          }
        }
      }
    }

    log(`Agreement notification check complete. Sent ${sentCount} notifications.`, "notifications");
    return sentCount;
  } catch (err) {
    log(`Agreement notification check failed: ${err}`, "notifications");
    throw err;
  }
}

export function startNotificationScheduler() {
  const EIGHT_AM_CHECK_INTERVAL = 60 * 1000;
  let lastRunDate: string | null = null;

  const checkAndRun = () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const hour = now.getHours();

    if (hour >= 8 && lastRunDate !== todayStr) {
      lastRunDate = todayStr;
      checkAndSendExpiryNotifications().catch((err) => {
        log(`Scheduled notification check failed: ${err}`, "notifications");
      });
    }
  };

  checkAndRun();
  setInterval(checkAndRun, EIGHT_AM_CHECK_INTERVAL);
  log("Agreement expiry notification scheduler started (runs daily at 08:00 AM)", "notifications");
}
