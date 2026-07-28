import "dotenv/config";
import { PrismaClient, BloodGroupType, CommunityType, CommunityStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedRelationshipDefaults } from "@/lib/constants";
import { seedOccupationDefaults } from "@/lib/occupation-defaults";

const prisma = new PrismaClient();

// Gujarati helpers (unicode escapes keep the file ASCII-safe)
const GU = {
  saurashtraPatel: "\u0AB6\u0ACD\u0AB0\u0AC0 \u0AB8\u0ACC\u0AB0\u0ABE\u0AB7\u0ACD\u0A9F\u0ACD\u0AB0 \u0AAA\u0A9F\u0AC7\u0AB2 \u0AB8\u0AAE\u0ABE\u0A9C",
  shri: "\u0AB6\u0ACD\u0AB0\u0AC0",
  motaZinzuda: "\u0AAE\u0ACB\u0A9F\u0ABE \u0A9D\u0AC0\u0A82\u0A9D\u0AC1\u0AA1\u0ABE \u0A97\u0ABE\u0AAE",
  mo: "\u0AAE\u0ACB",
  savaliya: "\u0AB8\u0AB5\u0ABE\u0AB2\u0ABF\u0AAF\u0ABE",
  nasit: "\u0AA8\u0AB8\u0AC0\u0A9F",
  desai: "\u0AA6\u0AC7\u0AB8\u0ABE\u0A88",
  patel: "\u0AAA\u0A9F\u0AC7\u0AB2",
  gajera: "\u0A97\u0A9C\u0AC7\u0AB0\u0ABE",
  surat: "\u0AB8\u0AC1\u0AB0\u0AA4",
  rajkot: "\u0AB0\u0ABE\u0A9C\u0A95\u0ACB\u0A9F",
  ahmedabad: "\u0A85\u0AAE\u0AA6\u0ABE\u0AB5\u0ABE\u0AA6",
  gujarat: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4",
  bharat: "\u0AAD\u0ABE\u0AB0\u0AA4",
  president: "\u0AAA\u0ACD\u0AB0\u0AAE\u0AC1\u0A96",
  secretary: "\u0AAE\u0A82\u0AA4\u0ACD\u0AB0\u0AC0",
  treasurer: "\u0A96\u0A9C\u0ABE\u0A82\u0A9A\u0AC0",
  member: "\u0AB8\u0AAD\u0ACD\u0AAF",
  mukhyaSamiti: "\u0AAE\u0AC1\u0A96\u0ACD\u0AAF \u0AB8\u0AAE\u0ABF\u0AA4\u0ABF",
  patotsav: "\u0AAA\u0ABE\u0A9F\u0ACB\u0AA4\u0ACD\u0AB8\u0AB5 \u0AA4\u0ABE. 15 \u0AA8\u0ABE \u0AB0\u0ACB\u0A9C \u0A89\u0A9C\u0AB5\u0ABE\u0AB6\u0AC7",
  patotsavBody: "\u0AB8\u0AB0\u0ACD\u0AB5 \u0AB8\u0AAD\u0ACD\u0AAF\u0ACB\u0AA8\u0AC7 \u0AAA\u0ABE\u0A9F\u0ACB\u0AA4\u0ACD\u0AB8\u0AB5 \u0AAE\u0ABE\u0A9F\u0AC7 \u0A86\u0AAE\u0A82\u0AA4\u0ACD\u0AB0\u0ABF\u0AA4 \u0A95\u0AB0\u0AB5\u0ABE\u0AAE\u0ABE\u0A82 \u0A86\u0AB5\u0AC7 \u0A9B\u0AC7.",
  aboutTitle: "\u0AB8\u0A82\u0AB8\u0ACD\u0AA5\u0ABE\u0AA8\u0AC0 \u0AAE\u0ABE\u0AB9\u0ABF\u0AA4\u0AC0",
};

async function upsertRole(name: string, description: string) {
  return prisma.role.upsert({ where: { name }, update: {}, create: { name, description } });
}

