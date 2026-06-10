import { Suspense } from "react";

import { CheckEmailForm } from "~/components/check-email-form";

// Suspense: CheckEmailForm reads ?email= via useSearchParams.
export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailForm />
    </Suspense>
  );
}
