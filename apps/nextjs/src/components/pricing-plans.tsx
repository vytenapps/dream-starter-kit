import { PLANS } from "@acme/config/constants";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

/**
 * Read-only preview of the Pro plans (shown on the sign-up example). The
 * interactive subscribe flow lives behind auth in the Paywall.
 */
export function PricingPlans() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PLANS.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Pro · {plan.name}
              {"badge" in plan && plan.badge ? (
                <span className="text-muted-foreground"> ({plan.badge})</span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{plan.price}</span>
            <span className="text-muted-foreground text-sm">{plan.cadence}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
