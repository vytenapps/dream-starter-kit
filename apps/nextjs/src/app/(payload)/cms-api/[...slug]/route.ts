/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
/* KIT CUSTOMIZATION (re-apply both if Payload regenerates this file):          */
/*  1. DELETE is wrapped so collection BULK deletes don't fail wholesale when   */
/*     one row is blocked — see ~/lib/cms/resilient-delete.ts.                  */
/*  2. maxDuration is raised: admin-panel saves POST/PATCH through this route,  */
/*     and the generate-images beforeChange hook renders (and, with auditing,   */
/*     re-renders) up to 3 image formats inline while holding the write's DB    */
/*     transaction. On Vercel's default function limit that save is killed      */
/*     mid-flight (edit lost, gateway already billed).                          */
import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

import { resilientCmsDelete } from "~/lib/cms/resilient-delete";

export const maxDuration = 300;

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = resilientCmsDelete(config, REST_DELETE(config));
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
