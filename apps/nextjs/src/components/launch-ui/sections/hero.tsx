import { ArrowRightIcon } from "lucide-react";

import { cn } from "@acme/ui";

import type { LinkButtonProps } from "../ui/link-button";
import { Badge } from "../ui/badge";
import Glow from "../ui/glow";
import { LinkButton } from "../ui/link-button";
import { Mockup, MockupFrame } from "../ui/mockup";
import Screenshot from "../ui/screenshot";
import { Section } from "../ui/section";

export interface HeroButton extends Omit<LinkButtonProps, "children"> {
  text: string;
}

export interface HeroMockup {
  srcLight: string;
  srcDark?: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface HeroProps {
  title?: string;
  description?: string;
  badgeText?: string;
  badgeLink?: { text: string; href: string } | false;
  buttons?: HeroButton[] | false;
  mockup?: HeroMockup | false;
  className?: string;
}

export default function Hero({
  title = "Give your big idea the design it deserves",
  description = "A clone-and-ship starter for web and mobile, sharing one backend — auth, payments, AI and content built in.",
  badgeText,
  badgeLink = false,
  buttons = false,
  mockup = false,
  className,
}: HeroProps) {
  return (
    <Section
      className={cn(
        "fade-bottom overflow-hidden pb-0 sm:pb-0 md:pb-0",
        className,
      )}
    >
      <div className="max-w-container mx-auto flex flex-col gap-12 pt-16 sm:gap-24">
        <div className="flex flex-col items-center gap-6 text-center sm:gap-12">
          {(badgeText || badgeLink) && (
            <Badge variant="outline" className="animate-appear gap-2">
              {badgeText && (
                <span className="text-muted-foreground">{badgeText}</span>
              )}
              {badgeLink && (
                <a href={badgeLink.href} className="flex items-center gap-1">
                  {badgeLink.text}
                  <ArrowRightIcon className="size-3" />
                </a>
              )}
            </Badge>
          )}
          <h1 className="animate-appear from-foreground to-foreground dark:to-muted-foreground relative z-10 inline-block bg-linear-to-r bg-clip-text text-4xl leading-tight font-semibold text-balance text-transparent drop-shadow-2xl sm:text-6xl sm:leading-tight md:text-8xl md:leading-tight">
            {title}
          </h1>
          <p className="text-md animate-appear text-muted-foreground relative z-10 max-w-[740px] font-medium text-balance opacity-0 delay-100 sm:text-xl">
            {description}
          </p>
          {buttons !== false && buttons.length > 0 && (
            <div className="animate-appear relative z-10 flex justify-center gap-4 opacity-0 delay-300">
              {buttons.map((button) => (
                <LinkButton
                  key={`${button.href}-${button.text}`}
                  variant={button.variant ?? "default"}
                  size="lg"
                  href={button.href}
                  icon={button.icon}
                  iconRight={button.iconRight}
                >
                  {button.text}
                </LinkButton>
              ))}
            </div>
          )}
          {mockup !== false && (
            <div className="relative w-full pt-12">
              <MockupFrame
                className="animate-appear opacity-0 delay-700"
                size="small"
              >
                <Mockup
                  type="responsive"
                  className="bg-background/90 w-full rounded-xl border-0"
                >
                  <Screenshot
                    srcLight={mockup.srcLight}
                    srcDark={mockup.srcDark}
                    alt={mockup.alt}
                    width={mockup.width ?? 1248}
                    height={mockup.height ?? 765}
                    className="w-full"
                  />
                </Mockup>
              </MockupFrame>
              <Glow
                variant="top"
                className="animate-appear-zoom opacity-0 delay-1000"
              />
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
