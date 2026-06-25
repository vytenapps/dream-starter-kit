import { RichText } from "@payloadcms/richtext-lexical/react";

/**
 * Renders a Payload Lexical rich-text value. Accepts the field value as-is
 * (the generated type is the serialized editor state); returns null when empty.
 */
export function CmsRichText({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  return (
    <div className="space-y-4 text-lg leading-[1.72]">
      <RichText data={data as React.ComponentProps<typeof RichText>["data"]} />
    </div>
  );
}
