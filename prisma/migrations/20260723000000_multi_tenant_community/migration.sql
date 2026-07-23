-- DropForeignKey
ALTER TABLE `committeemember` DROP FOREIGN KEY `CommitteeMember_committeeId_fkey`;

-- DropIndex
DROP INDEX `Advertisement_status_startDate_endDate_idx` ON `advertisement`;

-- DropIndex
DROP INDEX `Business_isApproved_isVisible_idx` ON `business`;

-- DropIndex
DROP INDEX `BusinessCategory_slug_key` ON `businesscategory`;

-- DropIndex
DROP INDEX `CmsPage_slug_key` ON `cmspage`;

-- DropIndex
DROP INDEX `CommitteeMember_committeeId_fkey` ON `committeemember`;

-- DropIndex
DROP INDEX `DropdownOption_type_idx` ON `dropdownoption`;

-- DropIndex
DROP INDEX `Family_status_idx` ON `family`;

-- DropIndex
DROP INDEX `News_isPinned_publishedAt_idx` ON `news`;

-- DropIndex
DROP INDEX `NewsCategory_slug_key` ON `newscategory`;

-- DropIndex
DROP INDEX `Setting_key_key` ON `setting`;

-- DropIndex
DROP INDEX `User_email_key` ON `user`;

-- DropIndex
DROP INDEX `User_mobile_key` ON `user`;

