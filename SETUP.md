# NarxTop — setup guide

## 1. Install and run

```bash
npm install
cp .env.example .env.local     # then fill in your own keys
npm run server                 # terminal 1 → API + MongoDB (port 5000)
npm run dev                    # terminal 2 → website (http://127.0.0.1:5173)
```

Open the site at **http://127.0.0.1:5173** (the Vite config binds to 127.0.0.1).
The website also works if the API server is off — it then uses the texts
bundled in `shared/translations.js`.

## 2. Supabase — fixes the "error page" after confirming your email

The confirm button in the email is handled by **Supabase**, not by your code.
If the address it redirects to is not on Supabase's allow-list, you get an error page.

Supabase Dashboard → **Authentication → URL Configuration**

| Field | Value |
|-------|-------|
| Site URL | `http://127.0.0.1:5173` (later: your real domain) |
| Redirect URLs | `http://127.0.0.1:5173/**`  ·  `http://localhost:5173/**`  ·  `https://YOUR-DOMAIN/**` |

Also check **Authentication → Email Templates → Confirm signup**: the button link must
use `{{ .ConfirmationURL }}`.

The app sends users to `/auth/confirm`, which shows "Email confirmed", counts down
5 seconds and closes itself. If the browser refuses to close the tab
(browsers only allow `window.close()` on tabs opened by a script), the page goes to the
website instead. Opening `/auth/confirm` again later shows "already confirmed" and
redirects to the home page.

Supabase's built-in email sender is rate-limited (a few emails per hour). For real
traffic add your own SMTP server: **Project Settings → Authentication → SMTP**.

## 3. Google sign-in (needs YOUR Google credentials)

1. Google Cloud Console → **APIs & Services → OAuth consent screen** → configure the app.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized redirect URI: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
3. Supabase → **Authentication → Providers → Google** → enable, paste the
   **Client ID** and **Client Secret**, save.
4. Make sure the Redirect URLs from step 2 are set (Google returns to `/`).

The code is already in place (`signInWithGoogle` in `src/context/AuthContext.jsx`) —
the button works as soon as the provider is enabled.

## 4. Languages in MongoDB

On start, `server/index.js` copies every text from `shared/translations.js` into the
`translations` collection (one document per language: `uz`, `ru`). The website loads
them from `GET /api/translations/:lang`. To change a text without redeploying, edit it
in MongoDB (keys use `|` instead of `.`, e.g. `nav|home`) — note that the next server
start re-seeds keys that exist in `shared/translations.js`, so edit that file too for
permanent changes.

## 5. Notes

- Guests (not signed in) see a "register to continue" card instead of products,
  product pages, cart and search.
- Cart is saved per user in the browser (`localStorage`).
- The old Mongo-based login (`MongoAuthContext`, `server/auth.js`) was removed: it was
  never connected (`server/auth.js` was a copy of `index.js`). Supabase handles all auth.

---

# NarxTop platform — added in the full upgrade

## 4. Database setup (Supabase)
Run `supabase/schema.sql` once in **SQL Editor**. It creates `user_state` (favorites, lists, purchases,
alerts, preferences — row-level security: users see only their own rows), `shared_lists` (public read by id,
owner write) and the `avatars` storage bucket. Without it the app still works, storing user data only in
the browser (the account page shows "stored on this device only").

For **Connect Google / Disconnect** in Account → Security enable *Authentication → Providers → Allow manual linking*.

## 5. Real product data (supermarket adapters)
```
partner API → adapter (shared/adapters) → normalization → canonical product → MongoDB (products, offers, price_history, stores)
```
1. Set `KORZINKA_API_URL` / `HAVAS_API_URL` / `MAKRO_API_URL` (+ key) in `.env.local`.
2. Map the partner's field names with `*_PRODUCT_MAP` / `*_STORE_MAP` (JSON, dotted paths). Defaults are
   `id, name, price, old_price, in_stock, stock, store_id, unit, image, category, barcode, promos, updated_at`.
   Required per product: id, name, price > 0 and an `updated_at` timestamp — rows without them are **rejected, never repaired**.
3. Ingest: `INGEST_INTERVAL_MINUTES=30` or `curl -X POST -H "x-ingest-token: …" http://127.0.0.1:5000/api/ingest/korzinka`.
   The response lists matched / created / rejected counts and rejection reasons. Ambiguous matches go to `match_review`.
4. Promotions (`promos`) must be `{type:"multibuy",minQty,unitPrice}`, `{type:"percent",minQty,percent}`,
   `{type:"bundle",qty,price}` or `{type:"amount",minQty,off}`.
5. Store records need `lat`/`lng`; branches without coordinates are ignored by the map and nearest-store logic.
6. To support another supermarket add one line to `PARTNERS` in `shared/adapters/index.js` (or write a custom adapter implementing the interface documented in `shared/adapters/base.js`).

Without a configured adapter the site shows an error state in production. In development it falls back to the
bundled demo file and shows a **demo data** banner (`VITE_ALLOW_FIXTURE`).