async function ensureUserRole(userId: string, roleId: string) {
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

async function main() {
  // ---------- Global RBAC ----------
  const roleNames: [string, string][] = [
    ["PLATFORM_ADMIN", "Platform owner (Cloudus) — manages all communities"],
    ["OWNER", "Community owner — full access to their community"],
    ["DATA_MANAGER", "Manage families and registrations"],
    ["CONTENT_MANAGER", "Manage news, gallery, ads"],
    ["MODERATOR", "Approve queue and moderate"],
    ["ADMIN", "General community admin"],
    ["MEMBER", "Community member"],
  ];
  const roles: Record<string, string> = {};
  for (const [name, description] of roleNames) {
    const r = await upsertRole(name, description);
    roles[name] = r.id;
  }

  const permissions: [string, string, string][] = [
    ["communities.read", "Platform", "Read communities"],
    ["communities.write", "Platform", "Create/manage communities"],
    ["users.read", "Users", "Read users"],
    ["users.write", "Users", "Write users"],
    ["families.read", "Families", "Read families"],
    ["families.write", "Families", "Write families"],
    ["families.approve", "Families", "Approve registrations"],
    ["news.write", "News", "Manage news"],
    ["gallery.write", "Gallery", "Manage gallery"],
    ["ads.write", "Ads", "Manage ads"],
    ["results.write", "Results", "Manage result drive"],
    ["settings.write", "Settings", "Manage settings"],
  ];
  const permIds: Record<string, string> = {};
  for (const [key, module, name] of permissions) {
    const p = await prisma.permission.upsert({ where: { key }, update: {}, create: { key, module, name } });
    permIds[key] = p.id;
  }

  // OWNER -> all community permissions (not platform-level)
  for (const key of Object.keys(permIds)) {
    if (key.startsWith("communities.")) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles.OWNER, permissionId: permIds[key] } },
      update: {},
      create: { roleId: roles.OWNER, permissionId: permIds[key] },
    });
  }
  // PLATFORM_ADMIN -> platform permissions
  for (const key of ["communities.read", "communities.write", "users.read"]) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles.PLATFORM_ADMIN, permissionId: permIds[key] } },
      update: {},
      create: { roleId: roles.PLATFORM_ADMIN, permissionId: permIds[key] },
    });
  }

  // ---------- Blood groups (global lookup) ----------
  const bloodGroups: [BloodGroupType, string][] = [
    ["A_POS", "A+"], ["A_NEG", "A-"], ["B_POS", "B+"], ["B_NEG", "B-"],
    ["O_POS", "O+"], ["O_NEG", "O-"], ["AB_POS", "AB+"], ["AB_NEG", "AB-"],
  ];
  for (const [type, label] of bloodGroups) {
    await prisma.bloodGroup.upsert({ where: { type }, update: {}, create: { type, label } });
  }

  // ---------- Platform admin (Cloudus) ----------
  const platformPwd = await bcrypt.hash("Cloudus@2026", 10);
  let platform = await prisma.user.findFirst({ where: { isPlatformAdmin: true, username: "cloudus" } });
  if (!platform) {
    platform = await prisma.user.create({
      data: {
        communityId: null,
        mobile: "9000000000",
        username: "cloudus",
        passwordHash: platformPwd,
        isPlatformAdmin: true,
        status: "APPROVED",
      },
    });
  } else {
    platform = await prisma.user.update({ where: { id: platform.id }, data: { passwordHash: platformPwd, status: "APPROVED" } });
  }
  await ensureUserRole(platform.id, roles.PLATFORM_ADMIN);

  // ================= Community A: Saurashtra Patel Samaj (Parivar) =================
  const communityA = await prisma.community.upsert({
    where: { slug: "saurashtra_patel" },
    update: { status: "LIVE" },
    create: {
      slug: "saurashtra_patel",
      nameEn: "Shree Saurashtra Patel Samaj",
      nameGu: GU.saurashtraPatel,
      logoText: GU.shri,
      type: CommunityType.PARIVAR,
      status: CommunityStatus.LIVE,
      primaryColor: "#A62A38",
      secondaryColor: "#E8A33D",
      groupingLabel: "Surname",
      estd: "1978",
      village: GU.rajkot,
      addressEn: "Saurashtra Patel Bhavan, Kalawad Road",
      taluka: GU.rajkot,
      district: GU.rajkot,
      state: GU.gujarat,
      country: GU.bharat,
      pincode: "360005",
      contactPhone: "98252 11223",
      whatsapp: "98252 11223",
      email: "info@sspsamaj.org",
      website: "www.sspsamaj.org",
      mapUrl: "https://maps.google.com/?q=Rajkot",
      descEn: "For the all-round development of the community — promoting education, healthcare and social unity.",
    },
  });

  await seedCommunityData(communityA.id, {
    ownerUsername: "saurashtra_patel_admin",
    ownerMobile: "9876543210",
    ownerPassword: "Samaj@2026",
    pendingMobile: "9988776655",
  });

  // ================= Community B: Mota Zinzuda Gam (Gam) =================
  const communityB = await prisma.community.upsert({
    where: { slug: "mota_zinzuda" },
    update: { status: "LIVE" },
    create: {
      slug: "mota_zinzuda",
      nameEn: "Mota Zinzuda Gam",
      nameGu: GU.motaZinzuda,
      logoText: GU.mo,
      type: CommunityType.GAM,
      status: CommunityStatus.LIVE,
      primaryColor: "#1E7A54",
      secondaryColor: "#E0A62B",
      groupingLabel: "Village",
      estd: "1990",
      village: GU.rajkot,
      state: GU.gujarat,
      country: GU.bharat,
      addressEn: "Mota Zinzuda, Ta. Gondal, Rajkot",
      descEn: "A village community platform connecting families of Mota Zinzuda.",
    },
  });

  await seedCommunityData(communityB.id, {
    ownerUsername: "mota_zinzuda_admin",
    ownerMobile: "9111111111",
    ownerPassword: "Samaj@2026",
    pendingMobile: "9222222222",
    minimal: true,
  });

  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log("Main Admin:              username 'cloudus' / Cloudus@2026");
  console.log("  -> http://localhost:3000  (prod: https://community.in)");
  console.log("Community A website:     http://saurashtra_patel.localhost:3000");
  console.log("Community A admin:       username 'saurashtra_patel_admin' / Samaj@2026");
  console.log("  -> http://admin.saurashtra_patel.localhost:3000");
  console.log("Community A member OTP:  mobile 9876543210, dev OTP 1234");
  console.log("Community B admin:       username 'mota_zinzuda_admin' / Samaj@2026");
  console.log("  -> http://admin.mota_zinzuda.localhost:3000");
  console.log("--------------------------------------------------");
}

