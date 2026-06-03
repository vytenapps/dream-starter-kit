import { PricingPlans } from "~/components/pricing-plans";
import { SignupForm } from "~/components/signup-form";

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <SignupForm />
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-center text-xs">
          Pro plans, available after sign-up
        </p>
        <PricingPlans />
      </div>
    </div>
  );
}
