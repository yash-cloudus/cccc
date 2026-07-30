-- Nullable, not NOT NULL: existing rows predate the question, and there is no
-- honest default to give them. The forms require it going forward.
ALTER TABLE `FamilyMember` ADD COLUMN `gender` ENUM('MALE', 'FEMALE') NULL;

-- Backfill only where the relation states it outright. "Head", "Other" and
-- anything custom stay NULL rather than being guessed at.
UPDATE `FamilyMember` SET `gender` = 'MALE'
WHERE `gender` IS NULL
  AND LOWER(TRIM(`relation`)) IN ('husband', 'son', 'father', 'brother', 'grandfather', 'son-in-law');

UPDATE `FamilyMember` SET `gender` = 'FEMALE'
WHERE `gender` IS NULL
  AND LOWER(TRIM(`relation`)) IN ('wife', 'daughter', 'mother', 'sister', 'grandmother', 'daughter-in-law');
