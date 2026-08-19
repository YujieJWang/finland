# Read Me When You Need Me

A private, mobile-first digital care package for two people living between Singapore and Finland. It combines “Open When” letters, responses, private photos and voice notes, a memory box, a Finland scrapbook, and a one-tap Telegram love delivery.

The app uses Next.js App Router on Vercel. Supabase provides magic-link authentication, Postgres, Row Level Security, and private Storage. Telegram calls and privileged Supabase operations happen only in server routes.

## What is included

- Allowlist-only magic-link authentication for exactly two roles
- Live Singapore and Finland clocks using `Asia/Singapore` and `Europe/Helsinki` (including Finnish daylight saving time)
- Configurable reunion countdown and distance
- Immediate, date-locked, and masked mystery cards
- Separate database timestamps for opening and explicitly marking a card read
- Text, mood, private photo, uploaded audio, and browser-recorded voice responses
- Two-way card creation and editing under `/create` and `/manage`
- Random memory box with immediate-repeat avoidance
- Finland scrapbook derived automatically from card responses
- Rate-limited Telegram “Thinking of You” messages and secure inline-button love returns
- Private signed media URLs, 10 MB upload limits, MIME validation, RLS, and server validation

## Architecture

```text
Phone / browser
      │
      ▼
Next.js on Vercel ─── server routes only ───▶ Telegram Bot API
      │
      ├── Supabase Auth (magic link + allowlist trigger)
      ├── Postgres (cards, responses, memories, love pings)
      └── private-media bucket (signed URLs + Storage policies)
```

There is no separate backend. Next.js Server Components read private data using the signed-in user session. RLS remains the final authorization boundary. Locked card contents are not selectable by their recipient before `unlock_at`; `list_card_previews()` exposes only safe front-of-card fields and masks mystery titles.

## Requirements

- Node.js 22 or newer
- npm
- A Supabase project
- A Vercel account
- Optional: a Telegram bot

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Before sign-in works, finish the Supabase setup below and fill `.env.local`.

Run all checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In Project Settings → API, copy the Project URL, publishable/anon key, and service-role key into `.env.local`.
3. Install/login to the Supabase CLI, link the project, and apply the migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration at `supabase/migrations/202608190001_initial.sql` creates all tables, indexes, functions, RLS policies, auth triggers, and the private `private-media` Storage bucket.

### Add the two allowed users

Run this in Supabase SQL Editor before either person signs in. Use real lowercase emails and preferred names:

```sql
insert into public.allowed_emails (email, display_name, role, timezone)
values
  ('you@example.com', 'Your name', 'creator', 'Asia/Singapore'),
  ('her@example.com', 'Her name', 'recipient', 'Europe/Helsinki');
```

The roles identify the initial content direction; both people may still create cards for the other. The database’s `guard_allowed_user_before_signup` trigger rejects any email not in this table.

In Supabase Authentication → URL Configuration set:

- Site URL: `http://localhost:3000` for local work, then the production URL after deployment
- Redirect URLs: `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback`

Both people can now enter an allowlisted email on `/login`. Their first valid magic-link sign-in creates the corresponding profile. There is no public sign-up screen.

### Seed the example letters

After both people have signed in once:

```bash
npm run seed
```

The script adds the 12 requested starter cards without duplicating existing titles. Every body begins with `[REPLACE ME]`; it does not invent personal memories. Edit them at `/manage` before sharing the app.

### Storage

The migration creates one non-public bucket, `private-media`, with a 10 MB object limit and an image/audio MIME allowlist. Browser uploads must live under the authenticated user’s UUID folder. Database RLS and Storage policies grant reads only to a card’s participants; the UI uses one-hour signed URLs.

