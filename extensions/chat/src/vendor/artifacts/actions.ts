// KIT ADAPTATION (see VENDOR.md): upstream was a "use server" action reading
// the DB directly; the kit fetches the extension's authed suggestions route.
import type { Suggestion } from "../lib/db/schema";
import { API_BASE } from "../lib/constants";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const res = await fetch(`${API_BASE}/suggestions?documentId=${documentId}`);
  if (!res.ok) {
    return [] as Suggestion[];
  }
  return (await res.json()) as Suggestion[];
}
