import type { AuthSettings } from "@acme/app";

import { AuthFlow } from "~/components/auth/auth-flow";

export function LoginForm({
  settings,
  appName,
}: {
  settings: AuthSettings;
  appName: string;
}) {
  return <AuthFlow mode="signIn" settings={settings} appName={appName} />;
}
