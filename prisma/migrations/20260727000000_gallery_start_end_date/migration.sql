-- Event Gallery: albums now run start date -> end date instead of a single
-- date. Once `endDate` passes, the album is lazily flipped to `isVisible =
-- false` on next read (see lib/tenant-data.ts getGalleryAlbums).
ALTER TABLE `GalleryAlbum`
  CHANGE COLUMN `albumDate` `startDate` DATETIME(3) NULL,
  ADD COLUMN `endDate` DATETIME(3) NULL;
