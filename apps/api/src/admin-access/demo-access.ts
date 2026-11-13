import { isLocalSchedulingDatabase, isSharedDemoDatabase } from '../config';
import type { Database } from '../database/database.service';
import type { Actor } from '../shared/types';

export const adminDemoProfile='admin-demo';
export const onboardingDemoProfile='employee-b2-onboarding';

export function localDemoAccess(db:Database) {
 const connection=db.pool.options.connectionString;
 return (process.env.APP_MODE??'DEMO')==='DEMO'&&!!connection&&isLocalSchedulingDatabase(new URL(connection));
}

export function sharedDemoAccess(db:Database) {
 const connection=db.pool.options.connectionString;
 return !!connection&&isSharedDemoDatabase(new URL(connection));
}

export function demoPeopleAccess(db:Database) {
 return localDemoAccess(db)||sharedDemoAccess(db);
}

export function isDemoAdmin(actor:Actor) {
 return actor.role==='ADMIN'&&actor.demoProfile===adminDemoProfile;
}
