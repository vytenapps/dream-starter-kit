# CMS reference — Payload collections, fields & access

The structure reference for the kit's Payload CMS: every collection and global,
its purpose, key fields, and access rules. For how the CMS fits the overall
architecture (schema isolation, SSO bridge, runtime provisioning) see
[`ARCHITECTURE.md` § 4.10](./ARCHITECTURE.md); for how to **add** a content type
see the recipe in [`CLAUDE.md`](../CLAUDE.md#how-to-add-a-payload-content-type).

- **Admin UI:** `/admin` · **REST API:** `/cms-api` · **Local API:** `getPayload()`
  (server-only, used by public RSC pages)
- **Bulk delete is resilient:** Payload's stock `DELETE /cms-api/<collection>`
  runs every selected row's delete in ONE transaction, so a single blocked row
  (a foreign-key reference, a throwing hook) aborts the batch and the admin
  reports "Unable to delete N out of N" with nothing removed. The kit wraps that
  one route (`lib/cms/resilient-delete.ts`, applied in the generated
  `cms-api/[...slug]/route.ts`) to delete transaction-free, so the deletable
  rows are removed and only the genuinely-blocked ones error. Global
  transactions stay on for every other write
- **Document locking is disabled** CMS-wide (`lib/cms/no-document-lock.ts`,
  mapped over every collection + global in `payload.config.ts`). Payload's
  lock check (`checkDocumentLockStatus`) runs a **req-less** query on every
  save/delete, which checks out a second pool connection inside the operation's
  transaction — on the small serverless pool that starves and the save 500s
  ("Failed query: … payload_locked_documents …"). The trade-off is no
  "another user is editing this document" warning
- **Storage:** all collections live in the dedicated **`cms` Postgres schema**
  (least-privilege `payload_cms` role); media binaries go to the public-read
  `cms-media` Supabase Storage bucket via the S3 adapter
- **Config:** `apps/nextjs/src/payload.config.ts`; collections in
  `apps/nextjs/src/payload/collections/`, globals in `payload/globals/`
- **Types:** generated into `packages/cms` (`@acme/cms`) by `pnpm cms:gen-types`;
  schema changes need a committed migration (`pnpm cms:migrate:create`)
- **Plugins:** SEO (posts/videos/audio/photos/pages/events/locations/series),
  Nested Docs (categories, pages, space-groups), Form Builder (forms +
  form-submissions), Stripe (signature-verified webhook only), S3 storage

## Auth & roles

There is **one** login — Supabase. Payload's local strategy is disabled;
`payload/auth/supabase-strategy.ts` authenticates every CMS request from the
caller's Supabase session and JIT-provisions a `cms.users` row (linked by
`supabaseUserId`).

- `users.roles[]` (WordPress-style): **admin** (everything, incl. Users/roles and
  Commerce), **editor** (staff: content + moderation), **author** (may enter
  `/admin`), **member** (app user; no admin access).
- Every app signup is mirrored in as a `member` (`lib/cms/mirror-user.ts`); only
  users with `profiles.is_staff = true` pass the SSO bridge — **the CMS API is
  staff-only today** (member-scoped collections already carry owner-scoped rules
  for the documented member-auth follow-up).
- The **first signup** is auto-flagged staff (DB trigger) and JIT-provisioned
  `admin`. Further staff are invited from `/admin → Users → Create New`
  (`payload/hooks/invite-user.ts` sends a Supabase invite + flags `is_staff`).
- Users are **soft-deleted** (`trash: true`); the bridge rejects trashed rows —
  restore from the admin Trash view.

## Access helpers (`payload/access/index.ts`)

| Helper                                  | Rule                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| `anyone`                                | Always allowed (public read)                                 |
| `isAdmin`                               | `roles` contains `admin`                                     |
| `isStaff`                               | `admin` or `editor`                                          |
| `canAccessAdmin`                        | `admin`, `editor`, or `author` may open `/admin`             |
| `isAdminOrSelf`                         | Admins: all rows; others: only `id == user.id`               |
| `ownsOrStaff(field)`                    | Staff: all rows; others: rows where `field == user.id`       |
| `publishedOrStaff`                      | Public: `_status == published`; staff: all (needs drafts)    |
| `approvedOrStaff`                       | Public: `status == approved`; staff: all (moderated content) |
| `staffFieldAccess` / `adminFieldAccess` | Field-level: staff-only / admin-only writes                  |

## Reusable field helpers (`payload/fields/`)

