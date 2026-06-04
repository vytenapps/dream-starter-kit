import { Database, ExternalLink } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { buttonVariants } from "~/components/ui/button";
import { isSupabaseConfigured } from "~/lib/supabase/config";

const SETUP_GUIDE_URL =
  "https://github.com/vytenapps/dream-starter-kit#fastest-path--vercel-one-click--the-supabase-integration";

/**
 * First-deploy setup nudge, shown above the landing-page hero (and below the
 * header) when the app is still running on placeholder Supabase credentials —
 * i.e. a fresh one-click Vercel deploy before a real project is connected and
 * the app is redeployed. Links to the setup guide and renders nothing once
 * real credentials are configured. Server component: reads a public env var,
 * ships no client JS.
 */
export function SupabaseSetupAlert() {
  if (isSupabaseConfigured()) return null;

  return (
    <div className="container mx-auto px-4 pt-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Database />
        <AlertTitle>Finish setting up your app</AlertTitle>
        <AlertDescription>
          <p>
            This deploy isn’t connected to a Supabase project yet, so sign-in,
            sign-up, and your data won’t work. To complete setup, create a
            Supabase project and connect it, then redeploy.
          </p>
          <a
            href={SETUP_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: "sm", className: "mt-2" })}
          >
            Connect Supabase
            <ExternalLink />
          </a>
        </AlertDescription>
      </Alert>
    </div>
  );
}
