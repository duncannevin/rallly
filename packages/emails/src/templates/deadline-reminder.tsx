import { Trans } from "react-i18next/TransWithoutContext";

import { EmailLayout } from "../components/email-layout";
import {
  Button,
  Heading,
  Link,
  Text,
} from "../components/styled-components";
import type { EmailContext } from "../types";

export interface DeadlineReminderEmailProps {
  title: string;
  deadline: Date;
  timeRemaining: string;
  participantNames: string[];
  pollUrl: string;
  ctx: EmailContext;
}

export const DeadlineReminderEmail = ({
  title,
  deadline,
  timeRemaining,
  participantNames,
  pollUrl,
  ctx,
}: DeadlineReminderEmailProps) => {
  const participantList =
    participantNames.length > 0
      ? participantNames.join(", ")
      : ctx.t("deadlineReminderParticipant", {
          defaultValue: "participant",
          ns: "emails",
        });

  return (
    <EmailLayout
      ctx={ctx}
      preview={ctx.t("deadlineReminderPreview", {
        defaultValue:
          "Don't forget to respond to {title}. The deadline is approaching.",
        title,
        ns: "emails",
      })}
    >
      <Heading>
        {ctx.t("deadlineReminderHeading", {
          defaultValue: "Reminder: Respond to Poll",
          ns: "emails",
        })}
      </Heading>
      <Text>
        <Trans
          i18n={ctx.i18n}
          t={ctx.t}
          i18nKey="deadlineReminderContent"
          ns="emails"
          values={{ title, participantList }}
          components={{
            b: <strong />,
          }}
          defaults="This is a reminder for <b>{participantList}</b> to respond to the poll <b>{title}</b>."
        />
      </Text>
      <Text>
        <Trans
          i18n={ctx.i18n}
          t={ctx.t}
          i18nKey="deadlineReminderDeadline"
          ns="emails"
          values={{
            deadline: deadline.toLocaleString(ctx.i18n.language || "en", {
              dateStyle: "long",
              timeStyle: "short",
            }),
            timeRemaining,
          }}
          defaults="Deadline: {deadline} ({timeRemaining} remaining)"
        />
      </Text>
      <Button href={pollUrl}>
        {ctx.t("deadlineReminderButton", {
          defaultValue: "Respond to Poll",
          ns: "emails",
        })}
      </Button>
    </EmailLayout>
  );
};

DeadlineReminderEmail.getSubject = (
  props: DeadlineReminderEmailProps,
  ctx: EmailContext,
) => {
  return ctx.t("deadlineReminderSubject", {
    defaultValue: "Reminder: Respond to {title}",
    title: props.title,
    ns: "emails",
  });
};

export default DeadlineReminderEmail;

