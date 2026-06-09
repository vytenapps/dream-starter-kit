import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/** Exit draft mode and return to the home page. */
export async function GET() {
  const draft = await draftMode();
  draft.disable();
  redirect("/");
}
