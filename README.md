# Reneo Live

Secure live-commerce MVP where sellers broadcast a product over Agora while customers watch, chat, inspect the featured product, and add it to a cart.

## Features

### Seller
- Sign up / sign in with seller role
- Create products with image upload
- View own products
- Start a live session for a product
- Broadcast camera + microphone (Agora host)
- Mute/unmute, camera on/off, switch camera, fullscreen
- End live
- Receive realtime chat

### Customer
- Sign up / sign in with customer role
- Browse active live sessions
- Join as Agora audience (never publishes A/V)
- LIVE indicator, seller name, viewer count (Agora channel presence)
- Featured product + in-page product drawer
- Add to cart, change quantity, remove, cart total
- Send/receive realtime chat

## Technology stack

- React + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Supabase Auth / PostgreSQL / Storage / Realtime / Edge Functions
- Agora RTC Web SDK (`agora-rtc-sdk-ng`)
- React Context + hooks
- localStorage cart persistence
- Vercel-compatible static production build

## Project structure

```text
src/
  components/     # UI, live stage, chat, cart helpers, product drawer
  contexts/       # AuthContext, CartContext
  hooks/          # useAuth, useCart, useAgora, useLive, useChat
  lib/            # supabase client, agora helpers, formatters
  pages/          # route screens
  routes/         # ProtectedRoute, RoleRoute
  services/       # products, live, chat API wrappers
  types/          # shared domain types
supabase/
  migrations/     # schema + RLS + storage policies
  functions/
    agora-token/  # server-side Agora RTC token generation
```

## Architecture

```text
React Client
|
+-- Supabase Auth
|
+-- PostgreSQL
|     |
|     +-- Profiles
|     +-- Products
|     +-- Live Sessions
|     +-- Messages
|
+-- Supabase Storage          (product images)
|
+-- Supabase Realtime         (chat + live status updates)
|
+-- Supabase Edge Function
|     |
|     +-- Agora Token Generation
|
+-- Agora RTC                 (audio/video media plane)
```

### Why Agora for media and Supabase for app data?

Agora is purpose-built for low-latency realtime audio/video: publishing tracks, audience subscribe, device controls, and channel presence. Supabase covers identity, relational data, RLS enforcement, object storage, and postgres-backed realtime chat/status. Keeping media off the app database avoids forcing WebRTC through Postgres and keeps each system doing what it is good at.

### Why a product drawer instead of navigation?

Leaving `/lives/:id` would risk tearing down the Agora client/subscription (or at least complicate lifecycle). An in-page drawer keeps the live route mounted so video, audio, and chat continue while the customer inspects the product.

## Database schema

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | equals `auth.users.id` |
| name | text | required |
| avatar | text | nullable |
| role | text | `seller` \| `customer` |
| created_at | timestamptz | |

### `products`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| seller_id | uuid FK → profiles | forced to `auth.uid()` on insert |
| name, description | text | length-checked |
| price | numeric | `> 0` |
| image_url | text | nullable |
| stock | int | `>= 0` |
| status | text | `active` \| `inactive` |
| created_at | timestamptz | |

### `live_sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| host_id | uuid FK → profiles | forced to `auth.uid()` on insert |
| product_id | uuid FK → products | must be owned + active |
| status | text | `scheduled` \| `live` \| `ended` |
| created_at / ended_at | timestamptz | |

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| live_id | uuid FK → live_sessions | |
| user_id | uuid FK → profiles | forced to `auth.uid()` on insert |
| message | text | 1–500 chars |
| created_at | timestamptz | |

Relationships: profile → products / live_sessions / messages; product → live_sessions; live_session → messages.

## RLS & security model

RLS is enabled on all app tables. Frontend role checks are UX only — the database rejects unauthorized writes.

Key guarantees:
- Sellers can only mutate their own products (`seller_id = auth.uid()`), and triggers overwrite/forbid spoofed `seller_id`.
- Only the host can update/end their live session; triggers forbid host/product changes and non-host updates.
- Message inserts always set `user_id = auth.uid()` — clients cannot impersonate another user.
- Customers may read products needed for live shopping; they cannot modify live sessions.
- Product images upload only under `product-images/{auth.uid()}/...`.
- Agora App Certificate never ships in the frontend. Tokens are minted by the `agora-token` Edge Function after auth + live ownership/access checks.
- Customers join Agora with role `audience` and never call publish APIs.

SQL source of truth: `supabase/migrations/20260326000001_init.sql`.

## Agora architecture & token flow

