-- Organ Donation: donation type moves from the donor to each pledged organ.
--
-- APPLY BY HAND — see prisma/migrations/auth_mode_4-8-Y/migration.sql for why
-- `migrate deploy` and `db push` are both wrong on this project:
--
--   npx prisma db execute --file prisma/migrations/organ_donation_per_organ_type_5-8-K/migration.sql \
--     --schema prisma/schema.prisma
--
-- Why: one answer per household could not describe the common real case — a
-- member offering a kidney while living but their eyes only after death. The
-- request flow reads exactly one donation type when deciding whether an organ
-- can be claimed now (see `canRequest`), so that value has to sit on the organ.
--
-- NOT additive: `OrganDonor.donationType` is dropped. The three statements below
-- MUST run in this order — the backfill reads the donor column, so dropping it
-- first would silently leave every organ on the DEFAULT 'BOTH' and quietly widen
-- after-death-only pledges into ones a recipient could request today.

-- AlterTable — the new per-organ answer. DEFAULT 'BOTH' only so the column can
-- be added NOT NULL to existing rows; every one of them is overwritten below.
ALTER TABLE `OrganPledge`
    ADD COLUMN `donationType` ENUM('LIVING', 'AFTER_DEATH', 'BOTH') NOT NULL DEFAULT 'BOTH';

-- Backfill — each organ inherits whatever its donor was set to, so nothing
-- visibly changes for records created before this split.
UPDATE `OrganPledge` `p`
    JOIN `OrganDonor` `d` ON `p`.`donorId` = `d`.`id`
    SET `p`.`donationType` = `d`.`donationType`;

-- DropColumn — the donor-level answer is now derived from its organs ("Mixed"
-- when they differ), never stored, so there is no second copy to fall out of
-- sync with the one the request flow actually reads.
ALTER TABLE `OrganDonor` DROP COLUMN `donationType`;
