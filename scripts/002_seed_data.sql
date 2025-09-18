-- Insert the 4 kindergarten classes
INSERT INTO classes (name) VALUES 
  ('KA'),
  ('KB'), 
  ('KC'),
  ('KD')
ON CONFLICT (name) DO NOTHING;

-- Insert sample students for each class
WITH class_ids AS (
  SELECT id, name FROM classes WHERE name IN ('KA', 'KB', 'KC', 'KD')
)
INSERT INTO students (first_name, last_name, class_id) VALUES
  -- KA students
  ('Emma', 'Johnson', (SELECT id FROM class_ids WHERE name = 'KA')),
  ('Liam', 'Smith', (SELECT id FROM class_ids WHERE name = 'KA')),
  ('Olivia', 'Brown', (SELECT id FROM class_ids WHERE name = 'KA')),
  ('Noah', 'Davis', (SELECT id FROM class_ids WHERE name = 'KA')),
  ('Ava', 'Miller', (SELECT id FROM class_ids WHERE name = 'KA')),
  
  -- KB students
  ('Sophia', 'Wilson', (SELECT id FROM class_ids WHERE name = 'KB')),
  ('Jackson', 'Moore', (SELECT id FROM class_ids WHERE name = 'KB')),
  ('Isabella', 'Taylor', (SELECT id FROM class_ids WHERE name = 'KB')),
  ('Lucas', 'Anderson', (SELECT id FROM class_ids WHERE name = 'KB')),
  ('Mia', 'Thomas', (SELECT id FROM class_ids WHERE name = 'KB')),
  
  -- KC students
  ('Charlotte', 'Jackson', (SELECT id FROM class_ids WHERE name = 'KC')),
  ('Ethan', 'White', (SELECT id FROM class_ids WHERE name = 'KC')),
  ('Amelia', 'Harris', (SELECT id FROM class_ids WHERE name = 'KC')),
  ('Alexander', 'Martin', (SELECT id FROM class_ids WHERE name = 'KC')),
  ('Harper', 'Thompson', (SELECT id FROM class_ids WHERE name = 'KC')),
  
  -- KD students
  ('Evelyn', 'Garcia', (SELECT id FROM class_ids WHERE name = 'KD')),
  ('Benjamin', 'Martinez', (SELECT id FROM class_ids WHERE name = 'KD')),
  ('Abigail', 'Robinson', (SELECT id FROM class_ids WHERE name = 'KD')),
  ('Henry', 'Clark', (SELECT id FROM class_ids WHERE name = 'KD')),
  ('Emily', 'Rodriguez', (SELECT id FROM class_ids WHERE name = 'KD'))
ON CONFLICT DO NOTHING;
