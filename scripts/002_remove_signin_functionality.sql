-- Retire the sign-in flow from the kiosk UI while keeping signed_back_in_at available
-- The column continues to power admin history and reporting, so preserve the data

-- Update any existing records to remove sign-in timestamps (optional - for clean slate)
-- UPDATE sign_out_records SET signed_back_in_at = NULL;

-- Add a comment to document the change and remaining usage
COMMENT ON COLUMN sign_out_records.signed_back_in_at IS 'Sign-in flow removed from kiosk; column retained for admin sign-back-in tracking and historical data.';
