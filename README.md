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
- Two-way card creation, editing, and creator-only permanent deletion under `/create` and `/manage`
- Creator-managed private homepage photographs with captions, ordering, and an accessible rotating display
- Random memory box with immediate-repeat avoidance
- Finland scrapbook derived automatically from card responses
- Rate-limited, short-context Telegram conversations and “Thinking of You” messages
- Private signed media URLs, 10 MB upload limits, MIME validation, RLS, and server validation

## Architecture

```text
Phone / browser
      │
      ▼
Next.js on Vercel ─── server routes only ───▶ Telegram Bot API / OpenAI Responses API
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
- Optional: a Telegram bot and OpenAI API key for private-group replies

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Before sign-in works, finish the Supabase setup below and fill `.env.local`.

To preview an allowlisted partner’s account without sending an email, generate a one-time local link and open it in an incognito window:

```bash
npm run login-as -- her@example.com
```

The command checks `allowed_emails`, keeps the service-role key server-side, and prints a sensitive one-time URL. Do not share or save that URL.

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

The migrations create all tables, indexes, functions, RLS policies, auth triggers, and the private `private-media` Storage bucket. `202608200001_homepage_photos.sql` adds private homepage photograph metadata. `202608200002_telegram_context.sql` adds service-role-only conversation context. `202608210001_telegram_llm_controls.sql` atomically deduplicates Telegram updates, enforces per-chat request limits, records delivery state, and trims context to the configured window. Browser clients have no policies or write grants on either Telegram table.

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

The migration creates one non-public bucket, `private-media`, with a 10 MB object limit and an image/audio MIME allowlist. Browser uploads must live under the authenticated user’s UUID folder. Database RLS and Storage policies grant reads only to the two authenticated partners; the UI uses one-hour signed URLs for cards, memories, and homepage photographs.

No manual public bucket or public URL is needed. If you change file limits, update both the migration and `lib/domain.ts`.

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable                        | Required         | Purpose                                                            |
| ------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes              | Supabase project URL; safe for the browser                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes              | Supabase publishable/anon key; safe with RLS                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes              | Privileged media, Telegram context/webhook, and seed; server only  |
| `NEXT_PUBLIC_PERSON_ONE_NAME`   | Recommended      | Singapore display name                                             |
| `NEXT_PUBLIC_PERSON_TWO_NAME`   | Recommended      | Finland display name                                               |
| `NEXT_PUBLIC_REUNION_DATE`      | Yes              | Reunion date in `YYYY-MM-DD`                                       |
| `NEXT_PUBLIC_DISTANCE_KM`       | Optional         | Display constant; defaults to `9000`                               |
| `NEXT_PUBLIC_HOMEPAGE_MESSAGE`  | Optional         | Homepage message                                                   |
| `NEXT_PUBLIC_CHAPTER_NAME`      | Optional         | Scrapbook heading                                                  |
| `TELEGRAM_BOT_TOKEN`            | For Telegram     | BotFather token; server only                                       |
| `TELEGRAM_BOT_USERNAME`         | For group chat   | Bot username without `@`; server only                              |
| `TELEGRAM_CHAT_ID`              | For Telegram     | Exact private group ID; server only                                |
| `TELEGRAM_ALLOWED_USER_IDS`     | For group chat   | Exactly two comma-separated user IDs; server only                  |
| `TELEGRAM_WEBHOOK_SECRET`       | For Telegram     | Random secret sent by Telegram to the webhook                      |
| `OPENAI_API_KEY`                | For group chat   | OpenAI credential used only by the server webhook                  |
| `OPENAI_MODEL`                  | For group chat   | One text model available to the API project                        |
| `TELEGRAM_LLM_COOLDOWN_SECONDS` | Optional         | Minimum gap between model calls; defaults to `10`, maximum `3600`  |
| `TELEGRAM_LLM_DAILY_LIMIT`      | Optional         | UTC per-chat model-call limit; defaults to `50`, maximum `1000`    |
| `TELEGRAM_LLM_CONTEXT_MESSAGES` | Optional         | Recent context rows; defaults to `10`, allowed range `2`–`20`      |

Never prefix the service-role key, Telegram values, or OpenAI key with `NEXT_PUBLIC_`, and never commit `.env.local`.

## Telegram setup

1. Open Telegram’s official `@BotFather`, run `/newbot`, and save the token and username as `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`.
2. Create one private group containing only both partners and the bot. The bot does not need administrator access.
3. In BotFather, run `/setprivacy`, select the bot, choose **Disable**, then remove and re-add the bot to the group. This is required for Telegram to deliver ordinary group text; the webhook still rejects every other chat, bots, service/non-text updates, and non-allowlisted senders.
4. Before registering the webhook, have each partner send a message in the group, then inspect the pending updates locally:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates"
```

