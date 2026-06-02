// process-reminders — finds due, pending reminders and fires them: creates an
// in-app notification, sends an Expo push (for channel=push), and marks the
// reminder sent. Uses the service role.
//
// Scheduling (not enabled here — wire it in your project):
//   1) Deploy: `supabase functions deploy process-reminders`
//   2) Set the function secret:  supabase secrets set CRON_SECRET=<random>
//   3) Schedule every minute via pg_cron + pg_net (run as a migration):
//        select cron.schedule('process-reminders', '* * * * *', $$
//          select net.http_post(
//            url := 'https://<project-ref>.supabase.co/functions/v1/process-reminders',
//            headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
//          );
//        $$);
//   verify_jwt=false (Stripe-style: no user JWT); the CRON_SECRET check below
//   keeps the endpoint from being triggered by anonymous callers.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  if (!supabaseUrl || !serviceKey || !cronSecret) {
    return new Response("Server misconfigured", { status: 500 });
  }
  if (req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("reminders")
    .select("id, user_id, channel")
    .eq("status", "pending")
    .lte("due_at", nowIso);
  if (error) return new Response(error.message, { status: 500 });

  let processed = 0;
  for (const reminder of due ?? []) {
    await admin.from("notifications").insert({
      user_id: reminder.user_id,
      type: "reminder",
      title: "Reminder",
      body: "You have a reminder due.",
    });

    if (reminder.channel === "push") {
      const { data: tokens } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", reminder.user_id);
      if (tokens && tokens.length > 0) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            tokens.map((t) => ({
              to: t.token,
              title: "Reminder",
              body: "You have a reminder due.",
            })),
          ),
        });
      }
    }

    await admin.from("reminders").update({ status: "sent" }).eq("id", reminder.id);
    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
