-- AlterTable
ALTER TABLE `ResultEntry` ADD COLUMN `memberId` VARCHAR(191) NULL,
    ADD COLUMN `stream` VARCHAR(191) NULL,
    ADD COLUMN `course` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ResultEntry_driveId_memberId_idx` ON `ResultEntry`(`driveId`, `memberId`);

-- AddForeignKey
ALTER TABLE `ResultEntry` ADD CONSTRAINT `ResultEntry_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `FamilyMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
