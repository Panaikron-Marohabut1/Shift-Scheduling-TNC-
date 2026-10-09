/* ==========================================================================
   ข้อมูลจากระบบหลังบ้าน (API) และจุดเชื่อมของข้อมูลเดโม
   --------------------------------------------------------------------------
   ต่อฐานข้อมูลแล้ว:
     GET  /api/demo/accounts, POST /api/demo/session, GET /api/me, POST /api/auth/logout
     GET  /api/schedules?month=YYYY-MM                     ตารางกะรายเดือน → state.shiftsData, apiCodes
     GET  /api/requests                                     คำขอสลับกะ → state.apiRequests
     POST /api/requests                                     ยื่นสลับกะ (พนักงานทีม A/B สลับกันวันเดียวกัน)
     POST /api/requests/:id/decisions | /cancel             อนุมัติ / ไม่อนุมัติ / ยกเลิก
     GET  /api/audit?view=personal|activity                 ประวัติ → state.apiLogs
   ยังเป็นเดโมในเบราว์เซอร์ (ดู "LOCAL" ในไฟล์นี้และ state.js) จนกว่าระบบหลังบ้านจะมี API
   ========================================================================== */
import { api } from '../api/client.js';
import { state, saveLocal } from './state.js';
import { TEAM_KEYS, monthKey, pad2, thaiMonthName, getAllEmployees, findEmployeeById, clearPatternCache } from '../shared/scheduling.js';

const fmtTime = iso => (iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'เมื่อสักครู่');
export const nowText = () => fmtTime(new Date().toISOString());

/* ---------- ตารางกะ ---------- */
const yearsLoaded = {};
export async function loadYear(y, force = false) {
  if (yearsLoaded[y] && !force) return;
  const months = await Promise.all(Array.from({ length: 12 }, (_, m) => api(`/schedules?month=${y}-${pad2(m + 1)}`).catch(() => ({ assignments: [] }))));
  months.forEach((r, m) => { state.apiMonths[monthKey(y, m)] = r; });
  yearsLoaded[y] = true;
  rebuildSchedule();
}
export async function reloadMonths(keys) {
  await Promise.all(keys.map(async key => {
    const [y, m] = key.split('-').map(Number);
    state.apiMonths[key] = await api(`/schedules?month=${y}-${pad2(m + 1)}`).catch(() => ({ assignments: [] }));
  }));
  rebuildSchedule();
}
export async function reloadLoadedYears() {
  await Promise.all(Object.keys(yearsLoaded).map(y => loadYear(Number(y), true)));
}
export function resetData() { Object.keys(yearsLoaded).forEach(k => { delete yearsLoaded[k]; }); state.apiMonths = {}; }

// พนักงานและรหัสกะจากตารางในฐานข้อมูล + การแก้ข้อมูลพนักงานในเดโม
export function rebuildSchedule() {
  const people = new Map();
  state.apiCodes = {};
  state.apiAssign = {};
  Object.values(state.apiMonths).forEach(r => (r.assignments || []).forEach(a => {
    const id = a.employee_code;
    if (!people.has(id)) people.set(id, a);
    (state.apiCodes[id] = state.apiCodes[id] || {})[a.work_date] = a.swap ? `${a.shift_code}/${a.swap.originalShiftCode}` : a.shift_code;
    (state.apiAssign[id] = state.apiAssign[id] || {})[a.work_date] = a;
  }));
  TEAM_KEYS.forEach(k => { state.shiftsData[k].employees = []; state.shiftsData[k].supervisorId = ''; });
  const list = [...people.values()].sort((a, b) => a.team_code.localeCompare(b.team_code) || (a.position === 'SUPERVISOR' ? -1 : 0) - (b.position === 'SUPERVISOR' ? -1 : 0) || a.employee_id - b.employee_id);
  list.forEach(a => {
    const sup = a.position === 'SUPERVISOR';
    const emp = {
      id: a.employee_code, eid: a.employee_id, code: a.employee_code, name: a.name, phone: '-', initials: a.name.slice(0, 2),
      roleCategory: sup ? 'Shift Supervisor' : 'Shift Employee', position: sup ? 'Shift Supervisor (S)' : 'Field Operator', shiftType: `Shift ${a.team_code}`
    };
    Object.assign(emp, state.peopleEdits.byId[emp.id] || {});
    const team = state.shiftsData[`shift${emp.shiftType.slice(-1)}`];
    if (!team) return;
    team.employees.push(emp);
    if (sup && a.team_code === emp.shiftType.slice(-1) && !team.supervisorId) team.supervisorId = emp.id;
  });
  // LOCAL: พนักงานที่ผู้จัดการเพิ่มในเดโม
  state.peopleEdits.added.forEach(e => { const team = state.shiftsData[`shift${e.shiftType.slice(-1)}`]; if (team && !team.employees.some(x => x.id === e.id)) team.employees.push({ ...e }); });
  clearPatternCache();
}