| Helper                           | Adds                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `slugField(from = "title")`      | Required unique indexed `slug`, auto-derived but editable                                                      |
| `accessLevelField()`             | Sidebar select `accessLevel`: `public` / `members` / `premium`                                                 |
| `commentsEnabledField(default?)` | Sidebar checkbox gating the shared `comments` system                                                           |
| `linkField(name?, opts?)`        | Group: `url` + `newTab` (± `label`, `appearance`)                                                              |
| `destinationField(name?)`        | Deep-link group: internal doc (pages/posts/videos/audio/series/events/locations) \| app screen \| external URL |

## Shared collection hooks (`payload/hooks/`)

| Hook                                            | Effect                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `assignOwner(field)`                            | Forces the owner field to the requesting user on create (staff/Local API may override)                                                |
| `requireCommentsEnabled`                        | Rejects comments whose target has `commentsEnabled: false`                                                                            |
| `uniquePolymorphic(...)`                        | One row per owner + polymorphic target (favorites, open reports)                                                                      |
| `incrementReportCount`                          | Denormalizes `reportCount` onto the reported doc                                                                                      |
| `invite-user`                                   | On staff-created Users rows: Supabase invite email + `is_staff` flag                                                                  |
| `sync-plan-to-stripe` / `sync-coupon-to-stripe` | afterChange → create/update Stripe product, **recreate + archive** immutable prices/coupons; status lands on `syncStatus`/`syncError` |
| `validate-custom-fields`                        | Validates `users.customFields` against the `profile-fields` global                                                                    |

---

## Content group

### `posts` — editorial blog posts

Long-form articles with drafts + scheduled publishing. **Fields:** `title`\*,
`slug`, `excerpt`, `body` (richText), `featuredImage`/`cardImage`/`gallery`
(media), `author` + `coAuthors` (users), `categories`, `tags`, `relatedPosts`,
virtual `readingTime`/`authorName`, `accessLevel`, `featured`,
`commentsEnabled`, `publishedAt`, join `comments`. **Access:** read
`publishedOrStaff`; write `isStaff`. Drafts (max 25) · live preview · trash ·
folders.

### `videos` — landscape videos & vertical shorts

One collection, discriminated by `orientation` (`landscape`/`vertical`) and
`sourceType` (`url`/`upload`/`mux`/`youtube`/`vimeo`). **Fields:** `title`\*,
`slug`, `description`, `body`, `aspectRatio`, conditional `url`/`videoFile`,
`thumbnail` + `verticalThumbnail` + `previewClip`, `duration`, `captions[]`,
`chapters[]`, `series` + `episodeNumber`/`seasonNumber`, `categories`, `tags`,
`accessLevel`, `featured`, `commentsEnabled`, `publishedAt`. **Access:** read
`publishedOrStaff`; write `isStaff`. Drafts · trash · folders.

### `audio` — podcast/audio episodes (upload collection)

The row **is** the audio file (S3); RSS-ready. **Fields:** `title`_, `slug`,
unique `guid`, `subtitle`, `description`, `body` (show notes), `coverArt`,
`duration`, `episodeNumber`/`seasonNumber`, `episodeType`
(`full`/`trailer`/`bonus`), `explicit`, `transcript` + `transcriptFile`,
`chapters[]`, `soundbites[]`, `series` (podcast shows), `itunesBlock`,
`categories`, `tags`, `accessLevel`, `featured`, `commentsEnabled`,
`publishedAt`. **Access:** read `anyone` (no drafts — filter by
`publishedAt`/`accessLevel`; premium episodes are served via `feed-tokens`);
write `isStaff`. Upload `audio/_` · trash · folders.

### `photos` — photo content section (upload collection)

The row **is** the image (distinct from general `media`); albums via `series`
(`kind: album`). **Fields:** `title`_, `slug`, `caption`, `altText`, `credit`,
`takenAt`, `location`, `album`, `categories`, `tags`, `accessLevel`,
`featured`, `commentsEnabled`, `publishedAt`. **Access:** read `anyone`; write
`isStaff`. Upload `image/_` (thumbnail/card/hero sizes, focal point) · trash ·
folders.

### `series` — series, seasons, playlists, albums, podcast shows, courses

