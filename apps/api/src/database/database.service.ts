import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, types } from 'pg';
import { databaseOptions } from '../config';
types.setTypeParser(1082, value => value);
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = new Pool(databaseOptions());
  private readonly initialized = new WeakSet<PoolClient>();
  private async acquire(): Promise<PoolClient> {
    const client = await this.pool.connect();
    if (this.initialized.has(client)) return client;
    try {
      // Session poolers may ignore PostgreSQL startup options. Configure the actual
      // backend session before exposing a new physical connection to application SQL.
      await client.query("SET TIME ZONE 'UTC'; SET statement_timeout = 10000");
      this.initialized.add(client);
      return client;
    } catch (error) {
      // Discard a partially initialized connection rather than returning it to the pool.
      client.release(error instanceof Error ? error : new Error('Database session initialization failed.'));
      throw error;
    }
  }
  async query(text: string, values: unknown[] = []) {
    const client = await this.acquire();
    try { return await client.query(text, values); }
    finally { client.release(); }
  }
  async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.acquire();
    let releaseError: Error | undefined;
    try { await client.query('BEGIN'); const result = await run(client); await client.query('COMMIT'); return result; }
    catch (error) {
      try { await client.query('ROLLBACK'); }
      catch (rollbackError) {
        releaseError = rollbackError instanceof Error ? rollbackError : new Error('Database rollback failed.');
      }
      throw error;
    }
    finally { client.release(releaseError); }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
