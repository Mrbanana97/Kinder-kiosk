-- Remove sign-in functionality by making signed_back_in_at column obsolete
-- We'll keep the column for historical data but it won't be used going forward

-- Update any existing records to remove sign-in timestamps (optional - for clean slate)
-- UPDATE sign_out_records SET signed_back_in_at = NULL;

-- Add a comment to document the change
COMMENT ON COLUMN sign_out_records.signed_back_in_at IS 'DEPRECATED: Sign-in functionality removed. Column kept for historical data only.';
