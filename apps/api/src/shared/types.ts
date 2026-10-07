export type Role = 'EMPLOYEE' | 'SUPERVISOR' | 'HR' | 'MANAGER' | 'EXTERNAL';
export type Actor = { userId: number; employeeId: number|null; role: Role; teamId: number|null; name: string; teamName: string|null; teamCode: string|null; demoProfile: string; demoOrder: number };
export type AppliedSwap = { requestId:number; appliedAt:string; originalShiftCode:string; receivedShiftCode:string; partner:{employeeId:number;name:string;teamCode:string;teamName:string} };
export type Assignment = { assignment_id: number; employee_id: number; team_id: number; team_code: string; schedule_id: number; shift_type_id: number; work_date: string; version: number; position: string; shift_code: string; shift_name: string; is_working: boolean; start_time: string | null; end_time: string | null; name: string; status: string; swap?:AppliedSwap };
export type Check = { rule: string; status: 'PASS' | 'FAIL' | 'UNCONFIRMED'; message: string };