Groups episodic media, discriminated by `kind`
(`series`/`season`/`playlist`/`album`/`podcast`/`course`). **Fields:** `title`_,
`slug`, `kind`_, `description`, `coverArt`/`featuredImage`, `parentSeries`,
`categories`, `tags`, `accessLevel`, `requiredPlans` (premium gating),
`displayOrder`, `featured`; conditional **`podcast` group** (full channel-level
RSS metadata: iTunes author/owner/category, artwork, `podcastGuid`, funding,
`isPrivate` members-only feed, …) and **`course` group** (`instructors`,
`dripEnabled` + `dripAnchor`, `certificateOnComplete`, `estimatedHours`); joins
`videoEpisodes`/`audioEpisodes`/`lessons`. **Access:** read `publishedOrStaff`;
write `isStaff`. Drafts · trash · folders.

### `lessons` — course lessons with drip release

Belong to a `series` of `kind: course`. **Fields:** `title`_, `slug`, `course`_,
`module`, `order`, `content` (richText), `video`/`audio` refs, `attachments`,
`duration`, `preview` (free preview bypasses gating), `dripType`
(`none`/`scheduled`/`relative`) with `releaseAt`/`releaseAfterDays`, `dripMode`
(`gate_content`/`notify_only`), `notifyPush`/`notifyEmail`, virtual `unlocksAt`.
**Access:** read `publishedOrStaff`; write `isStaff`. Drafts · trash · folders.

### `locations` — places (venues, stores, offices)

**Fields:** `name`\*, `slug`, `shortDescription`, `description`, `address` group
(street/city/region/postalCode/country), `coordinates` (point), `hours[]`,
`phone`/`email`/`website`, `priceRange`, `amenities`, `featuredImage`/`gallery`,
`locationType` (category), `tags`, read-only `ratingAverage` (denormalized from
approved reviews), `temporarilyClosed`, `featured`, `commentsEnabled`; joins
`reviews`/`events`. **Access:** read `publishedOrStaff`; write `isStaff`.
Drafts · live preview · trash · folders.

### `events` — scheduled events

Editorial `_status` (drafts) is independent from lifecycle `eventStatus`
(`scheduled`/`rescheduled`/`cancelled`/`sold_out`). **Fields:** `title`_,
`slug`, `shortDescription`, `description`, `eventType` (category), `startsAt`_,
`endsAt`, `allDay`, `timezone`, `recurrence` group, `isVirtual` →
`location`/`virtualUrl`, `featuredImage`/`gallery`, `isFree` →
`price`/`currency`, `ticketUrl`, `capacity`, `registrationRequired`,
`organizer`/`speakers` (users), `featured`, `commentsEnabled`, `publishedAt`.
**Access:** read `publishedOrStaff`; write `isStaff`. Drafts · live preview ·
trash · folders.

### `categories` — hierarchical taxonomy

Nested Docs plugin maintains `parent`/`breadcrumbs`. **Fields:** `title`\*,
`slug`, `description`, `icon`, `color`, `image`, `featured`, `displayOrder`.
**Access:** read `anyone`; write `isStaff`.

### `tags` + `tag-groups` — flat tags with optional facets

Content tags + member interests (distinct from the Supabase plan-name
`public.tags`). **Fields:** `title`\*, `slug`, `group` (→ `tag-groups`),
`description`; tag-groups add `displayOrder`. **Access:** read `anyone`; write
`isStaff`.

### `media` — general upload store

Referenced everywhere (images/video/audio assets). **Fields:** `alt`_,
`caption`, `credit`, read-only `blurDataURL` (LQIP generated on upload),
`tags`. **Access:** read `anyone`; write `isStaff`. Upload `image/_`,
`video/_`, `audio/_` (thumbnail/card/hero, focal point) · trash · folders.

---

## Community group

### `space-groups` — top-level community sections

Circle-style sections; Nested Docs hierarchy. **Fields:** `name`\*, `slug`,
`description`, `icon`, `accessLevel`, `requiredPlans`, `order`; join `spaces`.
**Access:** read `anyone` (the app gates by `accessLevel`/`requiredPlans`);
write `isStaff`. Trash.

### `community-spaces` — spaces/channels

**Fields:** `name`\*, `slug`, `spaceGroup`, optional `parentSpace`,
`description`, `image`, `accessLevel`, `requiredPlans`, `postingPolicy`
(`members`/`moderators`/`admins`), `moderators`, `order`; join `posts`.
**Access:** read `anyone`; write `isStaff`. Trash.

### `community-posts` — member-authored wall posts

