# Community App (Samaj)

Full-stack **Next.js 15** community management app matching the approved HTML design screens and BRD.

- Member mobile app (Gujarati / English)
- Community admin panel
- MySQL + Prisma
- JWT + OTP login
- News, directory, business, gallery, blood group, education, results, ads, donations

**Multi-community workflow (Main Admin → create community → Admin + Website + one DB):**  
see [docs/MULTI_TENANT_WORKFLOW.md](docs/MULTI_TENANT_WORKFLOW.md)

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Shadcn UI · Prisma · MySQL · React Hook Form · Zod · Framer Motion · Lucide · Axios · JWT · Cloudinary · Nodemailer · FCM-ready · Razorpay

## Quick start (XAMPP MySQL)

### 1. Start MySQL (XAMPP)

1. Open **XAMPP Control Panel**
2. Start **Apache** (optional) and **MySQL**
3. Open phpMyAdmin → create database:

```sql
CREATE DATABASE community_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Default URL used by this project:

```text
mysql://root:@localhost:3306/community_app
```

### 2. Install & configure

```bash
cd community-app
npm install
copy .env.example .env
```

Edit `.env` if your MySQL password is not empty.

### 3. Migrate & seed

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Open:

| URL | Purpose |
|-----|---------|
| http://localhost:3000/login | Member login |
| http://localhost:3000/dashboard | Home (with `AUTH_BYPASS=true` or after OTP) |
| http://localhost:3000/admin | Community admin panel |
| http://localhost:3000/platform | Main Admin Panel (create Gam/Parivar apps) |

### Demo credentials

| Field | Value |
|-------|--------|
| Mobile | `9876543210` |
| OTP (dev) | `123456` when `OTP_DEV_MODE=true` |

## Auth notes

- Login is **OTP only** (WhatsApp / SMS) — no password for members/admins (matches BRD).
- JWT access + refresh tokens in **HttpOnly** cookies.
- Set `AUTH_BYPASS=false` before production.
- Admin routes require roles: `OWNER`, `DATA_MANAGER`, `CONTENT_MANAGER`, `MODERATOR`, or `ADMIN`.

## Project structure

```text
app/
  (auth)/          login, otp, register, pending
  dashboard/       home
  directory/       surname → families → profile
  business/        directory + detail + add
  news/ gallery/ blood-group/ education/ results/
  ads/ about/ donation/ notifications/ profile/ menu/
  admin/           full admin panel
  api/             REST route handlers
components/        UI + layout + admin shell
lib/               prisma, auth, security, i18n, demo data
prisma/            schema + seed + migrations
```

## Useful scripts

```bash
npm run dev          # development
npm run build        # production build
npm run start        # start production server
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed demo data
npm run db:studio    # Prisma Studio
```

## Docker

```bash
docker compose up --build
```

MySQL is exposed on `3306`, app on `3000`.

## Production deployment

1. Set strong `JWT_*`, `CSRF_SECRET`, and real SMTP / Cloudinary / Razorpay / FCM keys.
2. Set `AUTH_BYPASS=false`, `OTP_DEV_MODE=false`, `COOKIE_SECURE=true`.
3. Point `DATABASE_URL` to managed MySQL.
4. Run:

```bash
npx prisma migrate deploy
npm run db:seed   # optional first time
npm run build
npm run start
```

5. Put behind HTTPS (Nginx / Vercel / any Node host). Security headers are applied in `middleware.ts`.

## API overview

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/otp`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Families | `GET/POST/PATCH /api/families`, `GET/DELETE /api/families/:id` |
| News | `GET/POST /api/news`, `GET/PUT/DELETE /api/news/:id` |
| Business | `GET/POST /api/businesses` |
| Gallery | `GET/POST /api/gallery` |
| Ads | `GET/POST/PATCH /api/ads` |
| Blood | `GET /api/blood-donors` |
| Results | `GET/POST/PATCH /api/results` |
| Upload | `POST /api/upload` |
| Payments | `POST /api/payments/create-order` |
| Admin | `GET /api/admin/dashboard` |

All list endpoints support search / filter / sort / pagination query params where applicable.

## Design source of truth

UI matches the uploaded HTML prototypes under `Community app/*.dc.html` and the BRD document:

- Maroon header gradient `#A62A38 → #851F2B → #6E1824`
- Cream surfaces `#FBF8F2` / `#E4DACB`
- Bottom nav: Home · Directory · Business · News · Menu
- Admin window chrome + sidebar matching `Admin.dc.html`

## License

Private — for the community project owner.
