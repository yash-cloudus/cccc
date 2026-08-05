-- Organ Donation module — four new tables, nothing existing is touched.
--
-- APPLY BY HAND — see prisma/migrations/auth_mode_4-8-Y/migration.sql for why
-- `migrate deploy` and `db push` are both wrong on this project:
--
--   npx prisma db execute --file prisma/migrations/organ_donation_5-8-K/migration.sql \
--     --schema prisma/schema.prisma
--
-- Additive only: four CREATE TABLEs and their foreign keys. No column on an
-- existing table changes, so a running deploy that has not yet picked up the new
-- code keeps working — it simply never reads these tables.
--
-- Why one row per organ (`OrganPledge`) instead of a set column on the donor:
-- each organ is requested, approved and completed on its own clock. A household
-- that donated eyes in 2024 can still have a kidney available, and a single
-- status on the donor could not describe that.

-- CreateTable — a member who has pledged organs, as entered by their household
CREATE TABLE `OrganDonor` (
    `id` VARCHAR(191) NOT NULL,
    `communityId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `familyMemberId` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `fullNameEn` VARCHAR(191) NOT NULL,
    `fullNameGu` VARCHAR(191) NULL,
    `relation` VARCHAR(191) NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `bloodGroup` ENUM('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG', 'AB_POS', 'AB_NEG') NULL,
    `mobile` VARCHAR(191) NULL,
    `mobileIso` VARCHAR(191) NOT NULL DEFAULT 'in',
    `city` VARCHAR(191) NULL,
    `donationType` ENUM('LIVING', 'AFTER_DEATH', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `emergencyName` VARCHAR(191) NULL,
    `emergencyRelation` VARCHAR(191) NULL,
    `emergencyMobile` VARCHAR(191) NULL,
    `emergencyMobileIso` VARCHAR(191) NOT NULL DEFAULT 'in',
    `consentAccepted` BOOLEAN NOT NULL DEFAULT false,
    `consentSignature` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isDeceased` BOOLEAN NOT NULL DEFAULT false,
    `deceasedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganDonor_communityId_isDeceased_idx`(`communityId`, `isDeceased`),
    INDEX `OrganDonor_familyId_idx`(`familyId`),
    INDEX `OrganDonor_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable — one organ on one donor; the unit everything else hangs off
CREATE TABLE `OrganPledge` (
    `id` VARCHAR(191) NOT NULL,
    `donorId` VARCHAR(191) NOT NULL,
    `organ` ENUM('EYES', 'KIDNEY', 'LIVER', 'HEART', 'LUNG', 'SKIN', 'BONE', 'TISSUE') NOT NULL,
    `status` ENUM('AVAILABLE', 'REQUESTED', 'APPROVED', 'DONATED', 'NOT_DONATED', 'WITHDRAWN') NOT NULL DEFAULT 'AVAILABLE',
    `approvedRequestId` VARCHAR(191) NULL,
    `donatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganPledge_status_idx`(`status`),
    UNIQUE INDEX `OrganPledge_donorId_organ_key`(`donorId`, `organ`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable — a member asking for one pledged organ
CREATE TABLE `OrganRequest` (
    `id` VARCHAR(191) NOT NULL,
    `communityId` VARCHAR(191) NOT NULL,
    `pledgeId` VARCHAR(191) NOT NULL,
    `requesterUserId` VARCHAR(191) NULL,
    `requesterName` VARCHAR(191) NOT NULL,
    `requesterMobile` VARCHAR(191) NULL,
    `requesterMobileIso` VARCHAR(191) NOT NULL DEFAULT 'in',
    `patientName` VARCHAR(191) NULL,
    `hospital` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'NOT_SELECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganRequest_communityId_status_idx`(`communityId`, `status`),
    INDEX `OrganRequest_pledgeId_status_idx`(`pledgeId`, `status`),
    INDEX `OrganRequest_requesterUserId_idx`(`requesterUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable — append-only audit trail of pledge status changes
CREATE TABLE `OrganStatusLog` (
    `id` VARCHAR(191) NOT NULL,
    `pledgeId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('AVAILABLE', 'REQUESTED', 'APPROVED', 'DONATED', 'NOT_DONATED', 'WITHDRAWN') NULL,
    `toStatus` ENUM('AVAILABLE', 'REQUESTED', 'APPROVED', 'DONATED', 'NOT_DONATED', 'WITHDRAWN') NOT NULL,
    `actorKind` VARCHAR(191) NOT NULL DEFAULT 'family',
    `actorUserId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrganStatusLog_pledgeId_idx`(`pledgeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrganDonor` ADD CONSTRAINT `OrganDonor_communityId_fkey`
    FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrganDonor` ADD CONSTRAINT `OrganDonor_familyId_fkey`
    FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE: a donor row must outlive the member record it was
-- built from, so deleting a member never erases the donation history.
ALTER TABLE `OrganDonor` ADD CONSTRAINT `OrganDonor_familyMemberId_fkey`
    FOREIGN KEY (`familyMemberId`) REFERENCES `FamilyMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrganDonor` ADD CONSTRAINT `OrganDonor_createdByUserId_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrganPledge` ADD CONSTRAINT `OrganPledge_donorId_fkey`
    FOREIGN KEY (`donorId`) REFERENCES `OrganDonor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrganRequest` ADD CONSTRAINT `OrganRequest_communityId_fkey`
    FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrganRequest` ADD CONSTRAINT `OrganRequest_pledgeId_fkey`
    FOREIGN KEY (`pledgeId`) REFERENCES `OrganPledge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrganRequest` ADD CONSTRAINT `OrganRequest_requesterUserId_fkey`
    FOREIGN KEY (`requesterUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrganStatusLog` ADD CONSTRAINT `OrganStatusLog_pledgeId_fkey`
    FOREIGN KEY (`pledgeId`) REFERENCES `OrganPledge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