async function seedCommunityData(
  communityId: string,
  opts: { ownerUsername: string; ownerMobile: string; ownerPassword: string; pendingMobile: string; minimal?: boolean },
) {
  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: "OWNER" } });
  const memberRole = await prisma.role.findUniqueOrThrow({ where: { name: "MEMBER" } });

  // Surname groups
  const surnameDefs = [
    { nameEn: "Savaliya", nameGu: GU.savaliya, sortOrder: 1 },
    { nameEn: "Nasit", nameGu: GU.nasit, sortOrder: 2 },
    { nameEn: "Desai", nameGu: GU.desai, sortOrder: 3 },
    { nameEn: "Patel", nameGu: GU.patel, sortOrder: 4 },
    { nameEn: "Gajera", nameGu: GU.gajera, sortOrder: 5 },
  ];
  const surnames: Record<string, string> = {};
  for (const s of surnameDefs) {
    let g = await prisma.surnameGroup.findFirst({ where: { communityId, nameEn: s.nameEn } });
    if (!g) g = await prisma.surnameGroup.create({ data: { ...s, communityId } });
    surnames[s.nameEn] = g.id;
  }

  // Villages
  const villageDefs = [
    { nameEn: "Surat", nameGu: GU.surat, showPhones: true },
    { nameEn: "Rajkot", nameGu: GU.rajkot, showPhones: true },
    { nameEn: "Ahmedabad", nameGu: GU.ahmedabad, showPhones: false },
  ];
  const villages: Record<string, string> = {};
  for (const v of villageDefs) {
    let g = await prisma.villageArea.findFirst({ where: { communityId, nameEn: v.nameEn } });
    if (!g) g = await prisma.villageArea.create({ data: { ...v, communityId } });
    villages[v.nameEn] = g.id;
  }

  // Dropdown masters — relationship + nested occupation tree
  await seedRelationshipDefaults(prisma, communityId);
  await seedOccupationDefaults(prisma, communityId);

  // Business category for seed data = Vepar child "Jewellery"
  const veparRoot = await prisma.dropdownOption.findFirst({
    where: { communityId, type: "occupation", parentId: null, nameEn: "Vepar (Business)" },
  });
  const jewelleryCat = veparRoot
    ? await prisma.dropdownOption.findFirst({
        where: { communityId, type: "occupation", parentId: veparRoot.id, nameEn: "Jewellery" },
      })
    : null;

  // Community owner/admin (also a member: username+password AND mobile+OTP)
  const ownerPwd = await bcrypt.hash(opts.ownerPassword, 10);
  const owner = await prisma.user.upsert({
    where: { communityId_mobile: { communityId, mobile: opts.ownerMobile } },
    update: { username: opts.ownerUsername, passwordHash: ownerPwd, status: "APPROVED" },
    create: {
      communityId,
      mobile: opts.ownerMobile,
      username: opts.ownerUsername,
      passwordHash: ownerPwd,
      status: "APPROVED",
    },
  });
  await ensureUserRole(owner.id, ownerRole.id);
  await ensureUserRole(owner.id, memberRole.id);

  await prisma.profile.upsert({
    where: { userId: owner.id },
    update: {},
    create: {
      userId: owner.id,
      fullNameEn: "Alpeshbhai Kanubhai Savaliya",
      fullNameGu: "\u0A86\u0AB2\u0ACD\u0AAA\u0AC7\u0AB6\u0AAD\u0ABE\u0A88 \u0A95\u0AA8\u0AC1\u0AAD\u0ABE\u0A88",
      relation: "Head",
      bloodGroup: "B_POS",
      occupation: "Vepar (Business)",
      education: null,
      isHead: true,
      showPhone: true,
      currentlyAt: "Surat",
    },
  });

  // Approved family (linked to owner)
  let family = await prisma.family.findFirst({ where: { communityId, headNameEn: "Alpeshbhai Kanubhai" } });
  if (!family) {
    family = await prisma.family.create({
      data: {
        communityId,
        surnameGroupId: surnames["Savaliya"],
        villageAreaId: villages["Surat"],
        headUserId: owner.id,
        headNameEn: "Alpeshbhai Kanubhai",
        headNameGu: "\u0A86\u0AB2\u0ACD\u0AAA\u0AC7\u0AB6\u0AAD\u0ABE\u0A88 \u0A95\u0AA8\u0AC1\u0AAD\u0ABE\u0A88",
        surnameEn: "Savaliya",
        surnameGu: GU.savaliya,
        addressEn: "12 Ring Road, Surat",
        city: "Surat",
        status: "APPROVED",
        approvedAt: new Date(),
        consentAccepted: true,
        familyMembers: {
          create: [
            { fullNameEn: "Alpeshbhai Kanubhai Savaliya", relation: "Head", mobile: opts.ownerMobile, bloodGroup: "B_POS", occupation: "Vepar (Business)", occupationOther: "Textiles", currentlyAt: "Surat", isHead: true },
            { fullNameEn: "Nitaben Alpeshbhai Savaliya", relation: "Wife", bloodGroup: "A_POS", occupation: "Homemaker", currentlyAt: "Surat" },
            { fullNameEn: "Harsh Alpeshbhai Savaliya", relation: "Son", bloodGroup: "B_POS", occupation: "Student", education: "Std 10", currentlyAt: "Surat" },
          ],
        },
      },
    });
    await prisma.profile.update({ where: { userId: owner.id }, data: { familyId: family.id } });
  }

  // Surname coordinator
  await prisma.surnameCoordinator.upsert({
    where: { surnameGroupId: surnames["Savaliya"] },
    update: {},
    create: { surnameGroupId: surnames["Savaliya"], memberName: "Alpeshbhai Kanubhai", memberMobile: opts.ownerMobile, showContact: true },
  });

  // Pending registration + pending user
  const pendingExists = await prisma.family.findFirst({ where: { communityId, status: "PENDING" } });
  if (!pendingExists) {
    await prisma.family.create({
      data: {
        communityId,
        surnameGroupId: surnames["Desai"],
        headNameEn: "Rameshbhai Maganbhai",
        surnameEn: "Desai",
        surnameGu: GU.desai,
        addressEn: "Near Bus Stand, Rajkot",
        city: "Rajkot",
        status: "PENDING",
        consentAccepted: true,
        familyMembers: { create: [{ fullNameEn: "Rameshbhai Maganbhai Desai", relation: "Head", mobile: opts.pendingMobile, isHead: true, bloodGroup: "O_POS" }] },
      },
    });
    await prisma.user.upsert({
      where: { communityId_mobile: { communityId, mobile: opts.pendingMobile } },
      update: {},
      create: { communityId, mobile: opts.pendingMobile, status: "PENDING" },
    });
  }

  // Settings (feature flags default)
  await prisma.setting.upsert({
    where: { communityId_key: { communityId, key: "ad_banner_price" } },
    update: {},
    create: { communityId, key: "ad_banner_price", value: "2000" },
  });

  if (opts.minimal) return;

  // ---- Rich content for the flagship community ----
  const newsCount = await prisma.news.count({ where: { communityId } });
  if (newsCount === 0) {
    await prisma.news.createMany({
      data: [
        { communityId, titleEn: "Patotsav to be celebrated on the 15th", titleGu: GU.patotsav, contentEn: "All members are invited for Patotsav celebrations.", contentGu: GU.patotsavBody, isPinned: true, accent: "#8E2230", publishedAt: new Date("2026-07-02") },
        { communityId, titleEn: "Annual Snehmilan — registration open", titleGu: "\u0AB5\u0ABE\u0AB0\u0ACD\u0AB7\u0ABF\u0A95 \u0AB8\u0ACD\u0AA8\u0AC7\u0AB9\u0AAE\u0ABF\u0AB2\u0AA8", contentEn: "Register your family for the annual gathering.", accent: "#3D6B8C", publishedAt: new Date("2026-06-28") },
      ],
    });
  }

  const adCount = await prisma.advertisement.count({ where: { communityId } });
  if (adCount === 0) {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    await prisma.advertisement.createMany({
      data: [
        { communityId, name: "Patel Jewellers", pitch: "100% making charges free this festive season", type: "premium", source: "user", payStatus: "verified", startDate: start, endDate: end, status: "ACTIVE", priority: 3, views: 412, clicks: 36 },
        { communityId, name: "Shivam Motors", pitch: "Special Samaj discount on new bikes", type: "general", source: "admin", startDate: start, endDate: end, status: "ACTIVE", priority: 2, views: 390, clicks: 21 },
        { communityId, name: "Annapurna Farsan", pitch: "Fresh farsan · home delivery on orders", type: "general", source: "user", startDate: start, endDate: end, status: "ACTIVE", priority: 1, views: 280, clicks: 18 },
      ],
    });
  }

  const drive = await prisma.resultDrive.findFirst({ where: { communityId, year: 2026 } });
  if (!drive) {
    await prisma.resultDrive.create({ data: { communityId, titleEn: "Results 2026", titleGu: "\u0AAA\u0AB0\u0ABF\u0AA3\u0ABE\u0AAE 2026", year: 2026, isOpen: true } });
  }

  // Committee + designations + members
  const committee = await prisma.committee.findFirst({ where: { communityId, nameEn: "Main Committee" } });
  if (!committee) {
    const created = await prisma.committee.create({ data: { communityId, nameEn: "Main Committee", nameGu: GU.mukhyaSamiti } });
    const commMembers = [
      { roleEn: "President", roleGu: GU.president, nameOverride: "Gordhanbhai Kanubhai Savaliya", nameGu: "\u0A97\u0ACB\u0AB0\u0AA7\u0AA8\u0AAD\u0ABE\u0A88 \u0A95\u0AA8\u0AC1\u0AAD\u0ABE\u0A88 \u0AB8\u0AB5\u0ABE\u0AB2\u0ABF\u0AAF\u0ABE", phoneOverride: "98765 43210", whatsapp: "98765 43210", email: "president@sspsamaj.org", showContact: true, sortOrder: 1 },
      { roleEn: "Vice President", roleGu: "\u0A89\u0AAA\u0AAA\u0ACD\u0AB0\u0AAE\u0AC1\u0A96", nameOverride: "Maganbhai Vallabhbhai Nasit", nameGu: "\u0AAE\u0A97\u0AA8\u0AAD\u0ABE\u0A88 \u0AB5\u0AB2\u0ACD\u0AB2\u0AAD\u0AAD\u0ABE\u0A88 \u0AA8\u0AB8\u0AC0\u0A9F", phoneOverride: "98241 55667", showContact: true, sortOrder: 2 },
      { roleEn: "Secretary", roleGu: GU.secretary, nameOverride: "Jayantibhai Mohanbhai Desai", nameGu: "\u0A9C\u0AAF\u0A82\u0AA4\u0ABF\u0AAD\u0ABE\u0A88 \u0AAE\u0ACB\u0AB9\u0AA8\u0AAD\u0ABE\u0A88 \u0AA6\u0AC7\u0AB8\u0ABE\u0A88", phoneOverride: "99251 33445", whatsapp: "99251 33445", showContact: true, sortOrder: 3 },
      { roleEn: "Treasurer", roleGu: GU.treasurer, nameOverride: "Rameshbhai Dhirubhai Gajera", nameGu: "\u0AB0\u0AAE\u0AC7\u0AB6\u0AAD\u0ABE\u0A88 \u0AA7\u0AC0\u0AB0\u0AC1\u0AAD\u0ABE\u0A88 \u0A97\u0A9C\u0AC7\u0AB0\u0ABE", phoneOverride: "97250 88776", showContact: false, sortOrder: 4 },
    ];
    for (const m of commMembers) {
      await prisma.committeeMember.create({ data: { communityId, committeeId: created.id, ...m } });
    }
  }

  // Info sections
  const infoCount = await prisma.infoSection.count({ where: { communityId } });
  if (infoCount === 0) {
    await prisma.infoSection.createMany({
      data: [
        { communityId, titleEn: "Our Purpose", titleGu: "\u0AB8\u0AAE\u0ABF\u0AA4\u0ABF\u0AA8\u0ACB \u0AB9\u0AC7\u0AA4\u0AC1", bodyEn: "Formed for the all-round development of the community — education, healthcare and social unity.", sortOrder: 1 },
        { communityId, titleEn: "Community History", titleGu: "\u0AB8\u0AAE\u0ABE\u0A9C\u0AA8\u0ACB \u0A87\u0AA4\u0ABF\u0AB9\u0ABE\u0AB8", bodyEn: "Established in 1978 in Rajkot; grown from a few families to thousands of members.", sortOrder: 2 },
        { communityId, titleEn: "Community Rules", titleGu: "\u0AA8\u0ABF\u0AAF\u0AAE\u0ACB", bodyEn: "General rules for membership, registration and assistance.", sortOrder: 3 },
      ],
    });
  }

  await prisma.cmsPage.upsert({
    where: { communityId_slug: { communityId, slug: "about" } },
    update: {},
    create: {
      communityId,
      slug: "about",
      titleEn: "About the Samaj",
      titleGu: GU.aboutTitle,
      contentEn: "Shree Saurashtra Patel Samaj brings families together with a living directory, news, and community services.",
    },
  });

  const album = await prisma.galleryAlbum.findFirst({ where: { communityId } });
  if (!album) {
    await prisma.galleryAlbum.create({
      data: {
        communityId,
        titleEn: "Patotsav 2025",
        titleGu: "\u0AAA\u0ABE\u0A9F\u0ACB\u0AA4\u0ACD\u0AB8\u0AB5 2025",
        description: "Community celebration photos",
        startDate: new Date("2025-12-15"),
        endDate: new Date("2025-12-17"),
        accent: "#8E2230",
        coverUrl: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800",
        images: {
          create: [
            { imageUrl: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800", caption: "Opening" },
            { imageUrl: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800", caption: "Gathering" },
          ],
        },
      },
    });
  }

  const biz = await prisma.business.findFirst({ where: { communityId, nameEn: "Patel Jewellers" } });
  if (!biz) {
    await prisma.business.create({
      data: {
        communityId,
        userId: owner.id,
        familyId: family.id,
        categoryId: jewelleryCat?.id ?? null,
        nameEn: "Patel Jewellers",
        nameGu: "\u0AAA\u0A9F\u0AC7\u0AB2 \u0A9C\u0ACD\u0AAF\u0AC1\u0AB5\u0AC7\u0AB2\u0AB0\u0ACD\u0AB8",
        description: "Gold and silver jewellery",
        phone: opts.ownerMobile,
        address: "Main Market, Surat",
        city: "Surat",
        isApproved: true,
        isVisible: true,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
