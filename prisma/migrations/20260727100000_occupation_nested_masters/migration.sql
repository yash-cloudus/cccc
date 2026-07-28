-- Occupation nested masters: parentId tree + remove degree/standard flat masters.
ALTER TABLE `DropdownOption`
  ADD COLUMN `parentId` VARCHAR(191) NULL,
  ADD INDEX `DropdownOption_communityId_type_parentId_idx`(`communityId`, `type`, `parentId`),
  ADD CONSTRAINT `DropdownOption_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `DropdownOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM `DropdownOption` WHERE `type` IN ('degree', 'standard');
