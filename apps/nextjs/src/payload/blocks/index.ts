import type { Block } from "payload";

import { CTABlock } from "./CTA";
import { FAQBlock } from "./FAQ";
import { HeroBlock } from "./Hero";
import { ItemsBlock } from "./Items";
import { LogosBlock } from "./Logos";
import { ProseBlock } from "./Prose";
import { StatsBlock } from "./Stats";

/**
 * The Launch UI page-layout blocks, in the order they appear in the admin's
 * "Add block" menu. The `pages.layout` field uses this set, and
 * `~/components/render-blocks` maps each `blockType` to its section component.
 */
export const pageBlocks: Block[] = [
  HeroBlock,
  ItemsBlock,
  LogosBlock,
  StatsBlock,
  CTABlock,
  FAQBlock,
  ProseBlock,
];
