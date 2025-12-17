import { prisma } from "@rallly/database";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { handle } from "hono/vercel";
import dayjs from "dayjs";
import { getEmailClient } from "@/utils/emails";
import { absoluteUrl } from "@rallly/utils/absolute-url";

const BATCH_SIZE = 100;

const app = new Hono().basePath("/api/house-keeping");

app.use("*", async (c, next) => {
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
  let totalClosedPolls = 0;
  let hasMore = true;
  const now = new Date();

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

    // Send email notifications to poll creators
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
        } catch (error) {
          // Log error but don't block other emails
          console.error(
            `Failed to send deadline closed email for poll ${poll.id}:`,
            error,
          );
        }
      }
    }

    totalClosedPolls += expiredPolls.length;
  }

  return c.json({
    success: true,
    summary: {
      closedCount: totalClosedPolls,
    },
  });
});

export const GET = handle(app);
