"use client";
import { Button } from "@rallly/ui/button";
import { CardFooter } from "@rallly/ui/card";
import { Form } from "@rallly/ui/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import dayjs from "dayjs";

import type { PollSettingsFormData } from "@/components/forms/poll-settings";
import { PollSettingsForm } from "@/components/forms/poll-settings";
import { useUpdatePollMutation } from "@/components/poll/mutations";
import { Trans } from "@/components/trans";
import { usePoll } from "@/contexts/poll";
import { getBrowserTimeZone } from "@/utils/date-time-utils";

const Page = () => {
  const poll = usePoll();

  const router = useRouter();

  const pollLink = `/poll/${poll.id}`;

  const redirectBackToPoll = () => {
    router.push(pollLink);
  };

  const update = useUpdatePollMutation();

  // Convert deadline from UTC to user timezone for display
  const deadlineForForm = poll.deadline
    ? (() => {
        const timeZone = poll.timeZone || getBrowserTimeZone();
        if (timeZone) {
          return dayjs(poll.deadline).utc().tz(timeZone).toISOString();
        }
        return dayjs(poll.deadline).utc().toISOString();
      })()
    : null;

  const form = useForm<PollSettingsFormData>({
    defaultValues: {
      hideParticipants: poll.hideParticipants,
      hideScores: poll.hideScores,
      disableComments: poll.disableComments,
      requireParticipantEmail: poll.requireParticipantEmail,
      deadline: deadlineForForm,
      timeZone: poll.timeZone || getBrowserTimeZone(),
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (data) => {
          //submit
          await update.mutateAsync(
            { urlId: poll.adminUrlId, ...data },
            {
              onSuccess: redirectBackToPoll,
            },
          );
        })}
      >
        <PollSettingsForm
          existingDeadline={poll.deadline}
          timeZone={poll.timeZone || getBrowserTimeZone()}
        >
          <CardFooter className="justify-between">
            <Button asChild>
              <Link href={pollLink}>
                <Trans i18nKey="cancel" />
              </Link>
            </Button>
            <Button type="submit" variant="primary">
              <Trans i18nKey="save" />
            </Button>
          </CardFooter>
        </PollSettingsForm>
      </form>
    </Form>
  );
};

export default Page;
