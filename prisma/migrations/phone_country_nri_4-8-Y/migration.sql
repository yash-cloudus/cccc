-- Phone numbers gain a country, and members gain an NRI (living-abroad) answer.
--
-- APPLY BY HAND — see prisma/migrations/auth_mode_4-8-Y/migration.sql for why
-- `migrate deploy` and `db push` are both wrong on this project:
--
--   npx prisma db execute --file prisma/migrations/phone_country_nri_4-8-Y/migration.sql \
--     --schema prisma/schema.prisma
--
-- A number is now stored as (ISO country, national digits) in two columns. A
-- dial code glued onto the front of a number cannot be taken apart again — +1 is
-- the United States, Canada and a dozen Caribbean states — so the country has to
-- be kept, not derived.
--
-- Every new column defaults to 'in'. Every row that exists today is an Indian
-- number entered under the old 10-digit rule, so the default IS the backfill:
-- no UPDATE is needed and no row changes meaning.

-- AlterTable — login identity
ALTER TABLE `User`
    ADD COLUMN `mobileIso` VARCHAR(191) NOT NULL DEFAULT 'in';

-- The login is the country AND the number now. Ten digits alone name two
-- different people once members live abroad, so the old unique is replaced
-- rather than added to.
DROP INDEX `User_communityId_mobile_key` ON `User`;
CREATE UNIQUE INDEX `User_communityId_mobileIso_mobile_key` ON `User`(`communityId`, `mobileIso`, `mobile`);

-- AlterTable — a member's own number, their WhatsApp number, and where they live
ALTER TABLE `FamilyMember`
    ADD COLUMN `mobileIso` VARCHAR(191) NOT NULL DEFAULT 'in',
    ADD COLUMN `whatsappIso` VARCHAR(191) NOT NULL DEFAULT 'in',
    ADD COLUMN `isNri` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `nriCountry` VARCHAR(191) NULL,
    ADD COLUMN `nriCity` VARCHAR(191) NULL;

-- Powers the NRI directory, which lists members abroad grouped by country.
CREATE INDEX `FamilyMember_isNri_nriCountry_idx` ON `FamilyMember`(`isNri`, `nriCountry`);

-- AlterTable — the household's elder contact and its chosen login number
ALTER TABLE `Family`
    ADD COLUMN `nativeElderIso` VARCHAR(191) NOT NULL DEFAULT 'in',
    ADD COLUMN `loginMobileIso` VARCHAR(191) NOT NULL DEFAULT 'in';
