import { createClient } from "~/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
        Meet <span className="text-primary">Dream</span>
      </h1>
      <p className="text-muted-foreground max-w-xl text-center text-lg">
        Universal starter kit — Next.js (web) + Expo (iOS/Android) sharing one
        Supabase backend.
      </p>
      <div className="bg-muted rounded-lg px-4 py-3 text-sm">
        {user ? (
          <span>
            Signed in as <strong>{user.email}</strong>
          </span>
        ) : (
          <span className="text-muted-foreground">
            Not signed in — full auth lands in Phase 3.
          </span>
        )}
      </div>
    </main>
  );
}
