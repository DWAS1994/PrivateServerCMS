# MMORPG Panel

Production-ready hosting panel for an MMORPG private server. Built with Next.js 15 + Prisma.
Inspired by vsro-style PHP/MySQL panels but modernized: real database, real auth, real
payment integration, real admin tools.

## Features

- **Silkroad-inspired theme** — gold + burgundy + lacquered-wood aesthetic, ornamental Eastern fantasy styling built entirely from original CSS/SVG. Asset slots in `public/theme/` for customers to drop their own banner, class icons, and logo (see `public/theme/README.md`)
- **Database-backed registration & login** — bcrypt password hashing, cookie-based sessions
- **Game DB integration** — connect the panel to your game's MySQL database (vSRO etc) so registrations create in-game accounts in real time, and live pages pull data straight from the game tables
- **Discord login button** — real OAuth flow with account linking
- **Server config** — set max player cap, MOTD, EXP/gold/drop rates, registration toggle
- **Unique History** — live recent unique-monster kills from the game DB
- **SOX Drop Log** — live rare item drops (Star / Moon / Sun) from the game DB
- **Server events** — full datetime scheduling plus a quick "name + countdown" composer; public events page shows a ticking countdown
- **News system** — categorized posts (announcement / patch / event), pinning
- **Forum** — categories, threads, replies, pinned/locked moderation
- **Live chat** — global #general channel, polling-based, role-aware
- **Direct messages (inbox)** — user-to-user conversations
- **Profile walls** — leave posts on other users' profiles at `/u/[username]`
- **Notifications** — bell with dropdown showing personal + global notifications, unread badges, polled every 30s
- **Admin broadcast** — admins can push global notifications from `/admin/notifications`
- **Payments** — Stripe, PayPal, and Hypotatima all wired up with webhook handlers
- **Admin panel** — full CRUD for everything, role-based access (player / GM / admin)


## Silkroad UI asset slots

The homepage has been updated to use Silkroad Online-style screenshot slots. Add your own in-game images here:

- `public/theme/hero.jpg` — large homepage hero image
- `public/theme/ingame-hotan.jpg` — trade route/city showcase
- `public/theme/ingame-unique.jpg` — unique boss showcase
- `public/theme/ingame-jobwar.jpg` — PvP/job war/fortress showcase

Fallback SVGs are included so the CMS remains polished even before real screenshots are added. See `public/theme/README.md` for recommended sizes.

## Quick start

```bash
# 1. Install dependencies (also runs `prisma generate` automatically)
npm install

# 2. Push the schema to your database (creates dev.db for SQLite)
npm run db:push

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>. On first run you'll be redirected to **/install**,
the setup wizard. You'll need:

- Your license key (`MMRPG-XXXX-XXXX-XXXX-XXXX`) — sent by the vendor after purchase
- The license server URL (`https://license.yourcms.com/api/licenses/validate`)
- The signing key (long hex string from the vendor)

After the wizard completes, the panel revalidates your license against the
license server once every 24 hours. If the subscription lapses, the entire panel
hard-locks to `/licensed-expired` until you fix it.

> **Already running an older copy?** If you're upgrading, the schema has new tables
> for install state and license tracking. Re-run `npm run db:push` and visit
> `/install` to complete setup.

## Switching databases

The default is SQLite (zero config, file at `prisma/dev.db`). For production, switch to MySQL
or PostgreSQL — both are first-class Prisma datasources.

1. Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "mysql"   // or "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Edit `.env`:
   ```
   DATABASE_URL="mysql://user:pass@host:3306/mmorpg_panel"
   ```
3. Re-run:
   ```
   npm run db:push
   npm run db:seed
   ```

This is what makes it vsro-style: the same panel works against an existing MySQL game
database, you just point `DATABASE_URL` at it. (For an existing schema, use
`npx prisma db pull` instead of `db:push`.)

## Game-server integration

To track live monster spawns and kills, your game server (or a side-process tailing its logs)
should POST events to the panel:

**Endpoint:** `POST /api/monsters/log`

**Headers:**
```
X-Server-Token: <your shared secret from .env GAME_SERVER_TOKEN>
Content-Type: application/json
```

**Body (spawn):**
```json
{ "type": "spawn", "monsterName": "Crimson Dragon", "zone": "Volcano Peak" }
```

**Body (kill):**
```json
{ "type": "kill", "monsterName": "Crimson Dragon", "killerName": "Hero42", "killerId": 17 }
```

