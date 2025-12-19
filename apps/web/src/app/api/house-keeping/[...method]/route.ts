import { prisma } from "@rallly/database";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { handle } from "hono/vercel";
import dayjs from "dayjs";
import { getEmailClient } from "@/utils/emails";
import { absoluteUrl } from "@rallly/utils/absolute-url";
import * as Sentry from "@sentry/nextjs";

const BATCH_SIZE = 100;

const app = new Hono().basePath("/api/house-keeping");

app.use("*", async (c, next) => {
  // Check if cron jobs are enabled
  if (process.env.ENABLE_CRON_JOBS !== "true") {
    return c.json(
      {
        error: "Cron jobs are disabled. Set ENABLE_CRON_JOBS=true to enable.",
      },
      503,
    );
  }

  if (process.env.CRON_SECRET) {
    return bearerAuth({ token: process.env.CRON_SECRET })(c, next);
  }

  return c.json(
    {
      error: "CRON_SECRET is not set in environment variables",
    },
    500,
  );
});

/**
 * Marks inactive polls as deleted. Polls are inactive if they have not been
 * touched in the last 30 days and all dates are in the past.
 * Only marks polls as deleted if they belong to users without an active subscription
 * or if they don't have a user associated with them.
 */
app.get("/delete-inactive-polls", async (c) => {
  // Define the 30-day threshold once
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Mark inactive polls as deleted in a single query
  const { count: markedDeleted } = await prisma.poll.updateMany({
    where: {
      deleted: false,
      // All poll dates are in the past
      options: {
        none: {
          startTime: { gt: new Date() },
        },
      },
      // We don't delete polls that belong to a space with an active subscription
      OR: [
        { spaceId: null },
        {
          space: {
            tier: {
              not: "pro",
            },
          },
        },
      ],
      // Poll is inactive (not touched AND not viewed in the last 30 days)
      touchedAt: { lt: thirtyDaysAgo },
      views: {
        none: {
          viewedAt: { gte: thirtyDaysAgo },
        },
      },
    },
    data: {
      deleted: true,
      deletedAt: new Date(),
    },
  });

  return c.json({
    success: true,
    summary: {
      markedDeleted,
    },
  });
});

/**
 * Remove polls and corresponding data that have been marked deleted for more than 7 days.
 */
