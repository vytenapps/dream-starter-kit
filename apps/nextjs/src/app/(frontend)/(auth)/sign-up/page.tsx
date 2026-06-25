import { Suspense } from "react";
import Link from "next/link";

import { SignupForm } from "~/components/signup-form";
import { getAuthSettings } from "~/lib/payload";

// Brand name shown on the auth screens (kept as the template's "Acme Inc").
const APP_NAME = "Acme Inc";

export default async function SignUpPage() {
  const settings = await getAuthSettings();

  // Invite-only: public sign-up is gated off. (For hard server enforcement also
  // set enable_signup = false in Supabase — see docs/AUTH.md.)
  if (!settings.allowSignups) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold">Sign-up is invite only</h1>
        <p className="text-muted-foreground text-sm">
          New accounts are currently by invitation. If you have an account,{" "}
          <Link href="/sign-in" className="text-foreground underline">
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <Suspense>
      <SignupForm settings={settings} appName={APP_NAME} />
    </Suspense>
  );
}
