import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { createClient } from "~/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thanks for your purchase",
  robots: { index: false },
};

/**
 * Post-checkout landing. Signed-in upgraders go straight to the dashboard; guest
 * buyers (who paid before having an account) are told to check their email — the
 * webhook created their Supabase account and sent an invite to set a password,
 * after which they land on the dashboard as a paid subscriber.
 */
export default async function CheckoutReturnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/a?checkout=success");

  return (
    <main className="container mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-24 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Payment received 🎉</CardTitle>
          <CardDescription>
            Check your email to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            We&apos;ve sent a confirmation link to the email you used at
            checkout. Click it to set your password — you&apos;ll then land on
            your dashboard as a paid subscriber.
          </p>
          <p className="text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>{" "}
            and your subscription will be waiting.
          </p>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
