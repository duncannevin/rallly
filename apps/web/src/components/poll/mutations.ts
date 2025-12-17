import { toast } from "@rallly/ui/sonner";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n/client";
import { usePoll } from "@/components/poll-context";
import { trpc } from "@/trpc/client";
import type { ParticipantForm } from "./types";

export const normalizeVotes = (
  optionIds: string[],
  votes: ParticipantForm["votes"],
) => {
  return optionIds.map((optionId, i) => ({
    optionId,
    type: votes[i]?.type ?? ("no" as const),
  }));
};

export const useEditToken = () => {
  const searchParams = useSearchParams();
  return searchParams.get("token") ?? undefined;
};

export const useAddParticipantMutation = () => {
  const { t } = useTranslation();
  return trpc.polls.participants.add.useMutation({
    onError: (error) => {
      if (error.data?.code === "BAD_REQUEST") {
        if (error.message.startsWith("deadlinePassed:")) {
          const deadline = error.message.split(":")[1];
          toast.error(
            t("deadlinePassedError", {
              defaultValue: "The deadline for this poll has passed",
            }),
            {
              description: t("deadlinePassedErrorDescription", {
                defaultValue: "The deadline was {deadline}. New votes are no longer being accepted.",
                deadline,
              }),
            },
          );
        } else {
          toast.error(error.message);
        }
      }
    },
  });
};

export const useUpdateParticipantMutation = () => {
  const queryClient = trpc.useUtils();
  const { t } = useTranslation();
  return trpc.polls.participants.update.useMutation({
    onSuccess: (participant) => {
      queryClient.polls.participants.list.setData(
        { pollId: participant.pollId },
        (existingParticipants = []) => {
          const newParticipants = [...existingParticipants];

          const index = newParticipants.findIndex(
            ({ id }) => id === participant.id,
          );

          if (index !== -1) {
            newParticipants[index] = participant;
          }

          return newParticipants;
        },
      );
    },
    onError: (error) => {
      if (error.data?.code === "BAD_REQUEST") {
        if (error.message.startsWith("deadlinePassed:")) {
          const deadline = error.message.split(":")[1];
          toast.error(
            t("deadlinePassedError", {
              defaultValue: "The deadline for this poll has passed",
            }),
            {
              description: t("deadlinePassedErrorDescription", {
                defaultValue: "The deadline was {deadline}. New votes are no longer being accepted.",
                deadline,
              }),
            },
          );
        } else {
          toast.error(error.message);
        }
      }
    },
  });
};

export const useDeleteParticipantMutation = () => {
  const queryClient = trpc.useUtils();
  const { poll } = usePoll();
  return trpc.polls.participants.delete.useMutation({
    onMutate: ({ participantId }) => {
      queryClient.polls.participants.list.setData(
        { pollId: poll.id },
        (existingParticipants = []) => {
          return existingParticipants.filter(({ id }) => id !== participantId);
        },
      );
    },
  });
};

export const useUpdatePollMutation = () => {
  const { t } = useTranslation();
  return trpc.polls.update.useMutation({
    onError: (error) => {
      if (error.data?.code === "BAD_REQUEST") {
        if (error.message === "deadlineCannotEditPassed") {
          toast.error(
            t("deadlineCannotEditPassed", {
              defaultValue: "Cannot edit deadline after it has passed",
            }),
          );
        } else if (error.message === "deadlineMustBeInFuture") {
          toast.error(
            t("deadlineMustBeInFuture", {
              defaultValue: "Deadline must be in the future",
            }),
          );
        } else {
          toast.error(error.message);
        }
      }
    },
  });
};