Distinct from editorial `posts`; no drafts — moderation via plain `status`
(`published`/`pending`/`hidden`/`flagged`, staff-only writes). **Fields:**
`author`\* (auto-assigned), `space`, optional `title`, `body` (richText),
`media[]`, `link` (destination), `tags`, `accessLevel`, `commentsEnabled`
(default true), staff-only `pinned`, read-only
`likeCount`/`commentCount`/`reportCount`, virtual `authorName`, `publishedAt`;
joins `comments`/`reports`. **Access:** read published-or-staff; **create any
authenticated user**; update/delete `ownsOrStaff("author")`. Hook
`assignOwner("author")`. Trash.

### `comments` — one threaded comment system

Polymorphic `target` → community-posts, posts, videos, audio, photos, events,
locations; replies via `parent`. **Fields:** `author`_ (auto-assigned),
`target`_, `parent`, `body`\*, staff-only `status`
(`pending`/`approved`/`spam`), read-only `likeCount`/`reportCount`, staff-only
`isPinned`, `editedAt`; join `replies`. **Access:** read `approvedOrStaff`;
**create any authenticated user** (gated by the target's `commentsEnabled` via
`requireCommentsEnabled`); update/delete `ownsOrStaff("author")`. Trash.

### `reports` — moderation queue

One **open** report per reporter+target (`uniquePolymorphic`); filing
increments the target's `reportCount`. **Fields:** `reporter`_ (auto-assigned),
`target`_ (community-posts/comments), `reason`\*
(`spam`/`harassment`/`hate`/`nudity`/`violence`/`misinformation`/`other`),
`details`, `status` (`open`/`reviewing`/`actioned`/`dismissed`), `resolution`,
`resolvedBy`/`resolvedAt`. **Access:** create any authenticated user;
read/update/delete `isStaff`.

---

## People group

### `users` — members & staff (auth collection)

SSO from Supabase (`supabaseStrategy`, local strategy disabled). **Fields:**
`email`, `name`, `displayName`, read-only unique `supabaseUserId`, admin-only
`roles[]`\*, staff-only `memberStatus`
(`active`/`invited`/`suspended`/`banned`); **Profile tab** (`username`,
`firstName`/`lastName`, `pronouns`, `avatar`/`coverImage`, `headline`, `bio`,
`location`, `website`, `company`/`jobTitle`, `socialLinks`, `interests` (tags),
`profileVisibility`, `customFields` validated against the `profile-fields`
global, staff-managed `tags`); **Contact tab** (phone, DOB, timezone, language,
address); **Preferences tab** (push/SMS/marketing opt-ins,
`notificationPreferences`, `onboardingCompleted`, `lastActiveAt`); **Billing
tab** (read-only `stripeCustomerID`); joins
`subscriptions`/`favorites`/`enrollments`/`devices`. **Access:** admin panel
`canAccessAdmin`; create `isAdmin` (triggers the invite hook); read/update
`isAdminOrSelf`; delete `isAdmin`. Trash (soft delete; bridge rejects trashed).

### `device-tokens` — push tokens

**Fields:** `user`_ (auto-assigned), unique `token`_, `platform`
(iOS/Android/Web), `deviceModel`, `appVersion`, `osVersion`, `locale`,
`pushEnabled`, `lastSeenAt`. **Access:** create any user; the rest
`ownsOrStaff`.

### `feed-tokens` — private podcast feed tokens

Opaque per-member tokens embedded in private RSS URLs. **Fields:** read-only
unique `token`_ (UUID default), `user`_, `show` (podcast series), `revoked`,
`lastAccessedAt`. **Access:** create any user; the rest `ownsOrStaff`.

### `favorites` — bookmarks

Polymorphic join: one row per user+target (`uniquePolymorphic`). **Fields:**
`user`_ (auto-assigned), `target`_ (posts/videos/audio/photos/locations/events),
`notes`. **Access:** create any user; the rest `ownsOrStaff`.

### `enrollments` — course enrollment + progress

Anchor for drip/gating; unique `[user, course]`. **Fields:** `user`_, `course`
(series `kind: course`), `enrolledAt`_, `status`
(`active`/`completed`/`refunded`/`expired`), `source`
(`purchase`/`subscription`/`free`/`manual`) → optional `subscription`,
`progress[]` (lesson, completedAt, percent). **Access:** read `ownsOrStaff`;
write `isStaff`.

### `reviews` — moderated ratings

For locations/events. **Fields:** `author`_ (auto-assigned), `target`_,
`rating`\* (1–5), `title`, `body`, `photos[]`, staff-only `status`
(`pending`/`approved`/`rejected`), read-only `helpfulCount`, staff-only
`verifiedVisit` and `response` group. **Access:** read `approvedOrStaff`;
create any user; update/delete `ownsOrStaff("author")`. Trash.

