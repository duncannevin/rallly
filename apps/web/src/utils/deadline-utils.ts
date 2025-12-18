import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import * as Sentry from "@sentry/nextjs";

dayjs.extend(utc);
dayjs.extend(timezone);

export type DeadlineStatus = "upcoming" | "warning" | "urgent" | "passed";

/**
 * Calculate the deadline status based on hours remaining until deadline.
 * - "upcoming": More than 24 hours remaining
 * - "warning": Between 6 and 24 hours remaining
 * - "urgent": Less than 6 hours remaining
 * - "passed": Deadline has already passed
 */
export function calculateDeadlineStatus(deadline: Date | null): DeadlineStatus | null {
  if (!deadline) {
    return null;
  }

  const now = dayjs();
  const deadlineDate = dayjs(deadline);
  const hoursRemaining = deadlineDate.diff(now, "hour", true);

  if (hoursRemaining < 0) {
    return "passed";
  }
  if (hoursRemaining < 6) {
    return "urgent";
  }
  if (hoursRemaining < 24) {
    return "warning";
  }
  return "upcoming";
}

/**
 * Format deadline for display with timezone conversion.
 * Converts UTC deadline to user's timezone and formats it.
 * Handles edge cases like invalid timezones and DST transitions.
 */
export function formatDeadlineForDisplay(
  deadline: Date | null,
  timeZone: string | null,
): string | null {
  if (!deadline) {
    return null;
  }

  try {
    // Explicitly parse as UTC first since deadline is stored in UTC
    const deadlineDate = dayjs(deadline).utc();
    let formattedDate: string;
    
    if (timeZone) {
      try {
        const tzDate = deadlineDate.tz(timeZone);
        formattedDate = `${tzDate.format("LLL")} ${tzDate.format("z")}`;
      } catch (error) {
        // Handle invalid timezones and DST transition edge cases
        console.warn(
          `[deadline-utils] Error converting deadline to timezone "${timeZone}", falling back to UTC:`,
          error,
        );
        Sentry.captureException(error, {
          tags: {
            component: "deadline-utils",
            function: "formatDeadlineForDisplay",
            errorType: "timezone-conversion",
          },
          extra: {
            timeZone,
            deadline: deadline.toISOString(),
          },
        });
        // Fallback to UTC if conversion fails
        formattedDate = `${deadlineDate.format("LLL")} UTC`;
      }
    } else {
      formattedDate = `${deadlineDate.format("LLL")} UTC`;
    }

    return formattedDate;
  } catch (error) {
    console.error(
      `[deadline-utils] Unexpected error formatting deadline:`,
      error,
    );
    Sentry.captureException(error, {
      tags: {
        component: "deadline-utils",
        function: "formatDeadlineForDisplay",
      },
      extra: {
        deadline: deadline.toISOString(),
        timeZone,
      },
    });
    // Return a safe fallback
    return dayjs(deadline).utc().format("LLL") + " UTC";
  }
}

/**
 * Get hours remaining until deadline.
 */
export function getHoursRemaining(deadline: Date | null): number | null {
  if (!deadline) {
    return null;
  }

  const now = dayjs();
  const deadlineDate = dayjs(deadline);
  const hoursRemaining = deadlineDate.diff(now, "hour", true);

  return hoursRemaining < 0 ? 0 : hoursRemaining;
}

