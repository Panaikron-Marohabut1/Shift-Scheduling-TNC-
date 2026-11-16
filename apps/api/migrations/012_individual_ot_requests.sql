ALTER TABLE public.requests DROP CONSTRAINT requests_request_type_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_request_type_check
 CHECK (request_type IN ('SWAP','LEAVE','OT'));

-- Reuse the private roster-change evidence and deadline storage for individual OT.
ALTER TABLE shiftflow_policy.leave_requests
 ADD COLUMN ot_code varchar(2) CHECK (ot_code IN ('MT','NT')),
 ADD CONSTRAINT individual_ot_has_no_leave_details
 CHECK (ot_code IS NULL OR (cover_assignment_id IS NULL AND leave_code IS NULL AND reason IS NULL));