---

## Commerce group

### `plans` — billing catalog (authored here, synced to Stripe)

**Fields:** `name`_, `active`, unique `slug`, `description`, `pricingType`_
(`recurring`/`one_time`) → `interval`/`intervalCount`, `unitAmount`\*,
`currency`, `trialDays`, `introOffer` group (enabled, introAmount,
introInterval, introPeriods — implemented as an auto-applied Stripe coupon),
`entitlement` (`members`/`premium`), `features[]`, `badge`, `highlighted`,
`displayOrder`; read-only Stripe sync state (`skipSync`, `stripeProductId`,
`stripePriceId`, `stripeIntroCouponId`, `syncStatus`, `syncError`,
`lastSyncedAt`); join `subscriptions`. **Access:** read `anyone`; write
`isAdmin`. Hook `syncPlanAfterChange` (prices are immutable — changed
amount/interval recreates + archives).

### `coupons` — discounts & promotion codes

**Fields:** `name`_, `discountType`_ (`percent_off`/`amount_off`), `value`_,
`currency`, `duration`_ (`once`/`repeating`/`forever`) →
`durationCount`/`durationUnit`, `maxRedemptions`, `redeemBy`, `minimumAmount`,
read-only `timesRedeemed`, `active`, `appliesTo` (plans), customer-facing
`code`, `isWelcomeOffer` (at most one active); read-only Stripe sync state.
**Access:** read `anyone`; write `isAdmin`. Hook `syncCouponAfterChange`
(recreate-on-change, like prices).

### `subscriptions` — read-only Stripe mirror

Written exclusively by the plugin-stripe webhook
(`POST /cms-api/stripe/webhooks`); keyed by unique `stripeSubscriptionID`.
**Fields (all read-only):** `user`, `plan`, `coupon`, `status`
(`trialing`/`active`/`past_due`/`canceled`/`churned`/`paused`), period/trial
dates, `cancelAtPeriodEnd`, `canceledAt`, `lastPaymentAt`/`lastPaymentAmount`,
`stripeCustomerID`. **Access:** read `ownsOrStaff`; create/update/delete
denied. (RLS clients use `public.subscriptions` instead — see `ERD.md`.)

---

## Marketing group

### `pages` — block-composed marketing/legal pages

Launch UI blocks: **hero | items (features) | logos | stats | cta | faq |
prose**. **Fields:** `title`\*, `slug`, `layout` (blocks), `showInNav`,
`publishedAt`. **Access:** read `publishedOrStaff`; write `isStaff`. Drafts +
live preview (mobile/tablet/desktop breakpoints) · trash. Nested Docs
hierarchy.

### `onboarding` — first-run slides

**Fields:** `title`_, `body`, `image`, `animation` (Lottie), `cta` +
`secondaryCta` (label + destination deep link), `isFinalSlide`, `order`_,
`backgroundColor`, `active`. **Access:** read `anyone`; write `isStaff`.

### `banners` — in-app promos/announcements

**Fields:** `title`_, `body`, `image`, `icon`, `variant`_
(`info`/`promo`/`warning`/`announcement`), `link` (with label/appearance),
`placement`\* (`home`/`global`/`content`/`onboarding`), `targetPlatform[]`,
`audience` (`all`/`guests`/`members`), `startsAt`/`endsAt` window, `priority`,
`dismissible`, `active`. **Access:** read `anyone`; write `isStaff`.

### `notifications` — staff-authored multi-channel sends

**Fields:** `title`_, `body`, `image` (rich push), `deepLink`, `data` (json),
`channel[]`_ (`push`/`email`/`sms`/`in_app`), `smsBody` (≤160), `audience`\*
(`all`/`segment`/`users`) → `segment`/`targetUsers`, `scheduledAt`, read-only
`sentAt`/`sentCount`/`openCount`, `status`
(`draft`/`scheduled`/`sending`/`sent`/`failed`). **Access:** all `isStaff`.
Trash. **Delivery:** a `scheduled` notification whose `scheduledAt` has passed is
sent by the dispatch worker at `POST /api/cms/notifications/dispatch`
(`CRON_SECRET`-guarded, Vercel Cron every minute — `apps/nextjs/vercel.json`).
It resolves the audience (all / `targetUsers` via `cms.users.supabaseUserId` /
`segment` `{ tags: [...] }`) to Supabase user ids, fans out Expo push and inserts
in-app feed rows (`public.ext_notifications`), then writes back
`sentAt`/`sentCount`/`status`. The worker core lives in `@acme/mcp`
(`dispatch/run-dispatch.ts`); staff can author/schedule these from the MCP too
(`notify_schedule`). Edge-function delivery is not used (the worker needs both
the Payload Local API and the service-role `public` client).

