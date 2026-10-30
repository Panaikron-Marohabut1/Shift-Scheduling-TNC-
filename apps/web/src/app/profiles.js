/* ==========================================================================
   บทบาทและเมนู
   --------------------------------------------------------------------------
   บัญชีที่เข้าสู่ระบบ (จาก /api/me) → ชื่อบทบาท ตำแหน่ง และเมนูที่แสดง
   สิทธิ์จริงตรวจที่ระบบหลังบ้านเสมอ เมนูนี้กำหนดเฉพาะหน้าที่แสดง
   ========================================================================== */

// ชื่อบทบาทในหน้าจอ จากบัญชีที่เข้าสู่ระบบ (พนักงานทุกทีมใช้หน้าพนักงานปฏิบัติเหมือนกัน)
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
