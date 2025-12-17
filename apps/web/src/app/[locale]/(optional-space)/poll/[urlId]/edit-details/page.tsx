"use client";
import { Button } from "@rallly/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@rallly/ui/card";
import { Form } from "@rallly/ui/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import dayjs from "dayjs";

import type { PollDetailsData } from "@/components/forms/poll-details-form";
import { PollDetailsForm } from "@/components/forms/poll-details-form";
import { useUpdatePollMutation } from "@/components/poll/mutations";
import { usePoll } from "@/components/poll-context";
import { Trans } from "@/components/trans";
import { getBrowserTimeZone } from "@/utils/date-time-utils";

const Page = () => {
  const { poll } = usePoll();
  const urlId = poll.adminUrlId;
  const { mutate: updatePollMutation, isPending: isUpdating } =
    useUpdatePollMutation();
  const router = useRouter();

  const pollLink = `/poll/${poll.id}`;

  const redirectBackToPoll = () => {
    router.push(pollLink);
  };

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

  const timeZone = poll.timeZone || getBrowserTimeZone();

  const form = useForm<PollDetailsData & { timeZone?: string }>({
    defaultValues: {
      title: poll.title,
      location: poll.location ?? "",
      description: poll.description ?? "",
      deadline: deadlineForForm,
      timeZone,
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          //submit
          updatePollMutation(
            { urlId, ...data },
            { onSuccess: redirectBackToPoll },
          );
        })}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans i18nKey="editDetails" defaults="Edit details" />
            </CardTitle>
            <CardDescription>
              <Trans
                i18nKey="editDetailsDescription"
                defaults="Change the details of your event."
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PollDetailsForm timeZone={timeZone} existingDeadline={poll.deadline} />
          </CardContent>
          <CardFooter className="justify-between">
            <Button asChild>
              <Link href={pollLink}>
                <Trans i18nKey="cancel" />
              </Link>
            </Button>
            <Button type="submit" loading={isUpdating} variant="primary">
              <Trans i18nKey="save" />
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
};

export default Page;