-- AlterTable
ALTER TABLE `advertisement` ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `communityId` VARCHAR(191) NOT NULL,
    ADD COLUMN `ownerMobile` VARCHAR(191) NULL,
    ADD COLUMN `ownerName` VARCHAR(191) NULL,
    ADD COLUMN `payStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    ADD COLUMN `rejectReason` TEXT NULL,
    ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'user',
    ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'general';

-- AlterTable
ALTER TABLE `business` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `businesscategory` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `cmspage` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `committee` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `committeedesignation` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `committeemember` ADD COLUMN `communityId` VARCHAR(191) NOT NULL,
    ADD COLUMN `descGu` TEXT NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `nameGu` VARCHAR(191) NULL,
    ADD COLUMN `photoUrl` VARCHAR(191) NULL,
    ADD COLUMN `roleEn` VARCHAR(191) NULL,
    ADD COLUMN `roleGu` VARCHAR(191) NULL,
    ADD COLUMN `showContact` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `whatsapp` VARCHAR(191) NULL,
    MODIFY `committeeId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `dropdownoption` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `education` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `family` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `galleryalbum` ADD COLUMN `accent` VARCHAR(191) NULL,
    ADD COLUMN `communityId` VARCHAR(191) NOT NULL,
    ADD COLUMN `isVisible` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `institute` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `news` ADD COLUMN `accent` VARCHAR(191) NULL,
    ADD COLUMN `communityId` VARCHAR(191) NOT NULL,
    ADD COLUMN `documentName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `newscategory` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `resultdrive` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `setting` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `surnamegroup` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `communityId` VARCHAR(191) NULL,
    ADD COLUMN `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `username` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `villagearea` ADD COLUMN `communityId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `Community` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameGu` VARCHAR(191) NULL,
    `logoText` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `bannerUrl` VARCHAR(191) NULL,
    `type` ENUM('PARIVAR', 'GAM') NOT NULL DEFAULT 'PARIVAR',
    `status` ENUM('DRAFT', 'LIVE', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#A62A38',
    `secondaryColor` VARCHAR(191) NOT NULL DEFAULT '#E8A33D',
    `groupingLabel` VARCHAR(191) NULL,
    `estd` VARCHAR(191) NULL,
    `village` VARCHAR(191) NULL,
    `addressEn` TEXT NULL,
    `addressGu` TEXT NULL,
    `taluka` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `mapUrl` VARCHAR(191) NULL,
    `descEn` TEXT NULL,
    `descGu` TEXT NULL,
    `settingsJson` LONGTEXT NULL,
    `showDirectoryPhones` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Community_slug_key`(`slug`),
    INDEX `Community_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InfoSection` (
    `id` VARCHAR(191) NOT NULL,
    `communityId` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NOT NULL,
    `titleGu` VARCHAR(191) NULL,
    `bodyEn` TEXT NULL,
    `bodyGu` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InfoSection_communityId_idx`(`communityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Advertisement_communityId_status_startDate_endDate_idx` ON `Advertisement`(`communityId`, `status`, `startDate`, `endDate`);

-- CreateIndex
CREATE INDEX `Business_communityId_isApproved_isVisible_idx` ON `Business`(`communityId`, `isApproved`, `isVisible`);

-- CreateIndex
CREATE INDEX `BusinessCategory_communityId_idx` ON `BusinessCategory`(`communityId`);

-- CreateIndex
CREATE UNIQUE INDEX `BusinessCategory_communityId_slug_key` ON `BusinessCategory`(`communityId`, `slug`);

-- CreateIndex
CREATE INDEX `CmsPage_communityId_idx` ON `CmsPage`(`communityId`);

-- CreateIndex
CREATE UNIQUE INDEX `CmsPage_communityId_slug_key` ON `CmsPage`(`communityId`, `slug`);

-- CreateIndex
CREATE INDEX `Committee_communityId_idx` ON `Committee`(`communityId`);

-- CreateIndex
CREATE INDEX `CommitteeDesignation_communityId_idx` ON `CommitteeDesignation`(`communityId`);

-- CreateIndex
CREATE INDEX `CommitteeMember_communityId_idx` ON `CommitteeMember`(`communityId`);

-- CreateIndex
CREATE INDEX `DropdownOption_communityId_type_idx` ON `DropdownOption`(`communityId`, `type`);

-- CreateIndex
CREATE INDEX `Education_communityId_idx` ON `Education`(`communityId`);

-- CreateIndex
CREATE INDEX `Family_communityId_status_idx` ON `Family`(`communityId`, `status`);

-- CreateIndex
CREATE INDEX `GalleryAlbum_communityId_idx` ON `GalleryAlbum`(`communityId`);

-- CreateIndex
CREATE INDEX `Institute_communityId_idx` ON `Institute`(`communityId`);

-- CreateIndex
CREATE INDEX `News_communityId_isPinned_publishedAt_idx` ON `News`(`communityId`, `isPinned`, `publishedAt`);

-- CreateIndex
CREATE INDEX `NewsCategory_communityId_idx` ON `NewsCategory`(`communityId`);

-- CreateIndex
CREATE UNIQUE INDEX `NewsCategory_communityId_slug_key` ON `NewsCategory`(`communityId`, `slug`);

-- CreateIndex
CREATE INDEX `ResultDrive_communityId_idx` ON `ResultDrive`(`communityId`);

-- CreateIndex
CREATE INDEX `Setting_communityId_idx` ON `Setting`(`communityId`);

-- CreateIndex
CREATE UNIQUE INDEX `Setting_communityId_key_key` ON `Setting`(`communityId`, `key`);

-- CreateIndex
CREATE INDEX `SurnameGroup_communityId_idx` ON `SurnameGroup`(`communityId`);

-- CreateIndex
CREATE INDEX `User_communityId_idx` ON `User`(`communityId`);

-- CreateIndex
CREATE UNIQUE INDEX `User_communityId_mobile_key` ON `User`(`communityId`, `mobile`);

-- CreateIndex
CREATE UNIQUE INDEX `User_communityId_username_key` ON `User`(`communityId`, `username`);

-- CreateIndex
CREATE UNIQUE INDEX `User_communityId_email_key` ON `User`(`communityId`, `email`);

-- CreateIndex
CREATE INDEX `VillageArea_communityId_idx` ON `VillageArea`(`communityId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Family` ADD CONSTRAINT `Family_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurnameGroup` ADD CONSTRAINT `SurnameGroup_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DropdownOption` ADD CONSTRAINT `DropdownOption_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VillageArea` ADD CONSTRAINT `VillageArea_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessCategory` ADD CONSTRAINT `BusinessCategory_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Business` ADD CONSTRAINT `Business_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Committee` ADD CONSTRAINT `Committee_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommitteeDesignation` ADD CONSTRAINT `CommitteeDesignation_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommitteeMember` ADD CONSTRAINT `CommitteeMember_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommitteeMember` ADD CONSTRAINT `CommitteeMember_committeeId_fkey` FOREIGN KEY (`committeeId`) REFERENCES `Committee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InfoSection` ADD CONSTRAINT `InfoSection_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NewsCategory` ADD CONSTRAINT `NewsCategory_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `News` ADD CONSTRAINT `News_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GalleryAlbum` ADD CONSTRAINT `GalleryAlbum_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Institute` ADD CONSTRAINT `Institute_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Education` ADD CONSTRAINT `Education_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultDrive` ADD CONSTRAINT `ResultDrive_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Advertisement` ADD CONSTRAINT `Advertisement_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Setting` ADD CONSTRAINT `Setting_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CmsPage` ADD CONSTRAINT `CmsPage_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