/* ---------- คำขอ ---------- */
function teamOfApproval(s) { return String(s.team_name || '').replace('ทีม ', '').trim(); }
function mapRequest(r) {
  const a = r.snapshot.source, b = r.snapshot.target;
  const y = Number(a.work_date.slice(0, 4)), m = Number(a.work_date.slice(5, 7)) - 1, d = Number(a.work_date.slice(8, 10));
  const approvals = [...(r.approvals || [])].sort((p, q) => p.approver_level - q.approver_level);
  const approvers = approvals.map(s => ({
    role: `Shift Supervisor ${teamOfApproval(s)} (${String(s.name || '').split(' ')[0]})`,
    status: s.status === 'APPROVED' ? 'approved' : s.status === 'REJECTED' ? 'rejected' : 'pending',
    at: s.approved_at ? new Date(s.approved_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''
  }));
  const next = approvers.find(s => s.status !== 'approved');
  const status = r.status === 'APPROVED' ? 'อนุมัติแล้ว' : r.status === 'REJECTED' ? 'ไม่อนุมัติ' : r.status === 'CANCELLED' ? 'ยกเลิกแล้ว'
    : approvers.some(s => s.status === 'approved') && next ? `รออนุมัติครบ 2 ฝ่าย (${next.role})` : 'รออนุมัติครบ 2 ฝ่าย';
  const rejected = approvals.find(s => s.status === 'REJECTED');
  const requester = getAllEmployees().find(e => e.eid === a.employee_id);
  const target = getAllEmployees().find(e => e.eid === b.employee_id);
  return {
    id: r.request_id, api: true, ts: Date.parse(r.submitted_at) || 0, version: r.version, canDecide: !!r.canDecide, canCancel: !!r.canCancel, hasConflict: !!r.hasConflict,
    type: 'สลับกะข้ามทีม', person: a.name, requesterId: requester ? requester.id : a.employee_code, targetPerson: b.name, targetId: target ? target.id : b.employee_code,
    day: d, y, m, aNewCode: b.shift_code, bNewCode: a.shift_code, initials: a.name.slice(0, 2),
    roleCategory: requester ? requester.roleCategory : 'Shift Employee', targetRole: target ? target.roleCategory : 'Shift Employee',
    date: `${d} ${thaiMonthName(m, 'long')} ${y + 543}`, currentShift: a.shift_code, targetShift: b.shift_code,
    reason: `สลับกะกับ ${b.name} (${a.shift_code} ↔ ${b.shift_code})`, isCrossShift: true, approvers, status,
    submittedAt: fmtTime(r.submitted_at), quotaUsed: '-', rejectReason: rejected ? rejected.comment || '' : ''
  };
}
export async function loadRequests() {
  if (!['EMPLOYEE', 'SUPERVISOR', 'MANAGER'].includes(state.actor.role)) { state.apiRequests = []; return; } // HR และผู้ใช้ภายนอกไม่มีสิทธิ์ดูคำขอ
  try { state.apiRequests = (await api('/requests')).map(mapRequest); } catch { state.apiRequests = []; }
}

/* ---------- ประวัติ ---------- */
const ACTION_LABEL = {
  REQUEST_SUBMITTED: 'ยื่นคำขอสลับกะ', REQUEST_APPROVED: 'อนุมัติคำขอสลับกะ', REQUEST_REJECTED: 'ไม่อนุมัติคำขอสลับกะ',
  REQUEST_CANCELLED: 'ยกเลิกคำขอสลับกะ', SCHEDULE_SWAP_APPLIED: 'บันทึกการสลับกะลงตาราง', SCHEDULE_VIEWED: 'เปิดดูตารางกะ'
};
function mapLog(l) {
  const v = l.new_value || {};
  const label = ACTION_LABEL[l.action] || l.action;
  const detail = v.workDate ? ` วันที่ ${new Date(`${v.workDate}T12:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
  const reason = v.reason ? ` (เหตุผล: ${v.reason})` : '';
  const level = l.action === 'REQUEST_APPROVED' && v.level ? ` ขั้นที่ ${v.level}` : '';
  return { id: `api-${l.audit_id || l.id || l.created_at}`, at: l.created_at, actor: l.actor_name || 'ระบบ', userId: l.user_id, action: `${label}${l.entity_type === 'REQUEST' ? ` #${l.entity_id}` : ''}${level}${detail}${reason}`, time: fmtTime(l.created_at) };
}
export async function loadLogs() {
  const role = state.actor.role;
  if (!['EMPLOYEE', 'SUPERVISOR', 'MANAGER', 'HR'].includes(role)) { state.apiLogs = []; return; }
  try { state.apiLogs = (await api(`/audit?view=${role === 'EMPLOYEE' ? 'personal' : 'activity'}`)).map(mapLog); } catch { state.apiLogs = []; }
}

// รวมข้อมูลจาก API กับเดโมในเครื่อง ให้หน้าจออ่านจาก state.requests / state.auditLogs ที่เดียว
export function merge() {
  state.requests = [...state.localRequests, ...state.apiRequests].sort((a, b) => (b.ts || b.id) - (a.ts || a.id));
  state.auditLogs = [...state.localLogs, ...state.apiLogs].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}
export async function refreshAll() {
  await Promise.all([loadRequests(), loadLogs()]);
  merge();
}

/* ---------- บันทึกประวัติของเดโม (LOCAL) ---------- */
export function addLog(action, extra = {}) {
  const role = state.roles[state.activeRole] || {};
  state.localLogs.unshift({ id: Date.now(), at: new Date().toISOString(), actor: role.name || state.activeRole, avatar: role.initials || '--', action, time: nowText(), ...extra });
  merge();
  saveLocal();
}

/* ---------- คำสั่งที่ต่อ API ---------- */
// ยื่นสลับกะผ่านระบบหลังบ้านได้ไหม: ผู้ยื่นคือผู้ที่เข้าสู่ระบบเอง และทั้งสองคนมีกะในฐานข้อมูลวันนั้น
export function apiSwapTarget(aId, bId, y, m, d) {
  const iso = `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const a = state.apiAssign[aId] && state.apiAssign[aId][iso];
  const b = state.apiAssign[bId] && state.apiAssign[bId][iso];
  const me = findEmployeeById(aId);
  if (!a || !b || !me || state.actor.role !== 'EMPLOYEE' || me.eid !== state.actor.employeeId) return null;
  if (state.scheduleOverrides[monthKey(y, m)]) {
    const ov = state.scheduleOverrides[monthKey(y, m)];
    if ((ov[aId] && ov[aId][d]) || (ov[bId] && ov[bId][d])) return null; // วันที่แก้ในเดโมแล้ว ใช้คำขอเดโมแทน
  }
  return { a, b };
}
export function submitApiSwap(a, b) {
  return api('/requests', { method: 'POST', key: crypto.randomUUID(), body: { assignmentId: a.assignment_id, targetAssignmentId: b.assignment_id, assignmentVersion: a.version, targetVersion: b.version } });
}
export function decideApi(req, decision, reason = '') {
  return api(`/requests/${req.id}/decisions`, { method: 'POST', key: crypto.randomUUID(), body: { decision, expectedVersion: req.version, reason } });
}
export function cancelApi(req) {
  return api(`/requests/${req.id}/cancel`, { method: 'POST', key: crypto.randomUUID(), body: { expectedVersion: req.version } });
}
