-- Phase 2 of "every number carries its country": the numbers outside the
-- household — a business, a committee member, an advertiser, the community's
-- own contact line, and a surname coordinator.
--
-- APPLY BY HAND — see prisma/migrations/auth_mode_4-8-Y/migration.sql for why
-- `migrate deploy` and `db push` are both wrong on this project:
--
--   npx prisma db execute --file prisma/migrations/phone_country_phase2_4-8-Y/migration.sql \
--     --schema prisma/schema.prisma
--
-- Same shape as phase 1: the digits stay where they are, the country moves into
-- its own column, and the default 'in' IS the backfill — every row that exists
-- today was entered under the old India-only rule.
--
-- These are nullable (unlike User.mobileIso) because the numbers they describe
-- are themselves optional; a business with no phone has no country either.

-- AlterTable — the community's own contact and WhatsApp lines
ALTER TABLE `Community`
    ADD COLUMN `contactPhoneIso` VARCHAR(191) NULL DEFAULT 'in',
    ADD COLUMN `whatsappIso` VARCHAR(191) NULL DEFAULT 'in';

-- AlterTable — a listed business
ALTER TABLE `Business`
    ADD COLUMN `phoneIso` VARCHAR(191) NULL DEFAULT 'in',
    ADD COLUMN `whatsappIso` VARCHAR(191) NULL DEFAULT 'in';

-- AlterTable — a committee member's published contact
ALTER TABLE `CommitteeMember`
    ADD COLUMN `phoneIso` VARCHAR(191) NULL DEFAULT 'in',
    ADD COLUMN `whatsappIso` VARCHAR(191) NULL DEFAULT 'in';

-- AlterTable — whoever placed the advertisement
ALTER TABLE `Advertisement`
    ADD COLUMN `ownerMobileIso` VARCHAR(191) NULL DEFAULT 'in';

-- AlterTable — the surname group's coordinator. NOT NULL, because the number
-- it describes is itself required.
ALTER TABLE `SurnameCoordinator`
    ADD COLUMN `memberMobileIso` VARCHAR(191) NOT NULL DEFAULT 'in';

-- AlterTable — the community's own WhatsApp sender number (ARTHIX). The number
-- is provider config rather than a contact, but it is still a phone number, so
-- it carries its country like every other one.
ALTER TABLE `CommunityIntegration`
    ADD COLUMN `waSenderIso` VARCHAR(191) NULL DEFAULT 'in';
