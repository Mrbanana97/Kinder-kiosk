-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sign_out_records table
CREATE TABLE IF NOT EXISTS sign_out_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  signer_name VARCHAR(200) NOT NULL,
  signature_data TEXT, -- Base64 encoded signature image
  signed_out_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  signed_back_in_at TIMESTAMP WITH TIME ZONE NULL
);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_out_records ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a kiosk app)
-- Classes policies
CREATE POLICY "Allow public read access to classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Allow public insert to classes" ON classes FOR INSERT WITH CHECK (true);

-- Students policies  
CREATE POLICY "Allow public read access to students" ON students FOR SELECT USING (true);
CREATE POLICY "Allow public insert to students" ON students FOR INSERT WITH CHECK (true);

-- Sign out records policies
CREATE POLICY "Allow public read access to sign_out_records" ON sign_out_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert to sign_out_records" ON sign_out_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to sign_out_records" ON sign_out_records FOR UPDATE USING (true);
