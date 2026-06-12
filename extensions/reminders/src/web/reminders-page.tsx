"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@acme/ui/button";
import { Card, CardHeader, CardTitle } from "@acme/ui/card";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { toast } from "@acme/ui/toast";

import type { CreateReminderInput } from "../index";
import {
  createReminderSchema,
  REMINDER_CHANNELS,
  useCreateReminder,
  useDeleteReminder,
  useReminders,
} from "../index";

export function RemindersPage() {
  const reminders = useReminders();
  const createReminder = useCreateReminder();
  const deleteReminder = useDeleteReminder();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateReminderInput>({
    resolver: standardSchemaResolver(createReminderSchema),
    defaultValues: { dueAt: "", channel: "push" },
  });

  async function onCreate(values: CreateReminderInput) {
    try {
      // datetime-local → ISO
      await createReminder.mutateAsync({
        ...values,
        dueAt: new Date(values.dueAt).toISOString(),
      });
      reset();
      toast.success("Reminder scheduled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <form
        onSubmit={(e) => void handleSubmit(onCreate)(e)}
        className="flex flex-col gap-3"
      >
        <div className="grid gap-2">
          <Label htmlFor="dueAt">When</Label>
          <Input id="dueAt" type="datetime-local" {...register("dueAt")} />
          {errors.dueAt && (
            <p className="text-destructive text-sm">{errors.dueAt.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>Channel</Label>
          <Controller
            control={control}
            name="channel"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <Button type="submit" disabled={createReminder.isPending}>
          {createReminder.isPending ? "Scheduling…" : "Schedule reminder"}
        </Button>
      </form>

      {reminders.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : reminders.data && reminders.data.length > 0 ? (
        <ul className="grid gap-2">
          {reminders.data.map((r) => (
            <li key={r.id}>
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-sm font-normal">
                    {new Date(r.due_at).toLocaleString()} · {r.channel} ·{" "}
                    <span className="text-muted-foreground">{r.status}</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteReminder.mutateAsync(r.id)}
                  >
                    Delete
                  </Button>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No reminders scheduled.</p>
      )}
    </div>
  );
}