```text
Seller/Customer React app
  → supabase.functions.invoke('agora-token', { liveId, role })
  → Edge Function validates JWT, profile, live status, host permission
  → builds RTC token with AGORA_APP_CERTIFICATE (server secret)
  → returns { token, appId, channel, uid, role }
  → AgoraRTC client joins channel
```

- Seller: `setClientRole('host')` → create mic/cam tracks → `publish`
- Customer: `setClientRole('audience')` → subscribe only
- Channel name: `live_{liveIdWithoutDashes}`
- Token TTL: 1 hour

## Environment variables

Copy `.env.example` to `.env` (never commit `.env`):

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AGORA_APP_ID=
```

Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets):

```bash
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## Local development

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/20260326000001_init.sql` (SQL editor or CLI).
3. Deploy the Edge Function `supabase/functions/agora-token` and set secrets above.
4. Create an Agora project; put App ID in frontend env and App ID + Certificate in function secrets.
5. Install and run:

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run typecheck
npm run lint
npm run build
```

Production output is static (`dist/`) and deploys cleanly to Vercel.

## Security audit checklist

- [x] No service-role key in frontend
- [x] No Agora certificate in frontend / `VITE_` vars / git
- [x] `.env` gitignored; `.env.example` placeholders only
- [x] RLS enabled on profiles, products, live_sessions, messages
- [x] Ownership enforced for products + live sessions
- [x] `user_id` / `seller_id` / `host_id` cannot be spoofed (triggers + RLS)
- [x] Token generation is server-side and session-aware
- [x] Customer Agora path never publishes tracks

## Known limitations

- Viewer count uses Agora channel presence (`remoteUsers + 1`). Pure audience peers may be under/over counted depending on Agora live-mode visibility; it is not a fabricated number, but it is not full analytics-grade occupancy.
- No checkout/payment.
- No moderation tools for chat.
- Product image bucket is public-read (URL-addressable) with seller-scoped write policies.
- Email confirmation behavior depends on your Supabase Auth settings.
- Large Agora SDK increases the main bundle; code-splitting is a natural next step.

## Manual test plan

### Seller happy path
Login → create product → upload image → Go Live → publish A/V → chat → End live

### Customer happy path
Login → find live → join → watch → chat → View product drawer → add to cart → change qty → remove → observe live ending

### Security scenarios (must fail at DB / token layer)
1. Seller A updates Seller B’s product → rejected by RLS
2. Seller A deletes Seller B’s product → rejected by RLS
3. Seller A ends Seller B’s live → rejected by RLS/trigger
4. Message insert with another `user_id` → overwritten/rejected (`auth.uid()`)
5. Customer Agora publish → not invoked by app; host-role token denied for non-hosts

## Part C answers

### 1. What breaks first at ~500 concurrent customers on one live?

Most likely **realtime chat fan-out and client render cost**, then Agora connection/subscribe load.

- Every chat insert is replicated to subscribers. At hundreds of viewers with chatty rooms, Realtime and browser message lists become hot.
- Rendering a growing unbounded message array on every client will jank.
- Agora can scale media better than a naive chat UI, but each client still maintains an RTC connection.
- Viewer count via `remoteUsers` is not a scalable analytics signal.

What I would change:
- Paginate/window chat (last N messages), virtualize the list
- Rate-limit sends; consider presence channels separate from message history
- Move fan-out heavy chat to a dedicated system if needed (or broadcast-only rooms)
- Use Agora Analytics / RTM / a presence table for accurate occupancy
- CDN + edge caching for product payloads; keep live status updates coarse

### 2. What I did not finish / next two days

Honest gaps:
- End-to-end verification against a real Supabase + Agora project in this environment (secrets are placeholders by design)
- Agora SDK code-splitting / route-level lazy loading for smaller first paint
- Stronger automated RLS regression tests (e.g. pgTAP or scripted API checks)
- Seller product edit/delete UI (API/RLS already support ownership-scoped delete)
- Richer reconnect UX for Agora + Realtime flaps

With two more days: wire real project secrets, run two-browser E2E, add RLS test scripts, lazy-load Agora, and polish mobile live controls.

### 3. Library / AI assistance I relied on

I used the **Agora RTC Web SDK** and **Supabase JS/Edge runtime** rather than inventing WebRTC signaling, token cryptography, or auth session plumbing. Afterwards I verified the important seams myself: audience never publishes, tokens are minted only after live/host checks, and ownership is enforced with RLS + triggers (not UI gates). For token minting I used the maintained `agora-token` package inside the Edge Function instead of hand-rolling the binary token format.

## License

Private assessment project.
