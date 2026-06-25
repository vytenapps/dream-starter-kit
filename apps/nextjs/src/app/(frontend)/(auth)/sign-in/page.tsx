import { Suspense } from "react";

import { LoginForm } from "~/components/login-form";
import { getAuthSettings } from "~/lib/payload";

// Brand name shown on the auth screens (kept as the template's "Acme Inc"; the
// GalleryVerticalEnd brand icon is kept in AuthFlow).
const APP_NAME = "Acme Inc";

export default async function SignInPage() {
  const settings = await getAuthSettings();
  return (
    <Suspense>
      <LoginForm settings={settings} appName={APP_NAME} />
    </Suspense>
  );
}
