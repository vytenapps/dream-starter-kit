import type { AuthSettings } from "@acme/app";

import { AuthFlow } from "~/components/auth/auth-flow";

export function SignupForm({
  settings,
  appName,
}: {
  settings: AuthSettings;
  appName: string;
}) {
  return <AuthFlow mode="signUp" settings={settings} appName={appName} />;
}
