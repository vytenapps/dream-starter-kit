import Link from "next/link";

import { ForgotPasswordForm } from "~/components/forgot-password-form";
import { getAuthSettings } from "~/lib/payload";

export default async function ForgotPasswordPage() {
  const settings = await getAuthSettings();

  // Password reset only makes sense when password sign-in is enabled.
  if (!settings.methods.password) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold">Password sign-in is off</h1>
        <p className="text-muted-foreground text-sm">
          This site doesn&apos;t use passwords. Head back to{" "}
          <Link href="/sign-in" className="text-foreground underline">
            sign in
          </Link>{" "}
          to continue with the available methods.
        </p>
      </div>
    );
  }

  return <ForgotPasswordForm />;
}
