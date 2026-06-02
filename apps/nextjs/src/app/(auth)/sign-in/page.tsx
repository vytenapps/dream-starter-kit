import { Suspense } from "react";

import { LoginForm } from "~/components/login-form";

export default function SignInPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
