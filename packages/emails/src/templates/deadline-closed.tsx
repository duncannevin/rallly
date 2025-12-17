import { Trans } from "react-i18next/TransWithoutContext";

import { EmailLayout } from "../components/email-layout";
import {
  Button,
  Heading,
  Link,
  Text,
} from "../components/styled-components";
import type { EmailContext } from "../types";

export interface DeadlineClosedEmailProps {
  title: string;
  deadline: Date;
  pollUrl: string;
  ctx: EmailContext;
}

export const DeadlineClosedEmail = ({
  title,
  deadline,
  pollUrl,
  ctx,
}: DeadlineClosedEmailProps) => {
  return (
    <EmailLayout
      ctx={ctx}
      preview={ctx.t("deadlineClosedPreview", {
        defaultValue: "Your poll has been automatically closed at the deadline.",
        ns: "emails",
      })}
    >
      <Heading>
        {ctx.t("deadlineClosedHeading", {
          defaultValue: "Poll Closed at Deadline",
          ns: "emails",
        })}
      </Heading>
      <Text>
        <Trans
          i18n={ctx.i18n}
          t={ctx.t}
          i18nKey="deadlineClosedContent"
          ns="emails"
          values={{ title }}
          components={{
            b: <strong />,
          }}
          defaults="Your poll <b>{title}</b> has been automatically closed because the deadline has passed. New votes are no longer being accepted, but existing votes remain visible."
        />
      </Text>
      <Text>
        <Trans
          i18n={ctx.i18n}
          t={ctx.t}
          i18nKey="deadlineClosedDeadline"
          ns="emails"
          values={{
            deadline: deadline.toLocaleString(ctx.i18n.language || "en", {
              dateStyle: "long",
              timeStyle: "short",
            }),
          }}
          defaults="Deadline: {deadline}"
        />
      </Text>
      <Button href={pollUrl}>
        {ctx.t("deadlineClosedButton", {
          defaultValue: "View Poll",
          ns: "emails",
        })}
      </Button>
    </EmailLayout>
  );
};

DeadlineClosedEmail.getSubject = (
  props: DeadlineClosedEmailProps,
  ctx: EmailContext,
) => {
  return ctx.t("deadlineClosedSubject", {
    defaultValue: "Poll Closed: {title}",
    title: props.title,
    ns: "emails",
  });
};

export default DeadlineClosedEmail;

