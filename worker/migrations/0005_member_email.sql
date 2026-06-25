-- Allow members to be linked to a Google account via email
ALTER TABLE members ADD COLUMN email TEXT;

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email) WHERE email IS NOT NULL;