app.get("/remove-deleted-polls", async (c) => {
  // First get the ids of all the polls that have been marked as deleted for at least 7 days
  let totalDeletedPolls = 0;
  let hasMore = true;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  while (hasMore) {
    const batch = await prisma.poll.findMany({
      where: {
        deleted: true,
        deletedAt: {
          lt: sevenDaysAgo,
        },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    const deleted = await prisma.poll.deleteMany({
      where: {
        id: { in: batch.map((poll) => poll.id) },
      },
    });

    totalDeletedPolls += deleted.count;
  }

  return c.json({
    success: true,
    summary: {
      deleted: {
        polls: totalDeletedPolls,
      },
    },
  });
});

/**
 * Closes polls that have passed their deadline. Polls are closed if their
 * deadline <= NOW() AND status = 'live' AND deadline IS NOT NULL.
 * Sends email notifications to poll creators when polls are closed.
 */
app.get("/close-expired-polls", async (c) => {
  const startTime = Date.now();
  let totalClosedPolls = 0;
  let hasMore = true;
  const now = new Date();

  console.log("[close-expired-polls] Starting deadline enforcement job");

  while (hasMore) {
    // Find polls that have passed their deadline and are still live
    const expiredPolls = await prisma.poll.findMany({
      where: {
        deadline: {
          lte: now,
          not: null,
        },
        status: "live",
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        user: {
          select: {
            id: true,
            email: true,
            locale: true,
          },
        },
      },
      take: BATCH_SIZE,
    });

    if (expiredPolls.length === 0) {
      hasMore = false;
      break;
    }

    // Update poll status to paused
    const pollIds = expiredPolls.map((poll) => poll.id);
    await prisma.poll.updateMany({
      where: {
        id: { in: pollIds },
      },
      data: {
        status: "paused",
      },
    });

    console.log(
      `[close-expired-polls] Closed ${expiredPolls.length} polls: ${pollIds.join(", ")}`,
    );

    // Send email notifications to poll creators
    let emailsSent = 0;
    let emailsFailed = 0;
    for (const poll of expiredPolls) {
      if (poll.user?.email) {
        try {
          const emailClient = getEmailClient(poll.user.locale ?? undefined);
          await emailClient.queueTemplate("DeadlineClosedEmail", {
            to: poll.user.email,
            props: {
              title: poll.title,
              deadline: poll.deadline!,
              pollUrl: absoluteUrl(`/poll/${poll.id}`),
            },
          });
          emailsSent++;
          console.log(
            `[close-expired-polls] Sent deadline closed email for poll ${poll.id} to ${poll.user.email}`,
          );
        } catch (error) {
          // Log error but don't block other emails
          emailsFailed++;
          console.error(
            `[close-expired-polls] Failed to send deadline closed email for poll ${poll.id}:`,
            error,
          );
          Sentry.captureException(error, {
            tags: {
              cronJob: "close-expired-polls",
              pollId: poll.id,
            },
            extra: {
              pollTitle: poll.title,
              userEmail: poll.user.email,
            },
          });
        }
      }
    }

    if (emailsFailed > 0) {
      console.warn(
        `[close-expired-polls] Failed to send ${emailsFailed} email(s) out of ${expiredPolls.length} polls`,
      );
    }

    totalClosedPolls += expiredPolls.length;
  }

  const duration = Date.now() - startTime;
  console.log(
    `[close-expired-polls] Completed: closed ${totalClosedPolls} polls in ${duration}ms`,
  );

  return c.json({
    success: true,
    summary: {
      closedCount: totalClosedPolls,
    },
  });
});

/**
 * Sends reminder emails to participants who haven't responded to polls with upcoming deadlines.
 * Reminders are sent at intervals: 24-23 hours, 6-5 hours, and 1-0 hours before the deadline.
 */
app.get("/send-reminder-emails", async (c) => {
  const startTime = Date.now();
  const now = dayjs();
  let totalRemindersSent = 0;
  let totalPollsProcessed = 0;

  console.log("[send-reminder-emails] Starting reminder email job");

  // Define reminder windows: 24h-23h, 6h-5h, 1h-0h before deadline
  const reminderIntervals = [
    {
      type: "twentyFourHours" as const,
      startHours: 24,
      endHours: 23,
    },
    {
      type: "sixHours" as const,
      startHours: 6,
      endHours: 5,
    },
    {
      type: "oneHour" as const,
      startHours: 1,
      endHours: 0,
    },
  ];

  for (const interval of reminderIntervals) {
    const startTime = now.add(interval.startHours, "hour").toDate();
    const endTime = now.add(interval.endHours, "hour").toDate();

    // Find polls with deadlines in this window
    const pollsInWindow = await prisma.poll.findMany({
      where: {
        deadline: {
          gte: endTime,
          lte: startTime,
          not: null,
        },
        status: "live",
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        timeZone: true,
      },
      take: BATCH_SIZE,
    });

    totalPollsProcessed += pollsInWindow.length;

    if (pollsInWindow.length > 0) {
      console.log(
        `[send-reminder-emails] Processing ${pollsInWindow.length} polls in ${interval.type} window`,
      );
    }

    for (const poll of pollsInWindow) {
      try {
        // Find participants who have email addresses and have not voted
        const nonRespondingParticipants = await prisma.participant.findMany({
          where: {
            pollId: poll.id,
            email: {
              not: null,
            },
            deleted: false,
            votes: {
              none: {}, // No votes
            },
            reminders: {
              none: {
                reminderType: interval.type,
              },
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            locale: true,
            timeZone: true,
          },
        });

        if (nonRespondingParticipants.length === 0) {
          continue;
        }

        // Group participants by email address
        const participantsByEmail = new Map<
          string,
          Array<{
            id: string;
            name: string;
            locale: string | null;
            timeZone: string | null;
          }>
        >();

        for (const participant of nonRespondingParticipants) {
          if (!participant.email) continue;

          if (!participantsByEmail.has(participant.email)) {
            participantsByEmail.set(participant.email, []);
          }

          participantsByEmail.get(participant.email)!.push({
            id: participant.id,
            name: participant.name,
            locale: participant.locale,
            timeZone: participant.timeZone,
          });
        }

        // Send reminder email per unique email address
        const reminderRecords: Array<{
          pollId: string;
          participantId: string;
          reminderType: "twentyFourHours" | "sixHours" | "oneHour";
          sentAt: Date;
        }> = [];

        for (const [email, participants] of participantsByEmail) {
          try {
            // Use the first participant's locale/timezone for the email, or poll timezone
            const primaryParticipant = participants[0];
            const emailLocale = primaryParticipant.locale ?? undefined;
            const pollTimeZone = poll.timeZone || primaryParticipant.timeZone || "UTC";

            // Format deadline in the poll's timezone (parse as UTC first since stored in UTC)
            let deadlineDate: dayjs.Dayjs;
            let nowInPollTz: dayjs.Dayjs;
            let hoursRemaining: number;

            try {
              deadlineDate = dayjs(poll.deadline!).utc().tz(pollTimeZone);
              nowInPollTz = dayjs().tz(pollTimeZone);
              hoursRemaining = Math.floor(
                deadlineDate.diff(nowInPollTz, "hour", true),
              );
            } catch (error) {
              // Handle invalid timezones and DST transition edge cases
              console.warn(
                `[send-reminder-emails] Error converting deadline to timezone "${pollTimeZone}" for poll ${poll.id}, falling back to UTC:`,
                error,
              );
              Sentry.captureException(error, {
                tags: {
                  cronJob: "send-reminder-emails",
                  pollId: poll.id,
                  errorType: "timezone-conversion",
                },
                extra: {
                  pollTimeZone,
                  deadline: poll.deadline?.toISOString(),
                },
              });
              // Fallback to UTC calculation
              deadlineDate = dayjs(poll.deadline!).utc();
              nowInPollTz = dayjs().utc();
              hoursRemaining = Math.floor(
                deadlineDate.diff(nowInPollTz, "hour", true),
              );
            }

            // Format time remaining
            let timeRemaining: string;
            if (hoursRemaining >= 24) {
              const days = Math.floor(hoursRemaining / 24);
              const hours = hoursRemaining % 24;
              if (hours > 0) {
                timeRemaining = `${days} day${days > 1 ? "s" : ""} and ${hours} hour${hours > 1 ? "s" : ""}`;
              } else {
                timeRemaining = `${days} day${days > 1 ? "s" : ""}`;
              }
            } else if (hoursRemaining >= 1) {
              timeRemaining = `${hoursRemaining} hour${hoursRemaining > 1 ? "s" : ""}`;
            } else {
              const minutesRemaining = Math.floor(
                deadlineDate.diff(nowInPollTz, "minute", true),
              );
              timeRemaining = `${minutesRemaining} minute${minutesRemaining > 1 ? "s" : ""}`;
            }

            const participantNames = participants.map((p) => p.name);

            // Send email
            const emailClient = getEmailClient(emailLocale);
            await emailClient.queueTemplate("DeadlineReminderEmail", {
              to: email,
              props: {
                title: poll.title,
                deadline: poll.deadline!,
                timeRemaining,
                participantNames,
                pollUrl: absoluteUrl(`/poll/${poll.id}`),
              },
            });

            // Track reminder records to create
            for (const participant of participants) {
              reminderRecords.push({
                pollId: poll.id,
                participantId: participant.id,
                reminderType: interval.type,
                sentAt: new Date(),
              });
            }

            totalRemindersSent++;
            console.log(
              `[send-reminder-emails] Sent ${interval.type} reminder to ${email} for poll ${poll.id}`,
            );
          } catch (error) {
            // Log error but don't block other emails
            console.error(
              `[send-reminder-emails] Failed to send reminder email to ${email} for poll ${poll.id}:`,
              error,
            );
            Sentry.captureException(error, {
              tags: {
                cronJob: "send-reminder-emails",
                pollId: poll.id,
                reminderType: interval.type,
              },
              extra: {
                pollTitle: poll.title,
                email,
              },
            });
          }
        }

        // Create reminder records in batches
        if (reminderRecords.length > 0) {
          await prisma.reminder.createMany({
            data: reminderRecords,
            skipDuplicates: true, // In case of race conditions
          });
        }
      } catch (error) {
        // Log error but continue processing other polls
        console.error(
          `[send-reminder-emails] Failed to process reminders for poll ${poll.id}:`,
          error,
        );
        Sentry.captureException(error, {
          tags: {
            cronJob: "send-reminder-emails",
            pollId: poll.id,
          },
          extra: {
            pollTitle: poll.title,
          },
        });
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(
    `[send-reminder-emails] Completed: sent ${totalRemindersSent} reminders for ${totalPollsProcessed} polls in ${duration}ms`,
  );

  return c.json({
    success: true,
    summary: {
      remindersSent: totalRemindersSent,
      pollsProcessed: totalPollsProcessed,
    },
  });
});

export const GET = handle(app);
