// Right-rail plan summary on the checkout page (Bloomberg-style): the selected
// plan's name, headline price, intro/renewal framing and the "What you get"
// bullets. All of it is CMS-driven — pricing/fine-print come from the Payload
// plan via the shared `paywall-copy` composer, the bullets from `plan.features`.
import { Check } from "lucide-react";

import type { ExtBillingPlan } from "@acme/cms";

import type { PlanLite } from "~/lib/paywall-copy";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { buildPlanCopy, cadence, formatPrice } from "~/lib/paywall-copy";

export function PlanSummary({ plan }: { plan: ExtBillingPlan }) {
  const lite = plan as unknown as PlanLite;
  const copy = buildPlanCopy(lite);
  const currency = plan.currency ?? "usd";
  const intro =
    plan.pricingType === "recurring" &&
    plan.introOffer?.enabled &&
    plan.introOffer.introAmount != null
      ? plan.introOffer.introAmount
      : null;
  const bigPrice = formatPrice(intro ?? plan.unitAmount, currency);
  const features = plan.features ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{plan.name}</h2>
          <span className="text-lg font-semibold whitespace-nowrap">
            {bigPrice}
            {plan.pricingType !== "one_time" && intro == null && (
              <span className="text-muted-foreground text-sm font-normal">
                {cadence(lite)}
              </span>
            )}
          </span>
        </div>
        {copy.priceLine && (
          <p className="text-muted-foreground text-sm">{copy.priceLine}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {plan.description && (
          <p className="text-muted-foreground text-sm">{plan.description}</p>
        )}
        {features.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">What you get:</p>
              <ul className="flex flex-col gap-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    <span
                      className={
                        f.included === false
                          ? "text-muted-foreground line-through"
                          : ""
                      }
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
