-- The family head's photo, collected on the registration form.
--
-- APPLY BY HAND — see prisma/migrations/auth_mode_4-8-Y/migration.sql for why
-- `migrate deploy` and `db push` are both wrong on this project:
--
--   npx prisma db execute --file prisma/migrations/head_photo_4-8-Y/migration.sql \
--     --schema prisma/schema.prisma
--
-- On FamilyMember, not Family: it is a photo of a person, and putting it on the
-- member means the same column can serve the rest of the household the day the
-- community asks for that. Nullable with no default — every family registered
-- before today has no photo, and there is nothing to infer.
--
-- TEXT because the value is a URL from Cloudinary (or /uploads/… when
-- Cloudinary is not configured), which can run past 191 characters.

ALTER TABLE `FamilyMember`
    ADD COLUMN `photoUrl` TEXT NULL;
