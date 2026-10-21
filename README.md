# QuickBite — Vercel + PostgreSQL

This version keeps the existing QuickBite UI and adds a Node.js serverless backend connected to a real PostgreSQL database. It does not require installing Java or Maven locally.

## Database tables

The API creates these relational tables automatically when `/api/health` or `/api/state` is called:

- `qb_customers`
- `qb_restaurants`
- `qb_food_items`
- `qb_discounts`
- `qb_orders`
- `qb_order_items`
- `qb_payments`
- `qb_deliveries`
- `qb_reviews`

They use primary keys, foreign keys, unique constraints, check constraints and indexes. The existing browser UI still maintains a local cache for responsiveness, but save/load operations also use the backend when PostgreSQL is configured.

## Deploy on Vercel

1. Upload the contents of this folder to the GitHub repository used by your Vercel project. Keep `index.html`, `package.json`, `vercel.json`, `api/`, and `lib/` at the repository root.
2. In Vercel, open the `quickbite` project → **Settings → Environment Variables**.
3. Add the PostgreSQL connection string as `POSTGRES_URL` or `DATABASE_URL`. Use the standard PostgreSQL connection string provided by your database provider. Do not use a Prisma Accelerate URL such as `prisma+postgres://...` in `pg`; use the standard `postgres://` or `postgresql://` URL.
4. Apply the variable to **Production** (and Preview if needed), save, then redeploy.
5. Open `https://YOUR-QUICKBITE-DOMAIN/api/health`. Expected response: `{"ok":true,"database":"PostgreSQL","tablesReady":true}`.
6. Open the website and make a test change. Check the response from `/api/state` in browser DevTools → Network, then open the database's SQL editor and inspect the `qb_*` tables.

## Notes

- The first request creates the schema automatically. If the database is empty, the website's initial sample state is saved to the database.
- This coursework version stores each save by replacing the current application tables inside a transaction. It is useful for a single-demo/single-operator project, but it is not designed for many users editing at the same time or for production without authentication and per-user authorization.
- The UI keeps `localStorage` as a browser cache. The cloud database is the source loaded at startup whenever the backend is configured and contains data.
- Never paste database credentials into public code or share them in screenshots.
