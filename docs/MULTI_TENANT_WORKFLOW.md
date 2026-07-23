# Multi-Community Workflow (Simple Guide)

This guide explains how **Main Admin**, **Community Admin**, and the **member website** work together — and how **one MySQL database** keeps every community’s data separate.

---

## Who does what?

| Role | Person example | Where they work | What they do |
|------|----------------|-----------------|--------------|
| **Main Admin** | Cloudus | `community.in` | Creates communities (apps) on the platform |
| **Community Admin** | Samaj owner / data manager | `admin.{slug}.community.in` | Manages **one** community only |
| **Member** | Family in the samaj | `{slug}.community.in` | Login, directory, news, gallery, business… |

---

## Big picture (one community)

When Main Admin creates a community, the platform creates **two domains**:

1. **Website / App** — for members  
2. **Community Admin Panel** — for that community’s admins  

Example:

| Field | Value |
|-------|--------|
| Name (Gujarati) | શ્રી સૌરાષ્ટ્ર પટેલ સમાજ |
| Name (English) | Shree Saurashtra Patel Samaj |
| Slug | `saurashtra_patel` |
| Website | `saurashtra_patel.community.in` |
| Admin panel | `admin.saurashtra_patel.community.in` |

```text
Cloudus (Main Admin)
        │
        ▼
   community.in
        │
        │  Create community
        ▼
┌───────────────────────────────────────┐
│  Community row in database            │
│  slug: saurashtra_patel               │
└───────────────────────────────────────┘
        │
        ├──────────────► Website (members)
        │                saurashtra_patel.community.in
        │
        └──────────────► Community Admin Panel
                         admin.saurashtra_patel.community.in
```

**Database:** no extra tables for domains. Only `Community.slug` is stored. Hostnames are built from the slug + root domain.

---

## What the URLs mean

| URL | Role |
|-----|------|
| `community.in` | Main Admin Panel |
| `saurashtra_patel.community.in` | Member website |
| `admin.saurashtra_patel.community.in` | Community Admin Panel |

### Local URLs (same pattern — no hosts file needed)

Browsers resolve `*.localhost` → `127.0.0.1`. With `NEXT_PUBLIC_ROOT_DOMAIN=localhost`:

| Role | Local URL |
|------|-----------|
| Main Admin | http://localhost:3000 |
| Website | http://saurashtra_patel.localhost:3000 |
| Community Admin | http://admin.saurashtra_patel.localhost:3000 |

From Main Admin, **Open app** / **Open admin** jump to these hosts automatically.

---

## Step-by-step: create one community

1. Open **Main Admin** → `community.in` (or `localhost:3000`)
2. Login: `cloudus` / `Cloudus@2026`
3. **Create app** → fill name, type, colors, subdomain `saurashtra_patel`, first admin
4. Save → DB gets a `Community` row with that slug + owner user
5. Result:
   - Members: `saurashtra_patel.community.in`
   - Admins: `admin.saurashtra_patel.community.in` (username/password from the create modal)

---

## One database — how communities stay separate

One MySQL database. Every tenant table has `communityId`.  
Host → slug → `communityId` → all queries filtered. No cross-community data.

---

## Seed logins (local / demo)

After `npx prisma db seed`:

| Role | Username | Password | URL |
|------|----------|----------|-----|
| Main Admin | `cloudus` | `Cloudus@2026` | http://localhost:3000/platform/login |
| Community Admin (Saurashtra) | `saurashtra_patel_admin` | `Samaj@2026` | http://admin.saurashtra_patel.localhost:3000/admin/login |
| Community Admin (Mota Zinzuda) | `mota_zinzuda_admin` | `Samaj@2026` | http://admin.mota_zinzuda.localhost:3000/admin/login |

Members use **mobile + OTP** on the website host after a family is approved.

---

## Production DNS

Point wildcard DNS to this app:

- `community.in` → Main Admin  
- `*.community.in` → same app (member sites)  
- Also covers `admin.*.community.in` (Community Admin)

---

## Related docs

- [XAMPP setup](./XAMPP_SETUP.md)
- [Production deployment](./PRODUCTION_DEPLOYMENT.md)
- Main README: [`../README.md`](../README.md)