### `forms` + `form-submissions` (plugin)

Form Builder plugin: staff author forms (text/textarea/email/select/checkbox/
number/message fields); submissions are publicly creatable, staff-read.

---

## Globals

| Global                      | Purpose                                                                                                                                                                                                                                                                                                                                                                                                     | Read               | Update    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| `site-settings`             | Site chrome: General (siteName, defaultMeta), Header nav + actions, Footer columns/policies/copyright, Social handles — consumed by the Launch UI navbar/footer                                                                                                                                                                                                                                             | `anyone`           | `isStaff` |
| `pricing-settings`          | `/pricing` page: heading/subheading, `billingToggleDefault`, up to 3 `featuredPlans`, optional `freeTier` group, disclaimer                                                                                                                                                                                                                                                                                 | `anyone`           | `isStaff` |
| `theme-settings`            | The **front-end** shadcn theme (versioned, drafts→publish): Branding (appName, brandLink, appIcon, light/dark logos), Light/Dark color tokens, Typography (sans/serif/mono, letterSpacing), Other (radius, spacing, shadow). Serialized by `lib/theme/serialize.ts` into `<ThemeStyle />`; branding read by `getBranding()`. The `/admin` chrome uses a separate fixed palette (`lib/theme/admin-theme.ts`) | `publishedOrStaff` | `isStaff` |
| `profile-fields`            | Admin-defined custom member fields (key, label, type, options, required, visibility, editableByMember, order) — drives `users.customFields` validation + profile UI                                                                                                                                                                                                                                         | `anyone`           | `isStaff` |
| `image-generation-settings` | **System → Image Generation.** Workspace settings for AI image generation: `enabled` (kill switch), `model` (gateway image-model slug from the `@acme/config` catalog), `systemPrompt` (art direction). Resolution order at generation time: global → env → code default                                                                                                                                    | `isStaff`          | `isStaff` |

---

## AI image generation

Image-enabled content collections (and the Media library, via the MCP
`generate_media` tool) auto-generate images from a text **`imagePrompt`**. See
[ARCHITECTURE.md → core CMS image generation](./ARCHITECTURE.md) for the moving
parts; the highlights:

- **Opt-in fields.** A collection adds `...generatedImageFields({ formats })`
  (`payload/fields/generated-images.ts`) + a two-hook `beforeChange` array
  `[generateImagesHook(cfg), syncImageUrls(cfg)]` (`payload/hooks/generate-images.ts`).
  This yields, per format: an `upload`→`media` field (`imageHero` / `imageOg` /
  `imageSquare`), a hidden `<field>Url` cache the public surfaces read, and a
  `CopyImageUrl` admin control; plus the shared `imageAlt` text and the
  `imagePrompt` textarea. Presets live in `lib/image-formats.ts`:
  **FEATURED** (hero 16:9 + OG 1200×630) and **CARD** (+ a 1:1 square).
- **Enabled on:** `posts`, `pages`, `videos`, `audio` (FEATURED) and `events`,
  `series`, `locations` (CARD). **Not** on `photos` (the upload _is_ the image)
  or `community-posts` (member-authored — avoids member-triggered gateway spend).
- **Semantics (verified, do not regress).** `beforeChange`, not `afterChange`,
  so generation triggers off the incoming `imagePrompt`, the new media ids land
  in the same write, and there's no second write/recursion. **Fill-missing
  slots:** only empty slots are filled; clear a slot to regenerate just that one.
  **Per-format isolation:** one format failing (content-safety, gateway, sharp)
  is logged with its cause and never blocks the write or the other formats.
  **S3-configured guard runs first** so a misconfigured deploy spends zero
  gateway budget. The kill switch (`enabled`) and `req.context.skipImageGeneration`
  (set by the seed) both short-circuit.

## Adding or changing a collection

Follow [`CLAUDE.md` → How to add a Payload content type](../CLAUDE.md#how-to-add-a-payload-content-type):
copy the closest collection above (e.g. `Posts.ts` for editorial,
`Favorites.ts` for owner-scoped member data), register it in
`payload.config.ts`, then `pnpm cms:gen-types`, `pnpm cms:migrate:create`
(commit the migration — production applies it automatically via
`prodMigrations`), add a seed step in `payload/seed.ts`, and keep this document
in sync.
