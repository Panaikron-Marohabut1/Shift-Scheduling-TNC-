import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { isLocalSchedulingDatabase } from '../config';
import { Database } from '../database/database.service';
import { id } from '../shared/input';
import { Actor } from '../shared/types';

const DEFAULT_MONTHLY_LIMIT = 2;

type QuotaSettings = {
  currentMonth: string;
  currentLimit: number;
  nextMonth: string;
  nextLimit: number;
  nextRevision: number;
};

const bangkokMonth = "date_trunc('month', timezone('Asia/Bangkok', statement_timestamp()))";

@Injectable()
export class SwapQuotaService {
  constructor(@Inject(Database) private readonly db: Database) {}

  localPilotEnabled(): boolean {
    if (process.env.ENABLE_LOCAL_SWAP_POLICY === 'false') return false;
    const database = new URL(this.db.pool.options.connectionString!);
    return isLocalSchedulingDatabase(database);
  }

  localPilotMonth(workDate: string): string | null {
    if (!this.localPilotEnabled()) return null;
    return `${workDate.slice(0, 7)}-01`;
  }

  async readRequesterQuota(client: PoolClient, requesterId: number, month: string) {
    const { rows: [quota] } = await client.query<{ limit: number; used: number }>(`
      SELECT COALESCE((
        SELECT monthly_limit FROM shiftflow_policy.swap_quota_limits
        WHERE effective_month <= $2::date ORDER BY effective_month DESC LIMIT 1
      ), $3) AS "limit", (
        SELECT count(*)::int FROM public.requests WHERE requester_id = $1
          AND request_type = 'SWAP' AND status = 'APPROVED' AND quota_month = $2::date
      ) AS used
    `, [requesterId, month, DEFAULT_MONTHLY_LIMIT]);
    return { month, ...quota, remaining: Math.max(0, quota.limit - quota.used) };
  }

  // The caller holds the requester's employee advisory lock until commit.
  // A successful final decision becomes one used slot when it marks the request approved.
  async requireAvailableSlot(client: PoolClient, requesterId: number, month: string) {
    const quota = await this.readRequesterQuota(client, requesterId, month);
    if (quota.used >= quota.limit) {
      throw new ConflictException({ code: 'SWAP_QUOTA_EXHAUSTED', message: 'ผู้ยื่นใช้สิทธิ์สลับกะครบแล้วสำหรับเดือนนี้' });
    }
    return { month, limit: quota.limit, usedAfterApproval: quota.used + 1 };
  }

  read(actor: Actor) {
    this.requireManager(actor);
    return this.db.transaction(client => this.readSettings(client));
  }

  schedule(actor: Actor, value: unknown, expectedEffectiveMonth: unknown, expectedRevision: unknown) {
    this.requireManager(actor);
    const monthlyLimit = id(value, 'โควตาสลับกะ');
    if (monthlyLimit > 2_147_483_647) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'โควตาสลับกะสูงเกินช่วงที่ระบบรองรับ' });
    }
    if (typeof expectedEffectiveMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(expectedEffectiveMonth)) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'เดือนที่เริ่มใช้โควตาไม่ถูกต้อง' });
    }
    if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'กรุณาโหลดค่าตั้งล่าสุดก่อนบันทึก' });
    }
    return this.db.transaction(async client => {
      // Serialize edits so each audit entry reflects the previous scheduled value.
      await client.query('SELECT pg_advisory_xact_lock(812, 1)');
      const settings = await this.readSettings(client);
      if (settings.nextMonth !== expectedEffectiveMonth) this.monthChanged();
      if (settings.nextRevision !== expectedRevision) {
        throw new ConflictException({ code: 'QUOTA_SETTINGS_CHANGED', message: 'มีการแก้โควตาแล้ว กรุณาตรวจค่าตั้งล่าสุดก่อนบันทึก' });
      }
      if (settings.nextLimit === monthlyLimit) return settings;

      const effectiveMonth = settings.nextMonth;
      const { rows: [saved] } = await client.query<{ revision: number; changed_at: Date }>(`
        INSERT INTO shiftflow_policy.swap_quota_limits AS existing (effective_month, monthly_limit)
        SELECT $1::date, $2::integer
        WHERE $1::date = (${bangkokMonth} + interval '1 month')::date
        ON CONFLICT (effective_month) DO UPDATE
        SET monthly_limit = EXCLUDED.monthly_limit, revision = existing.revision + 1
        RETURNING revision, statement_timestamp() AS changed_at
      `, [effectiveMonth, monthlyLimit]);
      if (!saved) this.monthChanged();

      await client.query(`
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, created_at)
        VALUES ($1, 'SWAP_QUOTA_CHANGED', 'SWAP_QUOTA_POLICY', $2, $3, $4, $5)
      `, [
        actor.userId,
        Number(effectiveMonth.slice(0, 7).replace('-', '')),
        JSON.stringify({ effectiveMonth, monthlyLimit: settings.nextLimit }),
        JSON.stringify({ effectiveMonth, monthlyLimit }),
        saved.changed_at,
      ]);
      return { ...settings, nextLimit: monthlyLimit, nextRevision: saved.revision };
    });
  }

  private monthChanged(): never {
    throw new ConflictException({ code: 'QUOTA_EFFECTIVE_MONTH_CHANGED', message: 'ขึ้นเดือนใหม่แล้ว กรุณาโหลดค่าตั้งล่าสุดก่อนบันทึก' });
  }

  private requireManager(actor: Actor) {
    if (actor.role !== 'MANAGER') {
      throw new ForbiddenException({ code: 'QUOTA_SETTINGS_FORBIDDEN', message: 'เฉพาะผู้จัดการที่เข้าถึงค่าตั้งโควตาสลับกะได้' });
    }
  }

  private async readSettings(client: PoolClient): Promise<QuotaSettings> {
    const result = await client.query<QuotaSettings>(`
      WITH months AS (
        SELECT ${bangkokMonth} AS current_month
      ), periods AS (
        SELECT current_month::date, (current_month + interval '1 month')::date AS next_month FROM months
      )
      SELECT current_month::text AS "currentMonth", next_month::text AS "nextMonth",
        COALESCE((SELECT monthly_limit FROM shiftflow_policy.swap_quota_limits
          WHERE effective_month <= current_month ORDER BY effective_month DESC LIMIT 1), $1) AS "currentLimit",
        COALESCE((SELECT monthly_limit FROM shiftflow_policy.swap_quota_limits
          WHERE effective_month <= next_month ORDER BY effective_month DESC LIMIT 1), $1) AS "nextLimit",
        COALESCE((SELECT revision FROM shiftflow_policy.swap_quota_limits
          WHERE effective_month = next_month), 0) AS "nextRevision"
      FROM periods
    `, [DEFAULT_MONTHLY_LIMIT]);
    return result.rows[0];
  }
}
