-- Replace BusinessCategory master with Vepar (Business) DropdownOption children.
UPDATE `Business` SET `categoryId` = NULL;

-- Prisma default FK name; if this fails in some DBs, rename to match information_schema.
ALTER TABLE `Business` DROP FOREIGN KEY `Business_categoryId_fkey`;

DROP TABLE IF EXISTS `BusinessCategory`;

ALTER TABLE `Business`
  ADD CONSTRAINT `Business_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `DropdownOption`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
