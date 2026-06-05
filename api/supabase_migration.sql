-- 1. Add new columns to users table
ALTER TABLE users ADD COLUMN phone_no TEXT;
ALTER TABLE users ADD COLUMN emergency_no TEXT;
ALTER TABLE users ADD COLUMN type TEXT DEFAULT 'Employee';
ALTER TABLE users ADD COLUMN projectStatus TEXT DEFAULT 'Inactive';
ALTER TABLE users ADD COLUMN emp_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN designation TEXT;

-- 2. Drop unused tables (if they still exist)
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS bugs CASCADE;
DROP TABLE IF EXISTS salaries CASCADE;
