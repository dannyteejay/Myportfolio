# Portfolio & Admin CMS

A full-stack portfolio website for showcasing **software** and **web design** work,
with a complete **admin dashboard** to add / edit / delete everything on the public
site — projects, digital products (store), skills, profile and contact messages.

Built with the requested stack:

| Layer          | Tech                                                        |
| -------------- | ---------------------------------------------------------- |
| Frontend       | React + TypeScript, Tailwind CSS, TanStack Query, Framer Motion |
| Routing        | React Router                                               |
| Backend        | Node.js, Express, TypeScript                               |
| Database       | PostgreSQL + Prisma ORM                                    |
| Real-time      | Socket.IO (public site + admin stay in sync live)         |
| Auth           | JWT access tokens + httpOnly refresh-token rotation        |
| Files          | Local uploads in dev (swap for Cloudinary / S3 in prod)   |
| Payments       | Paystack (digital product checkout)                       |
| Deployment     | Vercel (client) + Render/Railway (server + Postgres)      |

---

## Project structure

```
portfolio/
├── server/            # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── routes/    # auth, projects, products, skills, profile, messages, uploads, payments
│   │   ├── auth.ts    # JWT + refresh token logic
│   │   ├── realtime.ts# Socket.IO
│   │   └── index.ts   # server entry
│   └── uploads/       # uploaded images (dev)
└── client/            # React + Vite SPA
    └── src/
        ├── pages/          # public pages
        ├── pages/admin/    # admin dashboard
        ├── components/     # UI + admin UI kit
        ├── hooks/          # useAuth, queries (TanStack Query), realtime
        └── lib/            # api client, types, socket, formatting
```

## Getting started (local)

### 1. Database
Create a PostgreSQL database and set `DATABASE_URL` in `server/.env`
(see `server/.env.example`).

### 2. Backend
```bash
cd server
npm install
npx prisma db push       # create tables
npm run seed             # create admin user + demo content
npm run dev              # http://localhost:4000
```

### 3. Frontend
```bash
cd client
npm install
npm run dev              # http://localhost:5173  (proxies /api to :4000)
```

### Default admin login
```
Email:    admin@portfolio.dev
Password: Admin123!
```
> Change these via `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding in production,
> and set strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` values.

## Admin dashboard
Visit `/admin/login`. From the dashboard you can fully manage:
- **Projects** – software & web design case studies (cover image, tags, live/repo links, featured, publish/draft)
- **Products** – digital products for the store (price, currency, cover, download link)
- **Skills** – with proficiency levels
- **Payments** – gateways, bank details, and all customer orders
- **Profile** – name, title, bio, socials, résumé — powers the whole public site
- **Messages** – submissions from the contact form (read / reply / delete)

All changes broadcast over Socket.IO, so open the public site in another tab and
watch it update live.

## Payments — 4 gateways
The store supports **Paystack**, **Flutterwave**, **Cryptocurrency** (via NOWPayments)
and **direct bank transfer**. Every gateway degrades gracefully: if its key isn't set,
it runs in a safe **demo mode** so the app always works.

Manage everything from **Admin → Payments**:
- Toggle which gateways appear at checkout
- Set your **bank transfer** details + instructions (buyer sees them + a reference)
- Edit the crypto note
- View all **orders**, mark bank/crypto orders as **paid**, cancel or delete them
- See revenue and pending totals

### Enable live payments
Add the relevant keys to `server/.env` (see `.env.example`):

| Gateway      | Env vars                                                        | Webhook URL (set in provider dashboard)     |
| ------------ | -------------------------------------------------------------- | ------------------------------------------- |
| Paystack     | `PAYSTACK_SECRET_KEY`                                           | `/api/payments/webhook/paystack`            |
| Flutterwave  | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`           | `/api/payments/webhook/flutterwave`         |
| Crypto       | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`                | `/api/payments/webhook/crypto`              |
| Bank         | *(none — configure account details in Admin → Payments)*        | —                                           |

Also set `APP_URL` to your public site URL so redirect callbacks land on
`/payment/callback`. Card & crypto payments redirect to the provider's hosted
checkout, then back to your site where the order is verified.

## File uploads
In development, images are stored under `server/uploads/` and served at `/uploads/*`.
For production, replace the logic in `server/src/routes/uploads.ts` with a Cloudinary
or S3 upload and return the CDN URL — the rest of the app already expects a URL.

## Deployment
- **Client → Vercel:** set `VITE`-style rewrites or a reverse proxy so `/api` and
  `/socket.io` reach your API host. Build command `npm run build`, output `dist`.
- **Server → Render / Railway:** deploy `server/`, provision PostgreSQL, set env vars,
  run `prisma migrate deploy` then `node dist/index.js`.
- Set `CLIENT_ORIGIN` on the server to your deployed client URL for CORS + cookies,
  and serve both over HTTPS so the refresh cookie (`secure`) works.

## Tech notes
- **Auth:** short-lived JWT access token in memory + long-lived rotating refresh
  token in an httpOnly cookie. The API client auto-refreshes on 401.
- **Data fetching:** TanStack Query with a small typed hook layer (`hooks/queries.ts`).
- **Validation:** Zod on every write endpoint.
