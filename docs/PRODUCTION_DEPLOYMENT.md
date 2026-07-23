# Production Deployment Guide

## Checklist

1. **Secrets** — replace all placeholders in `.env`
2. **`AUTH_BYPASS=false`**
3. **`OTP_DEV_MODE=false`**
4. **`COOKIE_SECURE=true`** (HTTPS only)
5. Strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `CSRF_SECRET` (32+ chars)
6. Managed MySQL with SSL if required
7. Configure Cloudinary, SMTP, Razorpay, FCM

## Build & run (Node host)

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run start
```

## Docker

```bash
docker compose up --build -d
```

Run seed once inside the app container if needed:

```bash
docker compose exec app npx tsx prisma/seed.ts
```

## Reverse proxy (Nginx example)

```nginx
server {
  listen 443 ssl;
  server_name samaj.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Post-deploy

- Create first admin via seed or promote a member in Admin → Admins & roles
- Turn off demo OTP
- Verify security headers on responses
- Monitor `/api/health`
