-- Cleanup script: remove any classes not in the allowed kindergarten set
-- Allowed: KA, KB, KC, KD
-- This will also cascade delete students (and their sign_out_records) because of FK ON DELETE CASCADE.

BEGIN;
  DELETE FROM classes WHERE name NOT IN ('KA','KB','KC','KD');
COMMIT;
