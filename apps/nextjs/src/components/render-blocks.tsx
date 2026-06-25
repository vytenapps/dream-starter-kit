import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChartBar,
  Check,
  Cloud,
  Code,
  Globe,
  Heart,
  Layers,
  Lock,
  Mail,
  Palette,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";

import type { Media, Page } from "@acme/cms";

import CTA from "~/components/launch-ui/sections/cta";
import FAQ from "~/components/launch-ui/sections/faq";
import Hero from "~/components/launch-ui/sections/hero";
import Items from "~/components/launch-ui/sections/items";
import Logos from "~/components/launch-ui/sections/logos";
import Stats from "~/components/launch-ui/sections/stats";
import { Section } from "~/components/launch-ui/ui/section";
import { CmsRichText } from "~/components/rich-text";

type LayoutBlock = NonNullable<Page["layout"]>[number];

/** Map an upload field value to its resolved URL (null until populated). */
function mediaUrl(
  value: Media | number | null | undefined,
): string | undefined {
  return value && typeof value === "object"
    ? (value.url ?? undefined)
    : undefined;
}

const ICONS: Record<string, LucideIcon> = {
  Rocket,
  Zap,
  ShieldCheck,
  Sparkles,
  Star,
  Heart,
  Globe,
  Code,
  Layers,
  Smartphone,
  Palette,
  Lock,
  Check,
  Cloud,
  Bell,
  Settings,
  Users,
  ChartBar,
  Search,
  Mail,
};

function renderBlock(block: LayoutBlock) {
  switch (block.blockType) {
    case "hero": {
      const srcLight = mediaUrl(block.mockupLight);
      const heroAlt =
        (typeof block.mockupLight === "object" && block.mockupLight?.alt) ||
        block.title;
      return (
        <Hero
          title={block.title}
          description={block.description ?? undefined}
          badgeText={block.badgeText ?? undefined}
          badgeLink={
            block.badgeLinkText && block.badgeLinkHref
              ? { text: block.badgeLinkText, href: block.badgeLinkHref }
              : false
          }
          buttons={
            block.buttons?.length
              ? block.buttons.map((b) => ({
                  text: b.text,
                  href: b.href,
                  variant: b.variant ?? "default",
                }))
              : false
          }
          mockup={
            srcLight
              ? {
                  srcLight,
                  srcDark: mediaUrl(block.mockupDark),
                  alt: heroAlt,
                }
              : false
          }
        />
      );
    }
    case "items":
      return (
        <Items
          title={block.title ?? undefined}
          items={
            block.items?.length
              ? block.items.map((item) => {
                  const Icon = item.icon ? ICONS[item.icon] : undefined;
                  return {
                    title: item.title,
                    description: item.description,
                    tooltip: item.tooltip ?? undefined,
                    icon: Icon ? (
                      <Icon className="size-5 stroke-1" />
                    ) : undefined,
                  };
                })
              : false
          }
        />
      );
    case "logos":
      return (
        <Logos
          title={block.title ?? undefined}
          badgeText={block.badgeText ?? undefined}
          logos={
            block.logos?.length
              ? block.logos.map((logo) => ({
                  name: logo.name,
                  src: mediaUrl(logo.image),
                }))
              : false
          }
        />
      );
    case "stats":
      return (
        <Stats
          items={
            block.items?.length
              ? block.items.map((item) => ({
                  label: item.label ?? undefined,
                  value: item.value,
                  suffix: item.suffix ?? undefined,
                  description: item.description ?? undefined,
                }))
              : false
          }
        />
      );
    case "cta":
      return (
        <CTA
          title={block.title}
          buttons={
            block.buttons?.length
              ? block.buttons.map((b) => ({
                  text: b.text,
                  href: b.href,
                  variant: b.variant ?? "default",
                }))
              : false
          }
        />
      );
    case "faq":
      return (
        <FAQ
          title={block.title ?? undefined}
          items={
            block.items?.length
              ? block.items.map((item) => ({
                  question: item.question,
                  answer: (
                    <p className="text-muted-foreground max-w-[640px] text-balance">
                      {item.answer}
                    </p>
                  ),
                }))
              : false
          }
        />
      );
    case "prose":
      return (
        <Section>
          {/* GRT golden reading measure (grtcalculator.com): ~40rem column at
              the 18px body set by CmsRichText — keeps marketing/legal prose at
              the same readability sweet spot as the collection detail pages. */}
          <div className="mx-auto max-w-[40rem]">
            {block.title && (
              <h2 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                {block.title}
              </h2>
            )}
            <CmsRichText data={block.content} />
          </div>
        </Section>
      );
    default:
      return null;
  }
}

/**
 * Renders a Payload `pages.layout` — the ordered list of Launch UI blocks —
 * mapping each `blockType` to its section component. Used by every public page.
 */
export function RenderBlocks({ blocks }: { blocks?: Page["layout"] }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, index) => (
        <div key={block.id ?? `${block.blockType}-${index}`}>
          {renderBlock(block)}
        </div>
      ))}
    </>
  );
}
