import { Suspense } from "react";

import { DashboardOverview } from "~/components/dashboard-overview";

// Suspense: DashboardOverview reads ?checkout= via useSearchParams.
export default function Page() {
  return (
    <Suspense>
      <DashboardOverview />
    </Suspense>
  );
}
