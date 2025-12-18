"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@rallly/ui/tooltip";
import { Icon } from "@rallly/ui/icon";
import { cn } from "@rallly/ui";
import Link from "next/link";
import { ClockIcon } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { OptimizedAvatarImage } from "@/components/optimized-avatar-image";
import { StackedList, StackedListItem } from "@/components/stacked-list";
import { Trans } from "@/components/trans";
import { PollStatusIcon } from "@/features/poll/components/poll-status-icon";
import { formatDeadlineForDisplay, calculateDeadlineStatus } from "@/utils/deadline-utils";
import { useTimezone } from "@/lib/timezone/client/context";
import type { PollStatus } from "../schema";

export const PollList = StackedList;

export function PollListItem({
  title,
  status,
  participants,
  inviteLink,
  pollLink,
  createdBy,
  deadline,
  timeZone,
}: {
  title: string;
  status: PollStatus;
  participants: { id: string; name: string; image?: string }[];
  inviteLink: string;
  pollLink: string;
  createdBy?: { name: string; image?: string };
  deadline?: Date | null;
  timeZone?: string | null;
}) {
  const { timezone } = useTimezone();
  const displayTimeZone = timeZone || timezone;
  const deadlineStatus = deadline ? calculateDeadlineStatus(deadline) : null;
  const formattedDeadline = deadline
    ? formatDeadlineForDisplay(deadline, displayTimeZone)
    : null;

  const getStatusColor = (status: typeof deadlineStatus) => {
    switch (status) {
      case "passed":
        return "text-muted-foreground";
      case "urgent":
        return "text-red-600 dark:text-red-400";
      case "warning":
        return "text-amber-600 dark:text-amber-400";
      case "upcoming":
      default:
        return "text-gray-700 dark:text-gray-300";
    }
  };

  return (
    <StackedListItem>
      <div className="-m-4 relative flex min-w-0 flex-1 items-center gap-2 p-4">
        <PollStatusIcon status={status} showTooltip={false} />
        <div className="min-w-0 flex-1">
          <Link
            className="min-w-0 text-sm hover:underline focus:ring-ring focus-visible:ring-2 block"
            href={pollLink}
          >
            <span className="absolute inset-0" />
            <span className="block truncate">{title}</span>
          </Link>
          {formattedDeadline && (
            <div className="mt-1 flex items-center gap-1.5">
              <Icon>
                <ClockIcon
                  className={cn("h-3 w-3", getStatusColor(deadlineStatus))}
                />
              </Icon>
              <span
                className={cn(
                  "text-xs truncate",
                  getStatusColor(deadlineStatus),
                )}
              >
                {formattedDeadline}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="hidden items-center justify-end gap-4 sm:flex">
        {participants.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-muted-foreground text-sm">
                <Trans
                  i18nKey="participantCount"
                  defaults="{count, plural, =0 {No participants} =1 {1 participant} other {# participants}}"
                  values={{ count: participants.length }}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <ul>
                {participants.slice(0, 10).map((participant) => (
                  <li key={participant.id}>{participant.name}</li>
                ))}
                {participants.length > 10 && (
                  <li>
                    <Trans
                      i18nKey="moreParticipants"
                      values={{ count: participants.length - 10 }}
                      defaults="{count} more…"
                    />
                  </li>
                )}
              </ul>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-sm">
            <Trans
              i18nKey="participantCount"
              defaults="{count, plural, =0 {No participants} =1 {1 participant} other {# participants}}"
              values={{ count: participants.length }}
            />
          </span>
        )}
        {createdBy && (
          <Tooltip>
            <TooltipTrigger>
              <OptimizedAvatarImage
                size="sm"
                name={createdBy.name}
                src={createdBy.image}
              />
            </TooltipTrigger>
            <TooltipContent>{createdBy.name}</TooltipContent>
          </Tooltip>
        )}
        <CopyLinkButton href={inviteLink} />
      </div>
    </StackedListItem>
  );
}
