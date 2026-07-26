-- Advertisements admin needs the two lifecycle states the prototype exposes as
-- filter chips but the enum did not carry: DEACTIVATED (admin took a live ad
-- down) and DRAFT (created but not yet submitted/published).
ALTER TABLE `advertisement`
  MODIFY `status` ENUM('PENDING','ACTIVE','EXPIRED','REJECTED','DEACTIVATED','DRAFT')
  NOT NULL DEFAULT 'PENDING';
