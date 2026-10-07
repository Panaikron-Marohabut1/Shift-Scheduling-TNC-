-- Withdrawal closes a request without deleting its snapshots or approval evidence.
ALTER TABLE requests DROP CONSTRAINT requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
 CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED'));
