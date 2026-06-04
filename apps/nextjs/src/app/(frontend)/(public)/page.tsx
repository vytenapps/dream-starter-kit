import Link from "next/link";

import { APP_NAME } from "@acme/config/constants";

import { PageView } from "~/components/page-view";
import { SupabaseSetupAlert } from "~/components/supabase-setup-alert";
import { buttonVariants } from "~/components/ui/button";
import { getPage } from "~/lib/payload";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const home = await getPage("home").catch(() => null);

  return (
    <>
      {/* First-deploy nudge: shown only while Supabase is unconfigured. */}
      <SupabaseSetupAlert />
      {home ? (
        <PageView page={home} />
      ) : (
        // Fallback when the CMS has no `home` page (e.g. a placeholder-env build).
        <main className="container mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            <span className="text-primary">{APP_NAME}</span> Starter Kit
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg">
            Universal starter kit — Next.js (web) + Expo (iOS/Android) sharing
            one Supabase backend.
          </p>
          <div className="flex gap-3">
            <Link href="/articles" className={buttonVariants()}>
              Read articles
            </Link>
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "outline" })}
            >
              Sign in
            </Link>
          </div>
        </main>
      )}
    </>
  );
}