Use the group’s `message.chat.id` as `TELEGRAM_CHAT_ID`. Put the two distinct `message.from.id` values in `TELEGRAM_ALLOWED_USER_IDS`, separated by a comma. Keep all three values in server-only environment settings.

5. Generate a webhook secret:

```bash
openssl rand -hex 32
```

6. After deploying, register the webhook (replace all placeholders):

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://YOUR_DOMAIN/api/telegram/webhook","secret_token":"YOUR_WEBHOOK_SECRET","allowed_updates":["message","callback_query"]}'
```

7. Add `reset - forget recent conversation context` with BotFather’s `/setcommands`.

The webhook replies to every authorized text message in the configured group and references the triggering message. `/reset` erases the local recent context without calling OpenAI. Every `update_id` is claimed before model work; failed Telegram delivery retries reuse the stored reply instead of buying another generation. Scheduled “thinking of you” messages use the same group, and existing love-return callbacks remain idempotent.

## OpenAI setup, cost, and privacy

1. Create a project API key at [OpenAI API keys](https://platform.openai.com/api-keys) and add it to Vercel as `OPENAI_API_KEY`.
2. Add a model available to that API project as `OPENAI_MODEL`; the code has no hard-coded fallback model.
3. Configure API billing and a project budget in the [OpenAI platform](https://platform.openai.com/settings/organization/billing/overview). API usage is billed separately from ChatGPT subscriptions and is charged according to the selected model’s token pricing.
4. Set the Telegram cooldown and daily limit conservatively, deploy, then test a normal message, `/reset`, and a love-return button.

Each model request contains only up to the configured number of recent Telegram text rows with participant display names. It never includes cards, responses, private media, Supabase data, Telegram IDs, or credentials, and it gives the model no tools. Input is capped at 2,000 characters, output at 300 tokens, the model request at 20 seconds, and the Vercel route at 30 seconds.

Responses use `store: false`, so the app does not create OpenAI conversation state. OpenAI states that API data is not used for training unless an organization opts in, but default abuse-monitoring logs may retain prompts and responses for up to 30 days; read the current [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint) before sending sensitive relationship text. `/reset` removes Supabase context only and cannot remove any provider logs already created.

The conversation table is automatically trimmed to the configured context window. The processed-update table keeps reply text only so failed Telegram deliveries can be retried without another model charge. Remove old operational rows on a retention schedule appropriate for the deployment, for example monthly:

```sql
delete from public.telegram_webhook_updates
where created_at < now() - interval '30 days';
```

## Deploy to Vercel

1. Push this directory to a private Git repository.
2. In Vercel, choose Add New → Project and import it.
3. Keep Framework Preset as Next.js and Build Command as `npm run build`.
4. Add every required environment variable above to Production (and Preview if needed). Keep all OpenAI, Telegram, and service-role values server-only.
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

## Reunion countdown

A daily Telegram message is sent to the configured group at approximately midnight in Finland with the number of days until the reunion date.

### How it works

- A Vercel cron job fires every hour (`0 * * * *` UTC).
- The route checks whether Helsinki's local hour is midnight using `Intl.DateTimeFormat` with `Europe/Helsinki`, handling EET/EEST transitions automatically.
- A `countdown_deliveries` table (keyed on Finland's calendar date) ensures at most one message per day, even under retries or duplicate invocations.
- If Telegram delivery fails, no record is inserted; the next hourly invocation retries.

### Setup

1. Run the migration: `supabase db push`
2. Ensure `CRON_SECRET` is set on Vercel (auto-provisioned for cron jobs; verify under Project Settings → Environment Variables).
3. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` must already be configured.
4. `NEXT_PUBLIC_REUNION_DATE` controls the target date.

The countdown stops sending after the reunion date passes.

## Adding and editing content

- `/create`: create a letter, choose the other person, upload media, and select immediate/date/mystery unlock behavior.
- `/manage`: edit or permanently delete letters you created, see opened/read timestamps and response counts, and manage the ordered homepage photographs when signed in as the `creator` role.
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
- Card deletion is checked in the server action and by the existing creator-only delete RLS policy. Private originals and response uploads are removed before database cascades remove the card records.
- Homepage photograph metadata is RLS-protected, only the `creator` role can change it, and the browser receives short-lived signed URLs rather than private paths.
- Telegram updates are claimed and rate-limited in a security-definer transaction before OpenAI is called. Telegram context and delivery state are service-role-only.
- OpenAI receives bounded Telegram text only, with fixed instructions separate from untrusted messages, no tools, and no application records or private media.
- React escapes all user text; the app does not render user-supplied HTML.
- Media buckets are private, uploads are type/size checked twice, and reads use signed URLs plus Storage RLS.
- `robots` metadata prevents indexing, but authentication—not obscurity—provides privacy.

Before sharing, replace every seeded `[REPLACE ME]` letter, verify both accounts independently, open a future-locked card as the recipient to confirm rejection, and send one Telegram ping plus one return ping.
