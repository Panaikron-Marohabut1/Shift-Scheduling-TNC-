/* ==========================================================================
   บทบาทและเมนู
   --------------------------------------------------------------------------
   ชื่อบทบาทที่พิมพ์/เลือกในหน้าเข้าสู่ระบบ → บัญชีในฐานข้อมูล (/api/demo/accounts)
   สิทธิ์จริงตรวจที่ระบบหลังบ้านเสมอ เมนูนี้กำหนดเฉพาะหน้าที่แสดง
   ========================================================================== */
import { state } from './state.js';

export const ROLE_LIST = [
  ['Manager', 'ผู้จัดการฝ่ายผลิต'],
  ['Shift Supervisor A', 'หัวหน้ากะ A'],
  ['Shift Supervisor B', 'หัวหน้ากะ B'],
  ['Shift Supervisor C', 'หัวหน้ากะ C'],
  ['Shift Supervisor D', 'หัวหน้ากะ D'],
  ['Shift Employee', 'พนักงานปฏิบัติ'],
  ['HR', 'ฝ่ายบุคคล'],
  ['Contractor / Van Driver', 'ผู้ใช้ภายนอก (คนขับรถ)']
];
// พิมพ์ชื่อเหล่านี้ได้ด้วย (ไม่ขึ้นเป็นปุ่ม) — "Shift Employee B" ใช้ทดสอบฝั่งพนักงานทีม B
const ROLE_ALIASES = {
  'Manager': ['ผู้จัดการ', 'mgr'],
  'Shift Supervisor A': ['supervisor a', 'sup a', 'หัวหน้า a'],
  'Shift Supervisor B': ['supervisor b', 'sup b', 'หัวหน้า b'],
  'Shift Supervisor C': ['supervisor c', 'sup c', 'หัวหน้า c'],
  'Shift Supervisor D': ['supervisor d', 'sup d', 'หัวหน้า d'],
  'Shift Employee': ['employee', 'พนักงาน', 'พนักงานกะ', 'shift employee a', 'employee a'],
  'Shift Employee B': ['employee b', 'พนักงาน b'],
  'HR': ['ฝ่ายบุคคล', 'ฝ่ายทรัพยากรบุคคล'],
  'Contractor / Van Driver': ['contractor', 'van driver', 'driver', 'คนขับรถ', 'ผู้ใช้ภายนอก', 'external user']
};
export const norm = s => String(s || '').toLowerCase().replace(/[\s/\-_.()]+/g, '');
export function findRole(name) {
  const n = norm(name);
  if (!n) return null;
  const all = [...ROLE_LIST, ['Shift Employee B', 'พนักงานปฏิบัติ B']];
  return all.find(r => norm(r[0]) === n || norm(r[1]) === n || (ROLE_ALIASES[r[0]] || []).some(a => norm(a) === n)) || null;
}
// บัญชีในฐานข้อมูลของแต่ละบทบาท
export function accountFor(roleKey) {
  const acc = state.accounts;
  if (roleKey === 'Manager') return acc.find(a => a.role === 'MANAGER');
  if (roleKey === 'HR') return acc.find(a => a.role === 'HR');
  if (roleKey === 'Contractor / Van Driver') return acc.find(a => a.role === 'EXTERNAL');
  if (roleKey === 'Shift Employee') return acc.find(a => a.role === 'EMPLOYEE' && a.teamCode === 'A') || acc.find(a => a.role === 'EMPLOYEE');
  if (roleKey === 'Shift Employee B') return acc.find(a => a.role === 'EMPLOYEE' && a.teamCode === 'B');
  const sup = /^Shift Supervisor ([A-D])$/.exec(roleKey);
  if (sup) return acc.find(a => a.role === 'SUPERVISOR' && a.teamCode === sup[1]);
  return null;
}
// ชื่อบทบาทในหน้าจอ จากบัญชีที่เข้าสู่ระบบ ("Shift Employee B" แสดงเป็นพนักงานปฏิบัติเหมือนกัน)
export function roleKeyOf(actor) {
  if (actor.role === 'MANAGER') return 'Manager';
  if (actor.role === 'SUPERVISOR') return `Shift Supervisor ${actor.teamCode}`;
  if (actor.role === 'EMPLOYEE') return 'Shift Employee';
  if (actor.role === 'HR') return 'HR';
  return 'Contractor / Van Driver';
}

const SUP_NAV = [
  { id: 'schedule', label: 'ตารางกะ (Shift Schedule)' },
  { id: 'overview', label: 'ภาพรวมกำลังพล' },
  { id: 'requests', label: 'คิวคำขอตรวจสอบ', badge: 0 },
  { id: 'history', label: 'ประวัติการเปลี่ยนแปลง' }
];
// ข้อมูลบทบาท (ชื่อ ตำแหน่ง เมนู) ของผู้ที่เข้าสู่ระบบ
export function buildRole(roleKey, actor) {
  const team = actor.teamCode || 'A';
  const base = {
    Manager: { title: 'Manager (ฝ่ายผลิต)', short: 'ผู้จัดการฝ่ายผลิต', nav: [
      { id: 'manager-monitoring', label: 'ติดตามสถานะคำขอ' },
      { id: 'people', label: 'พนักงานและทีม' },
      { id: 'annual-schedule', label: 'ตารางรายปี (Annual Schedule)' },
      { id: 'manager-settings', label: 'ตั้งค่าระบบ (Settings)' }] },
    'Shift Employee': { title: `Shift Employee (Shift ${team})`, short: 'พนักงานปฏิบัติ', nav: [
      { id: 'team-schedule', label: 'กะของฉัน' },
      { id: 'my-requests', label: 'คำขอของฉัน', badge: 0 },
      { id: 'my-history', label: 'ประวัติของฉัน' }] },
    HR: { title: 'เจ้าหน้าที่ฝ่ายบุคคล', short: 'ฝ่ายบุคคล', nav: [
      { id: 'schedule', label: 'ตารางกะรวม (Schedule)' },
      { id: 'hr-export', label: 'ข้อมูลและส่งออก CSV' },
      { id: 'hr-audit', label: 'ตรวจสอบ OT และประวัติ' }] },
    'Contractor / Van Driver': { title: 'พนักงานขับรถตู้รับส่ง (สายหลัก) — External User', short: 'ผู้ใช้ภายนอก (External User)', nav: [] }
  }[roleKey] || { title: `Shift Supervisor (Shift ${team})`, short: `หัวหน้ากะ ${team}`, team: `shift${team}`, nav: SUP_NAV.map(n => ({ ...n })) };
  return { initials: String(actor.name || '').slice(0, 2), name: actor.name, ...base };
}
