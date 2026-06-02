/**
 * Pure reminder scheduling logic — used by the UI and unit-tested. The
 * process-reminders edge function does the equivalent selection in SQL
 * (status = 'pending' and due_at <= now).
 */
export interface DueReminder {
  status: string;
  due_at: string;
}

export function isReminderDue(reminder: DueReminder, now: Date): boolean {
  return (
    reminder.status === "pending" &&
    new Date(reminder.due_at).getTime() <= now.getTime()
  );
}

export function selectDueReminders<T extends DueReminder>(
  reminders: T[],
  now: Date,
): T[] {
  return reminders.filter((reminder) => isReminderDue(reminder, now));
}