## 6. Maps and routes
Set a routing provider in `.env.local` (see `.env.example`): OSRM-compatible servers or OpenRouteService.
Travel times, route alternatives (fastest / shortest / alternative, up to 5) and route-aware Smart Basket
all come from that provider. **Public transport is not offered** by OSRM/ORS, so it is shown as unavailable.
No provider → distances/times are simply not shown; nothing is estimated. User location stays in the browser tab
(sessionStorage) and is never sent to the server.

## 7. Intelligence & tests
Pure logic lives in `shared/core` (search/matching, units, promotions, optimizer, price intelligence,
recommendations, analytics, geo) and is covered by `npm test`. `npm run check:i18n` verifies that every
text key used in the UI exists in Uzbek and Russian.

## 8. Not implemented (extension points only)
Receipt OCR, receipt-to-cart matching, recipe-to-basket, AI assistant, nutrition-aware optimization, e-mail/push
delivery of alerts (alerts are in-app), global co-purchase mining from other users' baskets,
inflation analytics. Hook points: `shared/core/analytics.js` (purchase log schema), `shared/adapters` (data in),
`user_state.purchases` (receipts would write here).

## 5. Profile photos in MongoDB

Photos are saved in the `avatars` collection (one document per user, `_id` = Supabase user id) by
`server/avatar.js` — `GET/PUT/DELETE /api/avatar`, authenticated with the user's Supabase token.
The server only needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (already in `.env.local`).
Restart `npm run server` after updating. The browser resizes photos to 256 px before upload.


## Contact page and e-mail

`/contact` (button in the footer, also in the phone menu) works for guests and signed-in users.
Signed-in users send only the message; their name and e-mail come from the verified account.
Guests type a name and e-mail. Each message is saved in MongoDB (`contact_messages`) and e-mailed
to the admin with Reply-To set to the sender, so **Reply** in Gmail answers the user.

1. `npm install` (adds `nodemailer`).
2. Add `SMTP_USER`, `SMTP_PASS` (Gmail App Password) and `CONTACT_TO` to `.env.local` (see `.env.example`).
3. Restart `npm run server`. The log says whether e-mail is enabled.

Texts live in `shared/translations.contact.js`. Phone styles live in `src/styles/mobile.css`.

## Admin panel (/admin)

1. In **`.env.local`** add your Gmail (several: separate with commas):
   ```
   VITE_ADMIN_GMAIL=you@gmail.com
   ```
   Restart `npm run dev` and `npm run server` after changing it. Sign in to the site with that Gmail →
   an **Admin** link appears in the navbar (and in the avatar menu). Nobody else sees it, and every
   `/api/admin/*` call is checked again on the server against the same list (the account's e-mail must be confirmed).
2. **Products → MongoDB.** On the first server start, if the `products` collection is empty,
   `src/data/products.json` is imported automatically. You can also run `npm run seed`
   (adds only what is missing) or `npm run seed -- --force` (refreshes everything in the file),
   or press **products.json import** in the panel. After that the website reads products from MongoDB only.
3. In the panel you can add / edit / delete products and their store prices. Changes are written to MongoDB
   (`products`, `offers`, `price_history`) and show up on the public site immediately.
   Prices that come from supermarket APIs (ingestion) are shown with a lock and are not edited by hand.
4. **Users**: everyone who signs in is saved to the MongoDB `users` collection. People who registered earlier can be pulled
   in with **Supabase'dan import** — that needs `SUPABASE_SERVICE_ROLE_KEY` in the server's `.env.local` (never in the browser).

### Admin panel — what's new (v3)

Sections (sidebar, or the top bar on phones): **Boshqaruv** (dashboard), **Mahsulotlar**, **Foydalanuvchilar**,
**Xabarlar** (contact-form inbox), **Faollik** (who changed what), **Sozlamalar**.

- **Products**: search, category/sort/stock filters, list or card view, select several → change category, mark in/out of stock,
  delete; duplicate a product; open it on the site; CSV export; editor with live card preview, price history, `Ctrl+S` to save.
- **Image check**: *Rasmlarni tekshirish* makes the **server** test every product image address and lets you blank the dead ones.
  A dead image URL is what shows up as `404` in the browser console (the browser always logs failed image loads itself),
  so clearing/replacing those addresses is the real fix. Settings → *Ro‘yxatlarda rasmlarni yuklash* can also turn remote thumbnails off.
- **Messages**: read/unread, reply by e-mail, delete, CSV export, unread badge in the sidebar.
- **Look & feel** (Settings): light/dark, 6 accent colours, corner style, density, list/card view, compact sidebar, animations on/off.
  Stored in this browser only (`narxtop_admin_prefs`).
- **Shortcuts**: `N` new product · `/` search · `1`–`6` switch section · `Esc` close.

**404s / "Server eski versiyada"**: after updating the code, **restart `npm run server`**. The panel compares its API version with
`/api/health` and shows a banner (and a status light in the sidebar) when the server is not running, is outdated, or MongoDB is down.
Unknown `/api/*` paths now answer JSON instead of an HTML error page.

Tests: `npm test` (includes `server/__tests__/adminRoutes.test.js`, which runs every admin route against an in-memory database).
