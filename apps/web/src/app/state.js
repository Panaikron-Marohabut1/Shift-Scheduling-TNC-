/* ==========================================================================
   สถานะของหน้าเว็บ (state)
   --------------------------------------------------------------------------
   รูปแบบข้อมูลเดียวกับเวอร์ชันต้นแบบ ShiftFlow เพื่อให้หน้าจอและกฎทำงานเหมือนเดิมทุกอย่าง
   - ข้อมูลจากฐานข้อมูล (API):   พนักงาน ตารางกะ คำขอสลับกะ ประวัติ  → โหลดใหม่ทุกครั้ง ไม่เก็บในเครื่อง
   - ข้อมูลเดโมในเบราว์เซอร์:     ส่วนที่ระบบหลังบ้านยังไม่มี (ลา OT เปลี่ยนวันหยุด เปลี่ยนกะ
                                วันหยุดนักขัตฤกษ์ ประกาศทั้งปี ตั้งค่า แก้ข้อมูลพนักงาน คนขับรถ)
                                เก็บด้วย localStorage ภายใต้ LOCAL_KEY จนกว่าจะมี API รองรับ
   ========================================================================== */

// "วันนี้" ตามเวลาไทย (เปิดด้วย ?today=2026-10-20 เพื่อดูระบบ ณ วันอื่นได้)
function pickToday() {
  try {
    const q = new URLSearchParams(location.search).get('today');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q || '');
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } catch { /* ใช้วันที่จริง */ }
  const iso = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}
export const DEMO_TODAY = pickToday();

export const LOCAL_KEY = 'shiftflow.web.demo.v1';
// ฟิลด์ที่เก็บในเบราว์เซอร์ (เฉพาะส่วนที่ยังไม่มี API)
export const SAVED_FIELDS = ['localRequests', 'localLogs', 'scheduleOverrides', 'peopleEdits', 'publishedMonths', 'managerConfig', 'annualScheduleConfig', 'driverAcknowledged', 'driverAckTime'];

