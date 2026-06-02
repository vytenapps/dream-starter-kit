import Link from "next/link";

import { buttonVariants } from "~/components/ui/button";
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

      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-muted-foreground text-sm">
            Signed in as{" "}
            <strong className="text-foreground">{user.email}</strong>
          </p>
          <Link href="/dashboard" className={buttonVariants()}>
            Go to your dashboard
          </Link>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link href="/sign-in" className={buttonVariants()}>
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: "outline" })}
          >
            Create account
          </Link>
        </div>
      )}
    </main>
  );
}
