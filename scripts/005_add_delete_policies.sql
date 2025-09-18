-- Allow delete operations via RLS if ever performed with anon key (currently service role is used in API route)
-- Adjust conditions if you later scope deletions.

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_out_records ENABLE ROW LEVEL SECURITY;

-- Idempotent: wrap in DO block to avoid duplicate policy errors
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete students') THEN
    CREATE POLICY "Allow public delete students" ON students FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete sign_out_records') THEN
    CREATE POLICY "Allow public delete sign_out_records" ON sign_out_records FOR DELETE USING (true);
  END IF;
END $$;
