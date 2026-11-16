ALTER TABLE shiftflow_policy.leave_requests
 DROP CONSTRAINT leave_requests_leave_code_check,
 ADD CONSTRAINT leave_requests_leave_code_check CHECK (leave_code IN ('V','S','B','VG'));
