# XAMPP Local Setup Guide

## Prerequisites

- Windows with [XAMPP](https://www.apachefriends.org/)
- Node.js 20+ (22 recommended)
- This repo’s `community-app` folder

## Steps

1. Install and open **XAMPP Control Panel**.
2. Click **Start** next to **MySQL**.
3. Click **Admin** (phpMyAdmin) or open `http://localhost/phpmyadmin`.
4. Create database:

```sql
CREATE DATABASE community_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

5. If MySQL root has a password, update `.env`:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/community_app"
```

Empty password (default XAMPP):

```env
DATABASE_URL="mysql://root:@localhost:3306/community_app"
```

6. From `community-app`:

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

7. Login with mobile `9876543210` and OTP `1234` (`OTP_DEV_MODE=true`).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Can't connect to MySQL` | Ensure MySQL is running in XAMPP; port 3306 free |
| Access denied | Set correct root password in `DATABASE_URL` |
| Charset issues | Use `utf8mb4` database collation |
| Prisma generate fails | Run `npx prisma generate` after `npm install` |
