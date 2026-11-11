import { Pool } from 'pg';
import { isLocalSwapPilotDatabase } from '../config';
import { bangkokWorkDate } from './swap-request-time';

type Options = { month: string; operatorId: number; apply?: boolean };
type Candidate = {
  requestId: number;
  workDate: string | null;
  status: 'MONTH_CLOSED' | 'POLICY_REPLACED';
  version: number;
  requesterUserId: number | null;
};

export async function runLocalSwapCutover(connectionString: string, options: Options) {
  const url = new URL(connectionString);
  if (!isLocalSwapPilotDatabase(url)) {
    throw new Error('Cutover is limited to a disposable local swap pilot database.');
  }
  if (!/^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(options.month)
      || !Number.isSafeInteger(options.operatorId) || options.operatorId < 1) {
    throw new Error('A valid cutover month and demo Manager user ID are required.');
  }

  const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 3000, options: '-c statement_timeout=10000' });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (options.apply) {
        // Drain request readers and writers. The activation trigger rejects any
        // old client attempting to insert a legacy swap after this commits.
        // The pilot runbook pauses the API before the month boundary and until this commits.
        await client.query('LOCK TABLE public.requests IN ACCESS EXCLUSIVE MODE');
      }
      const operator = await client.query(`
        SELECT session_user AS "databaseOperator" FROM public.users u JOIN public.roles r USING (role_id)
        WHERE u.user_id=$1 AND u.is_active AND u.identity_source='DEMO' AND r.role_name='MANAGER'
      `, [options.operatorId]);
      if (!operator.rowCount) throw new Error('An active demo Manager is required as cutover operator.');

      const checkedAt = new Date();
      const currentMonth = bangkokWorkDate(checkedAt).slice(0, 7);
      if (options.apply && currentMonth !== options.month) {
        throw new Error(currentMonth < options.month
          ? 'The Bangkok cutover month has not reached its opening boundary.'
          : 'Apply is only available during the selected cutover month.');
      }
      const effectiveDate = `${options.month}-01`;
      const existing = await client.query('SELECT effective_month::text FROM shiftflow_policy.swap_policy_activation');
      if (existing.rowCount && existing.rows[0].effective_month !== effectiveDate) {
        throw new Error('This pilot database has already been activated for a different month.');
      }
      if (options.apply) {
        const lateApproval = await client.query(`
          SELECT 1 FROM public.requests
          WHERE request_type='SWAP' AND status='APPROVED' AND quota_month IS NULL
            AND updated_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Bangkok')
          LIMIT 1
        `, [effectiveDate]);
        if (lateApproval.rowCount) throw new Error('Legacy swaps were approved after the cutover boundary. Review them before applying.');
      }
      const { rows } = await client.query<Candidate>(`
        SELECT r.request_id AS "requestId", a.work_date::text AS "workDate", r.version,
          CASE WHEN a.work_date < $1::date THEN 'MONTH_CLOSED' ELSE 'POLICY_REPLACED' END AS status,
          u.user_id AS "requesterUserId"
        FROM public.requests r LEFT JOIN public.change_requests ch USING (request_id)
        LEFT JOIN public.shift_assignments a ON a.assignment_id=ch.assignment_id
        LEFT JOIN public.users u ON u.employee_id=r.requester_id AND u.is_active AND u.identity_source='DEMO'
        WHERE r.request_type='SWAP' AND r.status='PENDING' AND r.quota_month IS NULL
        ORDER BY r.request_id
      `, [effectiveDate]);
      if (rows.some(item => !item.workDate)) {
        throw new Error('A pending legacy swap has no roster date. Review it before applying.');
      }
      if (options.apply) {
        for (const item of rows) {
          await client.query(`
            UPDATE public.requests SET status=$2, version=version+1, updated_at=$3 WHERE request_id=$1
          `, [item.requestId, item.status, checkedAt]);
          await client.query(`
            INSERT INTO public.audit_logs (user_id,action,entity_type,entity_id,old_value,new_value,created_at)
            VALUES ($1,'SWAP_CUTOVER_CLOSED','REQUEST',$2,$3,$4,$5)
          `, [
            options.operatorId, item.requestId,
            JSON.stringify({ status: 'PENDING', requestVersion: item.version }),
            JSON.stringify({ status: item.status, requestVersion: item.version + 1, effectiveDate,
              databaseOperator: operator.rows[0].databaseOperator }),
            checkedAt,
          ]);
          if (item.status === 'POLICY_REPLACED' && item.requesterUserId !== null) {
            await client.query(`
              INSERT INTO public.notifications (user_id,request_id,title,message,notification_type,created_at)
              VALUES ($1,$2,'เริ่มใช้กฎสลับกะใหม่','คำขอเดิมปิดแล้ว กรุณายื่นคำขอใหม่ตามกฎปัจจุบัน','IN_APP',$3)
            `, [item.requesterUserId, item.requestId, checkedAt]);
          }
        }
        await client.query(`
          INSERT INTO shiftflow_policy.swap_policy_activation (effective_month, activated_at)
          VALUES ($1, $2) ON CONFLICT (singleton) DO NOTHING
        `, [effectiveDate, checkedAt]);
      }
      await client.query('COMMIT');
      return {
        applied: options.apply === true,
        effectiveDate,
        candidates: rows.map(({ requestId, workDate, status }) => ({ requestId, workDate, status })),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const [month, operator, mode, ...extra] = process.argv.slice(2);
  if (!month || !operator || (mode !== undefined && mode !== '--apply') || extra.length) {
    console.error('Usage: tsx src/requests/swap-policy-cutover.ts YYYY-MM OPERATOR_ID [--apply]');
    process.exitCode = 1;
  } else {
    runLocalSwapCutover(process.env.DATABASE_ADMIN_URL ?? '', { month, operatorId: Number(operator), apply: mode === '--apply' })
      .then(result => console.log(JSON.stringify(result, null, 2)))
      .catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
  }
}
