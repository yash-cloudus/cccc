-- Member self-service edits that need admin approval before they change the
-- directory. Surfaced on Registration queue → "Update requests" and counted on
-- the dashboard as "Pending update requests".
CREATE TABLE `profileupdaterequest` (
  `id` varchar(191) NOT NULL,
  `communityId` varchar(191) NOT NULL,
  `familyId` varchar(191) NULL,
  `memberId` varchar(191) NULL,
  `requestedBy` varchar(191) NULL,
  `changes` longtext NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `rejectReason` text NULL,
  `submittedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `reviewedAt` datetime(3) NULL,
  `reviewedBy` varchar(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `profileupdaterequest_communityId_status_submittedAt_idx` (`communityId`, `status`, `submittedAt`),
  INDEX `profileupdaterequest_familyId_idx` (`familyId`),
  INDEX `profileupdaterequest_memberId_idx` (`memberId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `profileupdaterequest`
  ADD CONSTRAINT `profileupdaterequest_communityId_fkey`
    FOREIGN KEY (`communityId`) REFERENCES `community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `profileupdaterequest_familyId_fkey`
    FOREIGN KEY (`familyId`) REFERENCES `family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `profileupdaterequest_memberId_fkey`
    FOREIGN KEY (`memberId`) REFERENCES `familymember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
