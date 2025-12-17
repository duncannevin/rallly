"use client";

import { FormField, FormItem, FormLabel, FormMessage } from "@rallly/ui/form";
import { Input } from "@rallly/ui/input";
import { useFormContext } from "react-hook-form";
import dayjs from "dayjs";
import * as React from "react";

import { Trans } from "@/components/trans";
import { useTranslation } from "@/i18n/client";
import { getBrowserTimeZone } from "@/utils/date-time-utils";

import type { PollSettingsFormData } from "./poll-settings";

export interface DeadlineEditPickerProps {
  timeZone?: string;
  existingDeadline?: Date | null;
}

export const DeadlineEditPicker: React.FunctionComponent<
  DeadlineEditPickerProps
> = ({ timeZone, existingDeadline }) => {
  const { t } = useTranslation();
  const form = useFormContext<PollSettingsFormData>();
  const watchDeadline = form.watch("deadline");
  const watchTimeZone = form.watch("timeZone") || timeZone || getBrowserTimeZone();

  const [dateValue, setDateValue] = React.useState("");
  const [timeValue, setTimeValue] = React.useState("");

  // Check if existing deadline has passed
  const deadlineHasPassed = React.useMemo(() => {
    if (!existingDeadline) return false;
    return dayjs(existingDeadline).isBefore(dayjs());
  }, [existingDeadline]);

  React.useEffect(() => {
    if (watchDeadline) {
      let deadlineDate = dayjs(watchDeadline);
      if (watchTimeZone) {
        deadlineDate = deadlineDate.tz(watchTimeZone);
      } else {
        deadlineDate = deadlineDate.utc();
      }
      setDateValue(deadlineDate.format("YYYY-MM-DD"));
      setTimeValue(deadlineDate.format("HH:mm"));
    } else {
      setDateValue("");
      setTimeValue("");
    }
  }, [watchDeadline, watchTimeZone]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (deadlineHasPassed) return;
    const newDate = e.target.value;
    setDateValue(newDate);
    updateDeadline(newDate, timeValue);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (deadlineHasPassed) return;
    const newTime = e.target.value;
    setTimeValue(newTime);
    updateDeadline(dateValue, newTime);
  };

  const updateDeadline = (date: string, time: string) => {
    if (date && time) {
      const dateTimeString = `${date}T${time}`;
      let deadline: dayjs.Dayjs;

      if (watchTimeZone) {
        deadline = dayjs.tz(dateTimeString, watchTimeZone);
      } else {
        deadline = dayjs(dateTimeString);
      }

      form.setValue("deadline", deadline.toISOString(), {
        shouldValidate: true,
      });
    } else if (!date && !time) {
      form.setValue("deadline", null, {
        shouldValidate: true,
      });
    }
  };

  const handleClear = () => {
    if (deadlineHasPassed) return;
    setDateValue("");
    setTimeValue("");
    form.setValue("deadline", null, {
      shouldValidate: true,
    });
  };

  // Format existing deadline for display
  const formattedDeadline = React.useMemo(() => {
    if (!existingDeadline) return null;
    let deadlineDate = dayjs(existingDeadline);
    if (watchTimeZone) {
      deadlineDate = deadlineDate.tz(watchTimeZone);
    } else {
      deadlineDate = deadlineDate.utc();
    }
    return deadlineDate.format("LLL");
  }, [existingDeadline, watchTimeZone]);

  return (
    <FormField
      control={form.control}
      name="deadline"
      rules={{
        validate: (value) => {
          if (!value) return true;
          const deadlineDate = dayjs(value);
          if (!deadlineDate.isAfter(dayjs())) {
            return t("deadlineMustBeInFuture", {
              defaultValue: "Deadline must be in the future",
            });
          }
          return true;
        },
      }}
      render={({ field }) => (
        <FormItem>
          <div>
            <FormLabel className="inline-block" htmlFor="deadline">
              <Trans i18nKey="deadline" defaults="Deadline" />
            </FormLabel>
            <span className="ml-1 text-muted-foreground text-sm">
              <Trans i18nKey="optionalLabel" defaults="(Optional)" />
            </span>
          </div>
          {deadlineHasPassed ? (
            <div className="space-y-2">
              <div className="text-muted-foreground text-sm">
                <Trans
                  i18nKey="deadlinePassed"
                  defaults="Deadline passed: {deadline}"
                  values={{ deadline: formattedDeadline }}
                />
              </div>
              <div className="text-muted-foreground text-xs">
                <Trans
                  i18nKey="deadlineCannotEditPassed"
                  defaults="The deadline has passed and cannot be edited."
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="date"
                id="deadline-date"
                value={dateValue}
                onChange={handleDateChange}
                min={dayjs().format("YYYY-MM-DD")}
                className="flex-1"
                disabled={deadlineHasPassed}
              />
              <Input
                type="time"
                id="deadline-time"
                value={timeValue}
                onChange={handleTimeChange}
                className="flex-1"
                disabled={deadlineHasPassed}
              />
              {watchDeadline && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-muted-foreground hover:text-foreground text-sm"
                  disabled={deadlineHasPassed}
                >
                  <Trans i18nKey="clear" defaults="Clear" />
                </button>
              )}
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