The monster name must match an entry in the registry (admin → Monsters). If `GAME_SERVER_TOKEN`
is not set in `.env`, the endpoint accepts any request — useful for local dev, dangerous in
production. **Always set a token before going live.**

## Payment provider setup

### Stripe

1. Get keys from <https://dashboard.stripe.com/apikeys>
2. Set in `.env`:
   ```
   STRIPE_SECRET_KEY="sk_live_..."
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
   ```
3. Create a webhook in the Stripe dashboard pointing at:
   ```
   https://your-domain.com/api/payments/stripe/webhook
   ```
   listening for `checkout.session.completed`. Copy the signing secret to
   `STRIPE_WEBHOOK_SECRET`.
4. The Donate page automatically shows the Stripe option once the secret key is present.

### PayPal

1. Create an app at <https://developer.paypal.com/dashboard/applications/>
2. Set in `.env`:
   ```
   PAYPAL_CLIENT_ID="..."
   PAYPAL_CLIENT_SECRET="..."
   PAYPAL_API_BASE="https://api-m.sandbox.paypal.com"   # or api-m.paypal.com for live
   ```
3. PayPal uses a return-URL flow (no webhook needed for the basic case). The capture
   handler at `/api/payments/paypal/capture` is hit when buyers return from approval.

### Hypotatima

The Hypotatima provider is included as a stub following the same structural pattern. To
finish it:

1. Set credentials in `.env`:
   ```
   HYPOTATIMA_MERCHANT_ID="..."
   HYPOTATIMA_API_KEY="..."
   HYPOTATIMA_API_BASE="https://api.hypotatima.example/v1"
   ```
2. Edit `lib/payments/hypotatima.js`:
   - Update the request shape in `createCheckout()` to match Hypotatima's actual API
   - Implement `verifyWebhookSignature()` per their docs (typically HMAC-SHA256 of the
     raw request body using your webhook secret)
3. Register the webhook URL with Hypotatima:
   ```
   https://your-domain.com/api/payments/hypotatima/webhook
   ```

Edit the package catalog in `lib/payments/packages.js` to match your server's economy.

## Discord OAuth setup

The "Continue with Discord" button is hidden until you configure these env vars:

```
DISCORD_CLIENT_ID="..."
DISCORD_CLIENT_SECRET="..."
DISCORD_REDIRECT_URI="http://localhost:3000/api/auth/discord/callback"
```

To get them:

1. Go to <https://discord.com/developers/applications> and click **New Application**.
2. Open your app → **OAuth2** in the sidebar.
3. Under **Redirects**, add the URL you set as `DISCORD_REDIRECT_URI`. For local dev,
   use `http://localhost:3000/api/auth/discord/callback`. For production, swap in your
   real domain.
4. Copy the **Client ID** and **Client Secret** into `.env`.
5. Restart the dev server. The Discord button will appear on `/login` and `/register`.

**How linking works:** if a logged-in user clicks the Discord button, their account
gets linked to that Discord profile. If a logged-out user clicks it: existing users
are matched by Discord ID or email; if neither matches and registration is open, a
new account is created automatically using their Discord username.

## Game database integration (vSRO-style)

The panel can read and write to your **game server's** MySQL database (separate from
its own Prisma DB). This is what lets registration create in-game accounts directly,
and powers the live Unique History and SOX Drop Log pages.

### Setup

1. Make sure your game server's database is a MySQL/MariaDB database **and** reachable
   from wherever this panel is hosted (firewall, bind-address, etc).
2. Log in to the panel as an admin, go to **Admin → Game DB**.
3. Enter host, port, database name, user, password. Click **Test connection** — you
   should see a green ✓ with the MySQL version.
4. Adjust the table/column mapping to match your emulator's schema. The defaults
   match a typical vSRO layout (`TB_User`, `_UniqueKillLog`, `_SoxItemLog`).
5. Tick **Enable game DB integration** and click **Save**.

The password is stored encrypted (AES-256-GCM with a key derived from `SESSION_SECRET`)
so the plaintext never lives on disk.

### What it does

- **Registration** writes a new row into the game's account table (`TB_User` by default)
  in addition to the panel's user table. The same credentials work for both. If
  game-DB writes fail, the panel registration is rolled back so you don't end up with
  half-registered users.
- **`/unique-history`** queries the configured `_UniqueKillLog` table and shows the
  most recent unique-monster kills + top-killer/most-killed aggregates.
- **`/sox-drops`** queries the configured `_SoxItemLog` table and shows recent SOX
  drops with rarity badges (Star / Moon / Sun).

### Caveats

