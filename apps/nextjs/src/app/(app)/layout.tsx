import { redirect } from "next/navigation";

import { createClient } from "~/lib/supabase/server";

/**
 * Server-side guard for the authenticated area (belt-and-suspenders with
 * middleware). Anything under (app) requires a session.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  return <>{children}</>;
}
