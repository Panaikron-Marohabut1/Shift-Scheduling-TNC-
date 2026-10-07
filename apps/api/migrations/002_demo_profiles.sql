ALTER TABLE users ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN demo_display_name varchar(100);
ALTER TABLE users ADD COLUMN demo_profile varchar(30) UNIQUE;
ALTER TABLE users ADD COLUMN demo_order smallint UNIQUE CHECK (demo_order BETWEEN 1 AND 7);
ALTER TABLE users ADD CONSTRAINT user_identity_required CHECK (
 employee_id IS NOT NULL OR (identity_source='DEMO' AND demo_display_name IS NOT NULL AND length(trim(demo_display_name))>0)
);
ALTER TABLE users ADD CONSTRAINT demo_profile_only CHECK (
 (demo_profile IS NULL AND demo_order IS NULL) OR
 (identity_source='DEMO' AND demo_profile IS NOT NULL)
);
CREATE FUNCTION enforce_demo_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE role_name_value text;
BEGIN
 SELECT role_name INTO role_name_value FROM roles WHERE role_id=NEW.role_id;
 IF NEW.employee_id IS NULL AND role_name_value NOT IN ('MANAGER','EXTERNAL') THEN
  RAISE EXCEPTION 'Only Manager/External demo profiles may omit employee identity';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER demo_identity_guard BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION enforce_demo_identity();