export const state = {
  activeRole: '',
  activeView: '',
  currentYear: DEMO_TODAY.getFullYear(),
  currentMonth: DEMO_TODAY.getMonth(),
  currentDay: DEMO_TODAY.getDate(),
  selectedShiftFilter: 'ALL',
  employeeTeamFilter: 'ALL',
  employeeSearch: '',
  monthPickerOpen: false,
  operatorShowFullGrid: false,
  annualScheduleYear: DEMO_TODAY.getFullYear(),

  // ---------- จากฐานข้อมูล ----------
  actor: null,            // ผู้ใช้ที่เข้าสู่ระบบ (จาก /api/me)
  accounts: [],           // บัญชีเดโม (จาก /api/demo/accounts)
  apiMonths: {},          // "ปี-เดือน(0-11)" → ผลของ /api/schedules (มี assignments)
  apiCodes: {},           // รหัสพนักงาน → "YYYY-MM-DD" → รหัสกะ (รวมการสลับที่อนุมัติแล้ว เช่น "N/M")
  apiAssign: {},          // รหัสพนักงาน → "YYYY-MM-DD" → รายการกะจาก API (ใช้ยื่นสลับกะ)
  apiRequests: [],        // คำขอสลับกะจาก API แปลงเป็นรูปแบบเดียวกับคำขอเดโม
  apiLogs: [],            // ประวัติจาก API
  shiftsData: {
    shiftA: { id: 'shiftA', name: 'Shift "A"', thaiName: 'กะชุด A', supervisorId: '', employees: [] },
    shiftB: { id: 'shiftB', name: 'Shift "B"', thaiName: 'กะชุด B', supervisorId: '', employees: [] },
    shiftC: { id: 'shiftC', name: 'Shift "C"', thaiName: 'กะชุด C', supervisorId: '', employees: [] },
    shiftD: { id: 'shiftD', name: 'Shift "D"', thaiName: 'กะชุด D', supervisorId: '', employees: [] }
  },

  // ---------- เดโมในเบราว์เซอร์ ----------
  localRequests: [],
  localLogs: [],
  scheduleOverrides: {},  // { "ปี-เดือน(0-11)": { รหัสพนักงาน: { วันที่: รหัสกะ } } }
  peopleEdits: { byId: {}, added: [] },
  publishedMonths: [],
  driverAcknowledged: false,
  driverAckTime: null,
  lastExport: null,       // เวลาส่งออกไฟล์ล่าสุด (แสดงในหน้าฝ่ายบุคคล)
  managerConfig: {
    shiftTimes: {
      M: '07:30–19:30 (รับ-ส่งกะถึง 20:00)',
      MT: '07:30–19:30 + OT x3.0',
      N: '19:30–07:30 (รับ-ส่งกะถึง 08:00)',
      NT: '19:30–07:30 + OT x3.0',
      D: '08:00–17:00'
    },
    standardHeadcount: { supervisor: 1, operator: 6 },
    swapRequestMonthlyLimit: 2,
    maxConsecutiveWorkDays: 6
  },
  annualScheduleConfig: {},

  // คำขอและประวัติที่หน้าจออ่าน = จาก API + เดโมในเครื่อง (คำนวณใหม่ทุกครั้งที่ข้อมูลเปลี่ยน)
  requests: [],
  auditLogs: [],
  roles: {},

  // รหัสกะทั้งหมด (ตามตารางกะของโรงงาน)
  shiftDefs: {
    M: { label: 'กะเช้า (Morning)', time: '07:30–19:30 (+รับ-ส่งกะถึง 20:00, OT x1.5)', family: 'M', ot: false, half: false, leave: false },
    MT: { label: 'กะเช้า + OT', time: '07:30–19:30 (+รับ-ส่งกะถึง 20:00, OT x3.0)', family: 'M', ot: true, half: false, leave: false },
    MTh: { label: 'กะเช้า + OT ครึ่งวัน', time: '07:30–13:30 (OT ครึ่งวัน)', family: 'M', ot: true, half: true, leave: false },
    N: { label: 'กะดึก (Night)', time: '19:30–07:30 (+รับ-ส่งกะถึง 08:00, OT x1.5)', family: 'N', ot: false, half: false, leave: false },
    NT: { label: 'กะดึก + OT', time: '19:30–07:30 (+รับ-ส่งกะถึง 08:00, OT x3.0)', family: 'N', ot: true, half: false, leave: false },
    NTh: { label: 'กะดึก + OT ครึ่งวัน', time: '19:30–01:30 (OT ครึ่งวัน)', family: 'N', ot: true, half: true, leave: false },
    OT: { label: 'ทำงานล่วงเวลา (OT เพิ่มเติม)', time: 'Overtime', family: 'OT', ot: true, half: false, leave: false },
    'N/M': { label: 'ปกติเช้า เปลี่ยนเป็นดึก', time: 'Shift Swap: M → N', family: 'swap', ot: false, half: false, leave: false },
    'M/N': { label: 'ปกติดึก เปลี่ยนเป็นเช้า', time: 'Shift Swap: N → M', family: 'swap', ot: false, half: false, leave: false },
    'M/O': { label: 'ปกติหยุด มาทำงานเช้า', time: 'Adjustment: O → M', family: 'swap', ot: false, half: false, leave: false },
    'N/O': { label: 'ปกติหยุด มาทำงานดึก', time: 'Adjustment: O → N', family: 'swap', ot: false, half: false, leave: false },
    'O/M': { label: 'ปกติเช้า เปลี่ยนเป็นหยุด', time: 'Adjustment: M → O', family: 'swap', ot: false, half: false, leave: false },
    'O/N': { label: 'ปกติดึก เปลี่ยนเป็นหยุด', time: 'Adjustment: N → O', family: 'swap', ot: false, half: false, leave: false },
    'O/M/N': { label: 'ปรับกะหลายขั้นตอน (หยุด → เช้า → ดึก)', time: 'Multi-step Adjustment: O → M → N', family: 'swap', ot: false, half: false, leave: false },
    'O/M/S': { label: 'ปรับกะ + ลาป่วย (หยุด → เช้า → ลาป่วย)', time: 'Adjustment + Sick Leave: O → M → S', family: 'swap', ot: false, half: false, leave: false },
    D: { label: 'เวลาทำการปกติ (Day)', time: '08:00–17:00 (กรณีหยุดเดินเครื่อง/ไม่เหมาะกับงานกะ)', family: 'D', ot: false, half: false, leave: false },
    O: { label: 'วันหยุด (Off)', time: 'พักผ่อนประจำสัปดาห์', family: 'O', ot: false, half: false, leave: false },
    V: { label: 'ลาพักร้อน (Vacation)', time: 'สูงสุด 18 วัน/ปี (ตามสิทธิ์รายบุคคล)', family: 'leave', ot: false, half: false, leave: true },
    B: { label: 'ลากิจ', time: 'เฉพาะเหตุที่บริษัทอนุญาต ไม่เกิน 6 วัน/ปี', family: 'leave', ot: false, half: false, leave: true },
    S: { label: 'ลาป่วย (Sick Leave)', time: 'สูงสุด 30 วัน/ปี', family: 'leave', ot: false, half: false, leave: true },
    H: { label: 'วันหยุดนักขัตฤกษ์', time: 'Holiday', family: 'leave', ot: false, half: false, leave: true },
    VG: { label: 'ลาอื่นๆ', time: 'Leave (Other)', family: 'leave', ot: false, half: false, leave: true },
    VGh: { label: 'ลาอื่นๆ ครึ่งวัน', time: 'Leave (Other, Half-day)', family: 'leave', ot: false, half: true, leave: true }
  }
};

// หน้าจอที่ยังไม่เกี่ยวกับข้อมูล (มุมมอง ช่องค้นหา ฟอร์มที่กำลังกรอก)
export const view = { signed: false, loginErr: '', loginUser: '', moreNav: false, mode: 'month', day: DEMO_TODAY.getDate(), q: '', rq: null, cell: null, loading: false };

/* ---------- เก็บข้อมูลเดโมในเบราว์เซอร์ ---------- */
let lastSaved = '';
export function loadLocal() {
  let data = null;
  try { const raw = localStorage.getItem(LOCAL_KEY); data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (data) SAVED_FIELDS.forEach(k => { if (data[k] !== undefined) state[k] = data[k]; });
  lastSaved = JSON.stringify(snapshot());
  return !!data;
}
function snapshot() { const out = {}; SAVED_FIELDS.forEach(k => { out[k] = state[k]; }); return out; }
export function saveLocal() {
  const text = JSON.stringify(snapshot());
  if (text === lastSaved) return;
  try { localStorage.setItem(LOCAL_KEY, text); lastSaved = text; } catch { /* เบราว์เซอร์ไม่ให้เก็บ */ }
}
export function clearLocal() { try { localStorage.removeItem(LOCAL_KEY); } catch { /* ไม่มีที่เก็บ */ } }
