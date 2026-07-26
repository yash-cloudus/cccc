# Database import — `community_app.sql`

Imported from `C:\Users\YASH\Downloads\community_app.sql` (phpMyAdmin dump,
MariaDB 10.4, generated 24 Jul 2026) into the local XAMPP MySQL at
`localhost:3306`.

## Schema changes on import: **NONE**

The dump's 56 tables matched `prisma/schema.prisma` exactly — no missing
table, no missing column, no type drift.

## Schema changes added afterwards: 2 (both already applied)

### 2. `profileupdaterequest` — new table

The Community Admin → Registration queue has an **Update requests** section
(and the dashboard a "Pending update requests" card) for member self-service
profile edits that need approval. No table existed for it.

Migration `prisma/migrations/20260726010000_profile_update_requests` creates
`profileupdaterequest` with `communityId` / `familyId` / `memberId` FKs (all
`ON DELETE CASCADE`), a `changes` LongText column holding a JSON array of
`{ field, label, from, to }`, and the shared `PENDING/APPROVED/REJECTED` enum.

Applying a request writes **only allow-listed columns** — see
`APPLIABLE_MEMBER_FIELDS` / `APPLIABLE_FAMILY_FIELDS` in
`app/api/admin/update-requests/route.ts`. Privileged columns (`isHead`,
`isDeceased`, `status`, …) can appear in the diff but are never written, so a
crafted request cannot escalate.

### 1. `AdStatus` — two new enum values

Building the Community Admin → Advertisements screen to match
`Admin.dc.html` needed two lifecycle states the enum did not carry. The
prototype shows **Deactivated** and **Draft** as status filter chips, but
`AdStatus` only had `PENDING · ACTIVE · EXPIRED · REJECTED`.

Migration `prisma/migrations/20260726000000_ad_status_deactivated_draft`:

```sql
ALTER TABLE `advertisement`
  MODIFY `status` ENUM('PENDING','ACTIVE','EXPIRED','REJECTED','DEACTIVATED','DRAFT')
  NOT NULL DEFAULT 'PENDING';
```

This is additive — no existing row changes value, nothing is dropped.
Already applied; `npx prisma migrate status` reports *"Database schema is up
to date!"* with 3 migrations.

**Nothing else needs adding.** In particular these were checked and found
sufficient as-is:

| Feature built | Storage used | Change needed |
|---|---|---|
| Settings (8 sections, 45 controls) | `Setting(communityId, key, value)`, key = `<section>.<item>` | none — generic key/value |
| Dropdown lists, 7 categories | `DropdownOption.type` is a free string, `isActive` already exists | none |
| Dropdown Surname / Business category | `SurnameGroup` / `BusinessCategory` own tables | none |
| Dropdown Blood group | `BloodGroup` (global 8-row lookup) | none — read-only by design |
| Advertisements table columns | `Advertisement` already had `type`, `source`, `category`, `ownerName`, `ownerMobile`, `views`, `clicks` | none |

If drift ever appears it will show up as a failing `npx prisma migrate
status`, and the fix is a new migration under `prisma/migrations/` — never a
hand-edited table.

## What was imported

| Table | Rows |
|---|---|
| `community` | 4 |
| `user` | 8 |
| `family` | 6 |
| `familymember` | 10 |
| `surnamegroup` | 15 |
| `villagearea` | 6 |
| `advertisement` | 3 |
| `news` | 2 |
| `business` | 1 |
| `galleryalbum` | 1 |
| `_prisma_migrations` | 3 |

### Communities

| Slug | Name | Type | Brand |
|---|---|---|---|
| `saurashtra_patel` | Shree Saurashtra Patel Samaj | PARIVAR | `#A62A38` maroon |
| `mota_zinzuda` | Mota Zinzuda Gam | GAM | `#1E7A54` **green** |
| `vavliya` | vavliya parivar | PARIVAR | `#A62A38` maroon |
| `khijadiya_radadiya` | khijadiya radadiya | GAM | `#A62A38` maroon |

`mota_zinzuda` is the useful one to test theming with — it is the only
community whose brand colour is not the default maroon.

## How it was imported

The target DB already existed with the schema applied but effectively no data
(3 throwaway `loginlog` rows). It was backed up first, then replaced:

```bash
mysqldump -u root --databases community_app > backup_community_app_before_import.sql
mysql -u root -e "DROP DATABASE community_app; \
  CREATE DATABASE community_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root --default-character-set=utf8mb4 community_app < community_app.sql
```

`--default-character-set=utf8mb4` matters — without it the Gujarati columns
(`nameGu`, `titleGu`, …) import as mojibake.

## Local sign-in credentials (from `prisma/seed.ts`)

| Panel | Host | Username / mobile | Password |
|---|---|---|---|
| Main Admin | `localhost:3000` | `cloudus` | `Cloudus@2026` |
| Community Admin | `admin.<slug>.localhost:3000` | `<slug>_admin` | `Samaj@2026` |
| Member app | `<slug>.localhost:3000` | `9876543210` | OTP `1234` (dev mode) |

OTP is in developer mode (`OTP_DEV_MODE=true`, `OTP_DEV_CODE=1234`) — no
WhatsApp/SMS is sent, matching the "atiyare WhatsApp/OTP reva de" decision.

## `DATABASE_URL` moved to `.env`

It used to live in `.env.local`. The Prisma CLI **cannot read `.env.local`**,
so every `npm run db:*` script failed with
`Environment variable not found: DATABASE_URL`.

Next.js reads both `.env` and `.env.local`; Prisma reads only `.env`. Putting
the connection string in `.env` therefore serves both with no duplicated
value. Everything else (JWT secrets, OTP, Cloudinary, SMTP, …) stays in
`.env.local`. Both files are covered by the `.env*` rule in `.gitignore`.
