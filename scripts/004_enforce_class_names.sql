-- Enforce allowed class names at the database level
-- Adds a CHECK constraint permitting only KA, KB, KC, KD.
-- Safe pattern: drop existing constraint if present, then add.

ALTER TABLE classes
  DROP CONSTRAINT IF EXISTS classes_name_allowed_chk;

ALTER TABLE classes
  ADD CONSTRAINT classes_name_allowed_chk
  CHECK (name IN ('KA','KB','KC','KD'));