No manual public bucket or public URL is needed. If you change file limits, update both the migration and `lib/domain.ts`.

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL; safe for the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable/anon key; safe with RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Allowlist lookup, Telegram rollback/webhook, and seed; server only |
| `NEXT_PUBLIC_PERSON_ONE_NAME` | Recommended | Singapore display name |
| `NEXT_PUBLIC_PERSON_TWO_NAME` | Recommended | Finland display name |
| `NEXT_PUBLIC_REUNION_DATE` | Yes | Reunion date in `YYYY-MM-DD` |
| `NEXT_PUBLIC_DISTANCE_KM` | Optional | Display constant; defaults to `9000` |
| `NEXT_PUBLIC_HOMEPAGE_MESSAGE` | Optional | Homepage message |
| `NEXT_PUBLIC_CHAPTER_NAME` | Optional | Scrapbook heading |
| `TELEGRAM_BOT_TOKEN` | For love pings | BotFather token; server only |
| `TELEGRAM_CHAT_ID` | For love pings | Telegram destination chat/user ID; server only |
| `TELEGRAM_WEBHOOK_SECRET` | For love returns | Random secret sent by Telegram to the webhook |
| `LOVE_PING_COOLDOWN_SECONDS` | Optional | Server-enforced cooldown; defaults to 300 |

Never prefix the service-role key or Telegram values with `NEXT_PUBLIC_`, and never commit `.env.local`.

## Telegram setup

1. Open Telegram’s official `@BotFather`, run `/newbot`, and copy the token to `TELEGRAM_BOT_TOKEN`.
2. Open the new bot and send `/start`.
3. Find the chat ID:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates"
```

Use `message.chat.id` as `TELEGRAM_CHAT_ID`.

4. Generate a webhook secret:

```bash
openssl rand -hex 32
```

5. After deploying, register the webhook (replace all placeholders):

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://YOUR_DOMAIN/api/telegram/webhook","secret_token":"YOUR_WEBHOOK_SECRET","allowed_updates":["callback_query"]}'
```

The webhook checks Telegram’s secret header and the expected chat ID. Inline-button callbacks are idempotent: each outgoing ping can create at most one return ping.

## Deploy to Vercel

1. Push this directory to a private Git repository.
2. In Vercel, choose Add New → Project and import it.
3. Keep Framework Preset as Next.js and Build Command as `npm run build`.
4. Add every required environment variable above to Production (and Preview if needed).
5. Set the Vercel Node.js runtime to 22.x.
6. Deploy.
7. Update Supabase Auth’s Site URL and Redirect URLs with the deployed HTTPS URL.
8. Register the Telegram webhook using the production URL.

Using the CLI instead:

```bash
npx vercel
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Repeat `vercel env add` for each variable.
npx vercel --prod
```

### Custom domain

In Vercel Project Settings → Domains, add the domain, apply the DNS records Vercel shows, and wait for HTTPS to become active. Then add `https://YOUR_DOMAIN/auth/callback` to Supabase Auth Redirect URLs and re-register the Telegram webhook at the custom domain.

## Adding and editing content

- `/create`: create a letter, choose the other person, upload media, and select immediate/date/mystery unlock behavior.
- `/manage`: edit letters you created and see opened/read timestamps plus response counts.
- `/memories`: draw a random memory or add a dated memory with a place and private media.
- `/finland`: view the scrapbook generated from letter responses.

Only a card’s creator can edit it. Only its recipient can set `opened_at` or `read_at`, and only after the database considers it unlocked.

## Backups and data ownership

Application records live in the Supabase Postgres database; uploaded originals live in Supabase Storage. Use Supabase’s managed backups/PITR according to your plan. For a manual database backup:

```bash
npx supabase db dump --linked -f backup.sql
```

Back up the private Storage bucket separately from the Supabase dashboard or Storage API if the media is irreplaceable. Database dumps contain paths and metadata, not the media objects themselves. Protect backups as private relationship data.

## Security notes

- RLS is enabled on every private application table.
- Auth signup is blocked at the database unless the normalized email is allowlisted.
- The service-role key and Telegram token are imported only by server actions/routes/scripts.
- Mystery titles are masked by a security-definer preview function; full locked rows remain unavailable to the recipient.
- Read/open operations are recipient-only database functions, not client-side state.
- Love ping reservations use a Postgres advisory transaction lock, preventing concurrent taps from bypassing the cooldown.
- React escapes all user text; the app does not render user-supplied HTML.
- Media buckets are private, uploads are type/size checked twice, and reads use signed URLs plus Storage RLS.
- `robots` metadata prevents indexing, but authentication—not obscurity—provides privacy.

Before sharing, replace every seeded `[REPLACE ME]` letter, verify both accounts independently, open a future-locked card as the recipient to confirm rejection, and send one Telegram ping plus one return ping.
