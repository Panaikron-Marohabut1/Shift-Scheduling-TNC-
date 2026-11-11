-- Existing requests remain outside the local quota pilot. An approved request
-- in the pilot is itself the record of one used slot.
ALTER TABLE public.requests ADD COLUMN quota_month date
 CHECK (quota_month IS NULL OR (
   request_type = 'SWAP' AND EXTRACT(DAY FROM quota_month) = 1
 ));

CREATE INDEX requests_approved_swap_quota_idx ON public.requests(requester_id, quota_month)
 WHERE request_type = 'SWAP' AND status = 'APPROVED' AND quota_month IS NOT NULL;
