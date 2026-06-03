import { SupabaseConfigBanner } from "~/components/supabase-config-banner";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <SupabaseConfigBanner />
        {children}
      </div>
    </main>
  );
}