- **SQL Server vs MySQL.** Many silkroad emulators ship with Microsoft SQL Server.
  This driver speaks MySQL. If you're on SQL Server, you'll need to either:
  - Use a MySQL-based emulator
  - Export the game data to MySQL (often a one-time conversion)
  - Swap `mysql2` for `mssql` in `lib/gameDb.js` — the queries themselves are
    parameterized so they translate fairly directly.
- **Password format in the game DB.** The default `createGameAccount` inserts the
  raw password. Some emulators hash on the auth server, some store plaintext, some
  use a custom hash. Edit `createGameAccount` in `lib/gameDb.js` to match.
- **Schema differences.** Column names like `KillerName`, `MonsterName`, `EventTime`
  vary between emulators. The query helpers in `lib/gameDb.js` try several common
  variants — if your log tables have unusual column names, you may need to adjust
  the normalization logic in `recentUniqueKills()` and `recentSoxDrops()`.

## Project layout

```
.
├── prisma/
│   ├── schema.prisma      # data model
│   └── seed.js            # initial admin + categories + monsters
├── pages/
│   ├── index.jsx          # homepage with server status hero
│   ├── register.jsx       # account creation
│   ├── login.jsx          # login
│   ├── account.jsx        # user account + payment history
│   ├── news.jsx           # news feed
│   ├── events.jsx         # upcoming events
│   ├── monsters.jsx       # monster registry + live activity feed
│   ├── donate.jsx         # package grid w/ Stripe/PayPal/Hypotatima buttons
│   ├── forum/
│   │   ├── index.jsx              # categories
│   │   ├── c/[slug].jsx           # threads in category
│   │   └── thread/[id].jsx        # thread view + reply
│   ├── admin/
│   │   ├── index.jsx              # dashboard
│   │   ├── settings.jsx           # server config
│   │   ├── users.jsx              # user search + role/ban management
│   │   ├── news.jsx               # news CRUD
│   │   ├── events.jsx             # event CRUD
│   │   ├── monsters.jsx           # monster CRUD
│   │   └── payments.jsx           # payment ledger + filters
│   └── api/
│       ├── auth/                  # register, login, logout
│       ├── server/status.js       # public server stats
│       ├── news.js, news/[id].js  # news endpoints
│       ├── events.js, events/[id].js
│       ├── monsters.js, monsters/[id].js, monsters/log.js
│       ├── forum/categories.js, threads.js, threads/[id].js
│       ├── admin/server-config.js, users.js
│       └── payments/
│           ├── stripe/checkout.js, webhook.js
│           ├── paypal/create.js, capture.js
│           └── hypotatima/checkout.js, webhook.js
├── lib/
│   ├── prisma.js          # Prisma client singleton
│   ├── auth.js            # session, password, requireUser/requireAdmin
│   └── payments/
│       ├── packages.js    # purchasable package catalog
│       ├── stripe.js
│       ├── paypal.js
│       ├── hypotatima.js
│       └── fulfill.js     # idempotent credit-on-success helper
├── components/
│   ├── Layout.jsx         # public site shell (top nav, footer)
│   └── AdminLayout.jsx    # admin shell w/ sidebar
└── styles/
    └── globals.css        # dark gaming aesthetic, no framework
```

## Production checklist

- [ ] Generate a real `SESSION_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] Switch `DATABASE_URL` to MySQL/PostgreSQL and update `provider` in schema
- [ ] Change the seeded admin password (or delete the seeded admin and create your own)
- [ ] Set `NEXT_PUBLIC_SITE_URL` to your production domain
- [ ] Set `GAME_SERVER_TOKEN` (don't leave blank in production)
- [ ] Configure live keys for whichever payment providers you use
- [ ] Register webhook URLs with Stripe and Hypotatima
- [ ] `npm run build && npm start` (or deploy to Vercel / your Node host)
- [ ] Set up reverse proxy with HTTPS (Caddy / Nginx / Cloudflare)

## Architecture notes

- **Sessions** are stored in encrypted cookies via `iron-session` — no Redis or DB session
  table needed. Sessions persist 30 days; change `cookieOptions.maxAge` in `lib/auth.js`.
- **Idempotent payments**: `fulfillPayment()` in `lib/payments/fulfill.js` uses a unique
  index on `Payment.providerTxId` so duplicate webhooks (which Stripe/PayPal will send) can't
  double-credit a user.
- **Forum** uses `updatedAt` to bump threads to the top on reply — no separate `lastPostAt`
  column needed.
- **Monster activity** is denormalized lightly: `MonsterKill.killerName` is stored as a
  string so the kill record survives if the user is deleted.
