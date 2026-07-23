# Integration Questions & Decisions

Integrating `final Community app` (HTML/JS/FRD prototype) into `community-app` (Next.js 15 + Prisma + MySQL).

This file records **decisions taken** (safe, inferred from the codebase + FRD) and **open questions** that need your confirmation. Implementation continues for everything that is clear.

---

## Architecture decision (taken): single DB, row-level multi-tenancy

- One MySQL database, shared schema, a `communityId` discriminator column on every tenant-owned table (matches the existing `docs/MULTI_TENANT_WORKFLOW.md` and the FRD "one community per app; data fully isolated per community").
- A new `Community` model = one "app" created by the Main Admin. `Community.slug` = subdomain (`{slug}.community.in`).
- Community Admin data scope comes from the **logged-in admin's `communityId` in the JWT**, never from the URL — so a community admin can never read another community's data even by editing the URL.

---

## Question 1
- Area: Database migration strategy
- Problem: How to add multi-tenancy without destroying data.
- What I found: `prisma migrate status` shows the `init` migration is **not yet applied** (empty DB). So there is no data to lose.
- Options: (a) Amend `init`; (b) Add a NEW incremental migration on top of `init`.
- Recommended option: (b) NEW migration `.._multi_tenant_community` — clean, incremental, matches your instructions. Tables are empty when it applies, so adding required `communityId` columns is safe.
- Decision required: None — proceeding with (b).

## Question 2
- Area: Which tables become tenant-scoped
- Problem: The schema has 44 models. Adding `communityId` to all of them (incl. peripheral/unused ones) is high-churn and risky.
- What I found: The active workflow + admin/member features touch ~20 core tables. Child tables (FamilyMember, Profile, GalleryImage, etc.) inherit tenancy through their parent, so they don't each need `communityId`.
- Options: (a) All 44; (b) Core 20 + children via parent.
- Recommended option: (b). Core scoped tables: `User`, `SurnameGroup`, `VillageArea`, `Family`, `DropdownOption`, `BusinessCategory`, `Business`, `NewsCategory`, `News`, `GalleryAlbum`, `Committee`, `CommitteeDesignation`, `CommitteeMember`, `ResultDrive`, `Advertisement`, `Setting`, `CmsPage`, `InfoSection` (new), `Institute`, `Education`. Peripheral (Payment, Donation, Notification, Event, Complaint, Feedback, Contact, Download, Scholarship, Blood* lookups) stay global for now.
- Decision required: Confirm peripheral tables can remain non-tenant until their features are built. (Proceeding with (b).)

## Question 3
- Area: Admin authentication method
- Problem: FRD says Community/Main Admins log in with **username + password** (no OTP), while members use **mobile + OTP**.
- What I found: Existing `User` has `passwordHash` (unused) and OTP flow only.
- Decision taken: Add `username` to `User` (unique per community) + reuse `passwordHash` (bcrypt). New `/admin/login` (community admin) and `/platform/login` (main admin) username/password routes. Members keep mobile+OTP. Platform admin = `User` with `communityId = null` + `isPlatformAdmin = true` + role `PLATFORM_ADMIN`.
- Decision required: None — proceeding.

## Question 4
- Area: Local dev tenant resolution (no real subdomains on `localhost`)
- Problem: `{slug}.community.in` subdomains don't exist on `localhost:3000`.
- Decision taken: Tenant resolves in priority order: (1) logged-in user's `communityId` (authoritative); (2) `active_community` cookie (set when Main Admin clicks "Open app/admin", and via `?c=<slug>`); (3) host subdomain (production); (4) first LIVE community (dev fallback). Production uses the real subdomain. Also `platform.community.in` → Main Admin.
- Decision required: Confirm production DNS is wildcard `*.community.in` → this app. (Proceeding; documented in `docs/MULTI_TENANT_WORKFLOW.md`.)

## Question 5
- Area: Scope of "connect every feature to DB" in one pass
- Problem: The prototype Admin panel has 11 large modules and the member app ~20 screens. Wiring 100% of every sub-feature (e.g. ad payment verification, result merit PDF, update-request diffs) to DB in a single change is very large.
- Decision taken: Deliver the full **connected spine** + all core modules on real scoped DB: Main Admin community CRUD + admin auth; Community Admin Dashboard, Registration Queue (approve/reject), Families & members, Dropdowns/masters, Community Info (committees + sections + village privacy), News, Gallery, Ads, Result drives, Admins & roles, Settings; plus the **entire member site** (Home, News, Directory chain, Business + add, Gallery, Results, Education, Blood group, Ads, About, Notifications, Profile, Donation) reading community-scoped DB data and community-themed.
- Decision required: None — prioritization delivered.

## Question 6
- Area: Donations / payments
- Problem: The prototype "Donate" screen shows a UPI QR + fires a fake success toast. There is no payment gateway wired and no per-community UPI field in the schema.
- What I found: `Donation` model (userId, amount, note, paymentId) + `/api/donations` POST exist and are session-scoped. `Razorpay` is a listed dependency but not integrated. `Community` has no `upiId`; `Setting` (communityId,key,value) can hold one.
- Options: (a) Full Razorpay order/verify flow; (b) Record the donation intent in `Donation` and deep-link to the community's UPI app when a `upiId` setting exists.
- Decision taken: (b) for now — `/donation` records a real `Donation` row via `/api/donations`, and if the community has a `Setting` `key="upiId"` it opens a `upi://pay` intent; otherwise it records the pledge and shows the community contact. Admin UI to set `upiId` and full Razorpay verification are staged.
- Decision required: Confirm whether Razorpay online capture is required for launch, and where the community's UPI id / QR should be managed (Settings screen).

## Question 7
- Area: Member self-service profile editing
- Problem: The prototype profile screen has an "Edit" button and a "show phone" toggle with no backend.
- Decision taken: Added session-scoped `/api/profile` (GET/PATCH). Members can persist `showPhone` and edit `occupation` / `currentlyAt` / `education`. Full self-edit of name/DOB/blood/relation is intentionally NOT member-editable (those changes flow through the admin registration/update-approval process to avoid unreviewed directory changes).
- Decision required: Confirm which additional fields (if any) members may self-edit without admin approval.

## Question 8
- Area: Domain / URL scheme
- Problem: User wants Main Admin on apex `community.in`, website on `{slug}.community.in`, and Community Admin on `admin.{slug}.community.in` (not `{slug}.community.in/admin`).
- What I found: Previous docs used `platform.community.in` + path `/admin`.
- Decision taken: Implemented host-based routing as requested. DB unchanged (only `Community.slug`). Local uses `localhost` / `{slug}.localhost` / `admin.{slug}.localhost` with `NEXT_PUBLIC_ROOT_DOMAIN=localhost`.
- Decision required: None — done.

---

## Remaining / staged sub-features (non-blocking)
(Updated as work proceeds.)

- Advertisements admin: create + status/priority/expiry wired; **online payment verification** (Razorpay capture) staged.
- Result drive admin: drive lifecycle + per-entry marks/approve/reject wired; **merit-list PDF export** staged.
- Donations: intent recorded + UPI deep-link wired; **admin UPI config** available under Community Info → Donations UPI ID. Razorpay capture still staged (see Q6).
- Push notifications: in-app notification feed wired; **FCM web push delivery** staged.
