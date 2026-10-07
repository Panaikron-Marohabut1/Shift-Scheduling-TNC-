CREATE TABLE roles (role_id serial PRIMARY KEY, role_name varchar(50) NOT NULL UNIQUE, description text);
CREATE TABLE teams (team_id serial PRIMARY KEY, team_code varchar(10) NOT NULL UNIQUE, team_name varchar(100) NOT NULL, description text, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE employees (
 employee_id serial PRIMARY KEY, employee_code varchar(20) NOT NULL UNIQUE,
 first_name varchar(100) NOT NULL, last_name varchar(100) NOT NULL,
 email varchar(255), phone varchar(30), department varchar(100), position varchar(100),
 team_id int REFERENCES teams, employment_status varchar(30), last_synced_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE users (
 user_id serial PRIMARY KEY, azure_object_id uuid UNIQUE,
 identity_source varchar(10) NOT NULL CHECK(identity_source IN ('DEMO','COMPANY')),
 employee_id int NOT NULL UNIQUE REFERENCES employees, role_id int NOT NULL REFERENCES roles,
 is_active boolean NOT NULL DEFAULT true, last_login_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
 CHECK(identity_source = 'DEMO' OR azure_object_id IS NOT NULL)
);
CREATE TABLE shift_types (
 shift_type_id serial PRIMARY KEY, shift_code varchar(10) NOT NULL UNIQUE,
 shift_name varchar(100) NOT NULL, start_time time, end_time time,
 is_working boolean NOT NULL, is_active boolean NOT NULL DEFAULT true, description text
);
CREATE TABLE schedules (
 schedule_id serial PRIMARY KEY, month int NOT NULL CHECK(month BETWEEN 1 AND 12),
 year int NOT NULL CHECK(year BETWEEN 2000 AND 2200), status varchar(30) NOT NULL,
 created_by int NOT NULL REFERENCES users, approved_by int REFERENCES users,
 version int NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
 UNIQUE(year,month)
);
CREATE TABLE shift_assignments (
 assignment_id serial PRIMARY KEY, schedule_id int NOT NULL REFERENCES schedules,
 employee_id int NOT NULL REFERENCES employees, shift_type_id int NOT NULL REFERENCES shift_types,
 work_date date NOT NULL, status varchar(30) NOT NULL,
 assigned_by int NOT NULL REFERENCES users, version int NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
 UNIQUE(employee_id,work_date)
);
CREATE TABLE requests (
 request_id serial PRIMARY KEY, requester_id int NOT NULL REFERENCES employees,
 request_type varchar(30) NOT NULL CHECK(request_type IN ('SWAP')),
 reason text, status varchar(30) NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 version int NOT NULL DEFAULT 1, submitted_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE change_requests (
 request_id int PRIMARY KEY REFERENCES requests,
 assignment_id int NOT NULL REFERENCES shift_assignments,
 target_employee_id int NOT NULL REFERENCES employees,
 target_assignment_id int NOT NULL REFERENCES shift_assignments,
 snapshot jsonb NOT NULL, CHECK(assignment_id <> target_assignment_id)
);
CREATE TABLE approvals (
 approval_id serial PRIMARY KEY, request_id int NOT NULL REFERENCES requests,
 approver_id int NOT NULL REFERENCES users, approver_level int NOT NULL CHECK(approver_level IN (1,2)),
 request_version int NOT NULL DEFAULT 1,
 status varchar(30) NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 comment text, approved_at timestamptz,
 UNIQUE(request_id,approver_level), UNIQUE(request_id,approver_id)
);
CREATE TABLE notifications (
 notification_id serial PRIMARY KEY, user_id int NOT NULL REFERENCES users,
 request_id int REFERENCES requests, title varchar(255) NOT NULL, message text NOT NULL,
 notification_type varchar(50), is_read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
 audit_id serial PRIMARY KEY, user_id int NOT NULL REFERENCES users,
 action varchar(50) NOT NULL, entity_type varchar(50) NOT NULL, entity_id int NOT NULL,
 old_value jsonb, new_value jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE holidays (
 holiday_id serial PRIMARY KEY, holiday_date date NOT NULL UNIQUE, holiday_name varchar(255) NOT NULL,
 description text, is_active boolean NOT NULL DEFAULT true,
 created_by int NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE sessions (
 token_hash char(64) PRIMARY KEY, user_id int NOT NULL REFERENCES users,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE operation_receipts (
 user_id int NOT NULL REFERENCES users, operation_key varchar(100) NOT NULL,
 input_hash char(64) NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_key)
);
CREATE INDEX assignments_date_idx ON shift_assignments(work_date);
CREATE INDEX approvals_user_idx ON approvals(approver_id,request_id);
CREATE INDEX audit_entity_idx ON audit_logs(entity_type,entity_id);
CREATE INDEX notifications_user_idx ON notifications(user_id,created_at);
CREATE FUNCTION protect_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit evidence cannot be changed or deleted'; END $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION protect_evidence();
CREATE FUNCTION protect_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' OR OLD.status <> 'PENDING' THEN RAISE EXCEPTION 'Decided approvals cannot be changed or deleted'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_decision BEFORE UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION protect_decision();
GRANT USAGE ON SCHEMA public TO shiftflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shiftflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shiftflow_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM shiftflow_app;
REVOKE DELETE, TRUNCATE ON approvals FROM shiftflow_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
