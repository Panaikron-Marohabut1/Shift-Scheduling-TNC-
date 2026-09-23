/**
 * ShiftFlow — Interactive Application Logic & Business Rules Engine
 * Implements authoritative specs from SRS (System Requirements Specification)
 * Redesigned Shift Schedule Layout: Clean, Modern, Shift-Grouped (Morning vs Night) & Week-Separated
 *
 * ---------------------------------------------------------------------------
 * แก้ไขให้ตรงตาม SRS (ดูสรุปการแก้ไขท้ายไฟล์):
 *  1) โครงสร้างทีม 4 ทีม (Shift A/B/C/D) x 7 ตำแหน่งต่อกะ (หัวหน้ากะ 1 + พนักงาน 6)
 *  2) รหัสกะครบตามข้อ 3 ของ SRS (N, M, O, VG, VGh, M/O, N/O, O/M, O/N, M/N, N/M,
 *     NT, MT, NTh, MTh, D, OT, V, B, S, H)
 *  3) จำกัดคำขอสลับ/เปลี่ยนกะไม่เกิน 2 ครั้ง/เดือน (บังคับจริงในระบบ ไม่ใช่แค่ข้อความ)
 *  4) เพิ่มบทบาทผู้จัดการฝ่ายผลิต (Manager) พร้อมหน้าตั้งค่าระบบ (ข้อ 8) และคิวอนุมัติขั้นสุดท้าย
 *  5) ล็อกข้อมูลย้อนหลังเมื่อพ้นเดือนปัจจุบัน (ข้อ 10)
 *  6) ดึงข้อมูลพนักงานอัตโนมัติ (รหัส/แผนก/เบอร์โทร) ลงในแบบฟอร์มคำขอ (ข้อ 9)
 *  7) รวมบทบาทวิศวกรฝ่ายผลิต (Engineer) เข้ากับผู้จัดการฝ่ายผลิต (Manager) — ตารางรายปีและตั้งค่าระบบอยู่ภายใต้ Manager
 *     และปรับชื่อบทบาทให้ตรงกัน: "หัวหน้ากะ" = Shift Supervisor, "พนักงานปฏิบัติ" = Shift Employee
 *  8) ย้ายเมนู "พนักงานและทีม" (จัดการสมาชิก/ย้ายทีม) จาก Shift Supervisor ไปไว้ที่ Manager เท่านั้น
 * ---------------------------------------------------------------------------
 */

// --------------------------------------------------------------------------
// Rotation Pattern Generator (2-on / 2-off, 8-day cycle: M,M,O,O,N,N,O,O)
// Used to generate realistic 31-day rosters for Shift C & Shift D, and for
// the additional 7th position added to Shift A & Shift B.
// --------------------------------------------------------------------------
function makeRotation(offset, days = 31, specialDays = {}) {
  const cycle = ['M', 'M', 'O', 'O', 'N', 'N', 'O', 'O'];
  const arr = Array.from({ length: days }, (_, d) => cycle[(d + offset) % cycle.length]);
  Object.keys(specialDays).forEach(dayNum => {
    arr[Number(dayNum) - 1] = specialDays[dayNum];
  });
  return arr;
}

// ==========================================================================
// SCHEDULE DATA AVAILABILITY
// ระบบมีข้อมูลตารางกะ "จริง" ที่นำเข้าจากไฟล์ Excel ต้นฉบับของโรงงาน
// (Shift_Schedule_August_2026_Rev.05.xlsx) เฉพาะเดือนสิงหาคม 2569 เท่านั้น
// เดือนอื่นๆ ยังไม่มีการนำเข้าข้อมูลจริง ระบบจึง "คาดการณ์" ตารางกะของเดือนอื่นให้
// โดยต่อรอบการทำงาน 2 วันสลับ 2 วัน (2-on 2-off) ของพนักงานแต่ละคนจากเดือนสิงหาคม
// ไปเรื่อยๆ แบบ "ยังไม่มีการสลับ/ปรับกะใดๆ เกิดขึ้นเลย" (ไม่ดึงรหัสสลับกะ M/N, O/M ฯลฯ
// ที่เกิดขึ้นจริงแล้วในเดือนสิงหาคมมาปนด้วย) เพื่อให้มีฐานตารางกะที่สมเหตุสมผลสำหรับ
// ทดสอบยื่น/อนุมัติคำขอในเดือนอื่นๆ ได้ — ส่วนเดือนสิงหาคมยังคงแสดงข้อมูลจริงเป๊ะๆ เหมือนเดิม
// ==========================================================================
const SCHEDULE_DATA_YEAR = 2026;
const SCHEDULE_DATA_MONTH = 7; // 0-indexed: 7 = สิงหาคม (August)
function hasScheduleDataForMonth(year, month) {
  return year === SCHEDULE_DATA_YEAR && month === SCHEDULE_DATA_MONTH;
}

// "วันนี้" ของ prototype — นาฬิกาเดโมตัวเดียวของทั้งแอป ใช้แทน new Date() ทุกจุดที่อ้างถึงปัจจุบัน
// เพื่อให้ตัวอย่าง deterministic (ผูกกับเดือนที่มีข้อมูลจริง) — ห้ามใช้เป็นเวลาจริงใน production/audit
const DEMO_TODAY = new Date(SCHEDULE_DATA_YEAR, SCHEDULE_DATA_MONTH, 12);

// Global App State
const state = {
  activeRole: 'Manager',
  activeView: 'manager-approvals',
  currentYear: DEMO_TODAY.getFullYear(),
  currentMonth: DEMO_TODAY.getMonth(), // 0-indexed: เริ่มที่เดือนที่มีข้อมูลจริง (สิงหาคม 2569)
  currentDay: DEMO_TODAY.getDate(), // "วันนี้" ของ demo — ย้ายได้ที่ DEMO_TODAY จุดเดียว
  selectedShiftFilter: 'ALL', // 'ALL', 'A', 'B', 'C', 'D'
  employeeTeamFilter: 'ALL',
  employeeSearch: '',
  scheduleDrafts: 0,
  monthPickerOpen: false, // เปิด/ปิดหน้าต่างเลือกเดือน-ปีโดยตรง (แทนการกดลูกศรเลื่อนทีละเดือน)
  // พนักงานปฏิบัติ (Shift Employee): false = หน้ากะของฉันแบบง่าย (ค่าเริ่มต้น), true = ตารางกะเต็มรูปแบบทุกทีม
  operatorShowFullGrid: false,
  // การแก้ไข/ทดสอบตารางกะในเดือนที่ยังไม่มีข้อมูลจริง เก็บแยกไว้ที่นี่
  // (ไม่เขียนทับ shifts[] ของพนักงาน ซึ่งเป็นข้อมูลจริงของเดือนสิงหาคมเท่านั้น)
  // รูปแบบ: { "<year>-<month>": { "<empId>": { "<day>": "<code>" } } }
  scheduleOverrides: {},
  unreadNotifications: 2,
  hrDateFilter: '2026-08',
  driverAcknowledged: false,
  driverAckTime: null,

  // Backlog & Excel Shift Codes — ครบตามข้อ 3 ของ SRS (Shift Codes & Definitions)
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
    // รหัสปรับกะหลายขั้นตอน พบในตารางกะจริงเดือนสิงหาคม 2569 (Rev.05) — ใช้บันทึกกรณีปรับกะมากกว่า 1 ครั้งในช่วงเวลาเดียวกัน
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
  },

  // Role Profiles — เรียงตามระดับสิทธิ์การเข้าถึงข้อมูล: Manager → Shift Supervisor → Shift Employee → HR → External User
  roles: {
    Manager: {
      initials: 'MG',
      name: 'ธนากร ผู้จัดการดี',
      title: 'Manager (ฝ่ายผลิต)',
      short: 'ผู้จัดการฝ่ายผลิต',
      nav: [
        { id: 'manager-approvals', label: 'คิวอนุมัติขั้นสุดท้าย', icon: 'inbox' },
        { id: 'people', label: 'พนักงานและทีม', icon: 'users' },
        { id: 'annual-schedule', label: 'ตารางรายปี (Annual Schedule)', icon: 'calendar' },
        { id: 'manager-settings', label: 'ตั้งค่าระบบ (Settings)', icon: 'grid' }
      ]
    },
    'Shift Supervisor': {
      initials: 'ณด',
      name: 'ณัฐพล ดวงประสิทธิ์',
      title: 'Shift Supervisor (Shift A)',
      short: 'หัวหน้ากะ',
      nav: [
        { id: 'schedule', label: 'ตารางกะ (Shift Schedule)', icon: 'calendar' },
        { id: 'overview', label: 'ภาพรวมกำลังพล', icon: 'grid' },
        { id: 'requests', label: 'คิวคำขอตรวจสอบ', icon: 'check-square', badge: 2 },
        { id: 'history', label: 'ประวัติการเปลี่ยนแปลง', icon: 'history' }
      ]
    },
    'Shift Employee': {
      initials: 'วน',
      name: 'วราเทพ นิยากุล',
      title: 'Shift Employee (Shift A)',
      short: 'พนักงานปฏิบัติ',
      nav: [
        { id: 'team-schedule', label: 'กะของฉัน', icon: 'calendar' },
        { id: 'my-requests', label: 'คำขอของฉัน', icon: 'inbox', badge: 2 },
        { id: 'my-history', label: 'ประวัติของฉัน', icon: 'history' }
      ]
    },
    HR: {
      initials: 'HR',
      name: 'ฝ่ายทรัพยากรบุคคล (HR)',
      title: 'เจ้าหน้าที่ฝ่ายบุคคล',
      short: 'ฝ่ายบุคคล',
      nav: [
        { id: 'schedule', label: 'ตารางกะรวม (Schedule)', icon: 'calendar' },
        { id: 'hr-export', label: 'ข้อมูลและส่งออก CSV', icon: 'download' },
        { id: 'hr-audit', label: 'ตรวจสอบ OT และประวัติ', icon: 'file-text' }
      ]
    },
    'Contractor / Van Driver': {
      initials: 'VD',
      name: 'สมชาย ประเสริฐ (คนขับรถ)',
      title: 'พนักงานขับรถตู้รับส่ง (สายหลัก) — External User',
      short: 'ผู้ใช้ภายนอก (External User)',
      nav: []
    }
  },

  // Shift A / B / C / D Roster Data — โครงสร้าง 7 ตำแหน่งต่อกะ: 1 หัวหน้ากะ (Shift Supervisor - S) + 6 พนักงานกะ (Shift Operator: Boardman / Field Operator)
  shiftsData: {
    shiftA: {
      id: "shiftA",
      name: "Shift \"A\"",
      thaiName: "กะชุด A",
      supervisorId: "130",
      employees: [
        {
          id: "130", code: "130", name: "ณัฐพล ดวงประสิทธิ์", phone: "081-575-5353", initials: "ณด",
          roleCategory: "Shift Supervisor", position: "Shift Supervisor (S)", shiftType: "Shift A",
          shifts: ["O", "V", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N"]
        },
        {
          id: "140", code: "140", name: "วราเทพ นิยากุล", phone: "096-959-6293", initials: "วน",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift A",
          shifts: ["O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "V", "O", "O", "M", "M", "O", "O", "N", "N"]
        },
        {
          id: "110", code: "110", name: "สมหวัง ศรีเมฆ", phone: "098-251-7614", initials: "สศ",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift A",
          shifts: ["O", "M", "M", "MT", "MT", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "V", "V", "O", "O", "M", "M", "O", "O", "N", "N"]
        },
        {
          id: "147", code: "147", name: "สิทธิชัย เนตรหลับ", phone: "094-425-5864", initials: "สเ",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift A",
          shifts: ["MT", "S", "M", "O", "O", "N", "N", "O", "O", "N/M", "N/M", "O", "O", "V", "V", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N"]
        },
        {
          id: "198", code: "198", name: "ปภวิชญ์ สมุทรเขต", phone: "088-261-4190", initials: "ปส",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift A",
          shifts: ["O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "N/O", "N", "N", "O", "O", "M", "M", "O", "O", "O/N", "V", "O", "O", "M", "M", "O", "M/O", "N", "O/N"]
        },
        {
          id: "218", code: "218", name: "นันทวัฒน์ รัตนศรี", phone: "085-1627756", initials: "นร",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift A",
          shifts: ["MT", "M", "M", "O", "O", "N", "N", "O", "O", "N/M", "N/M", "O", "O", "N", "N", "O", "O", "M", "V", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N"]
        },
        {
          id: "220", code: "220", name: "อภิสิทธิ์ วงศ์สว่าง", phone: "089-112-3401", initials: "อว",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift A",
          shifts: ["O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N"]
        },
      ]
    },
    shiftB: {
      id: "shiftB",
      name: "Shift \"B\"",
      thaiName: "กะชุด B",
      supervisorId: "138",
      employees: [
        {
          id: "138", code: "138", name: "สุระศักดิ์ สงหลำ", phone: "065-2463145", initials: "สส",
          roleCategory: "Shift Supervisor", position: "Shift Supervisor (S)", shiftType: "Shift B",
          shifts: ["M/N", "MT", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O"]
        },
        {
          id: "164", code: "164", name: "ยุรนันท์ พรหมจรรย์", phone: "062-698-8171", initials: "ยพ",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift B",
          shifts: ["N", "O", "O", "V", "V", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "NT", "N", "N", "O", "O", "M", "M", "O", "O"]
        },
        {
          id: "177", code: "177", name: "วยสกร พิมคีรี", phone: "063-659-4695", initials: "วพ",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift B",
          shifts: ["N", "O", "O", "M", "M", "MT", "O", "N", "N", "O", "O", "M", "M", "M/O", "O", "N", "N", "O", "MT", "M", "O/M", "NT", "NT", "N", "N", "O", "O", "M", "M", "O", "O"]
        },
        {
          id: "181", code: "181", name: "กัณฑ์เอนก สุวัฒนกุล", phone: "086-287-7832", initials: "กส",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift B",
          shifts: ["M", "MT", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "MT", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "O/M", "O", "N/O"]
        },
        {
          id: "201", code: "201", name: "เสกสรรค์ ภิริโย", phone: "094-962-9532", initials: "เภ",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift B",
          shifts: ["N", "O", "O", "M", "M", "O", "O", "O/N", "N", "O", "M/O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O"]
        },
        {
          id: "205", code: "205", name: "วัชรพงศ์ ซ้องกา", phone: "064-878-6650", initials: "วซ",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift B",
          shifts: ["M", "O", "O", "M", "M", "MT", "O", "N", "N", "O", "O", "M", "M", "MT", "NT", "N", "N", "O", "O", "M", "M", "O", "NT", "N", "N", "O", "O", "M", "M", "MT", "O"]
        },
        {
          id: "221", code: "221", name: "กฤษดา รัตนกุล", phone: "089-112-3402", initials: "กร",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift B",
          shifts: ["N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O"]
        },
      ]
    },
    shiftC: {
      id: "shiftC",
      name: "Shift \"C\"",
      thaiName: "กะชุด C",
      supervisorId: "123",
      employees: [
        {
          id: "123", code: "123", name: "โรจนะ ยังสุข", phone: "087-135-6475", initials: "โย",
          roleCategory: "Shift Supervisor", position: "Shift Supervisor (S)", shiftType: "Shift C",
          shifts: ["O", "M/N", "M/N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M"]
        },
        {
          id: "137", code: "137", name: "ศิริพงษ์ ประชาโชติ", phone: "086-376-9083", initials: "ศป",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift C",
          shifts: ["O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "V", "V", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M"]
        },
        {
          id: "166", code: "166", name: "ไวยวิทย์ ขยายวงค์", phone: "090-621-7251", initials: "ไข",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift C",
          shifts: ["O", "N", "N", "O", "O", "M", "M", "O", "O", "M/N", "M/N", "O", "O", "O/M", "O/M", "O", "O", "N", "N", "O", "M/O", "M", "M", "M/O", "O", "N", "N", "O", "O", "M", "M"]
        },
        {
          id: "161", code: "161", name: "กิตติกร ทิพย์เคลือบ", phone: "094-984-6868", initials: "กท",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift C",
          shifts: ["MT", "M", "B", "O", "O", "M", "M", "N/O", "O", "M/N", "O/M/N", "O", "O", "V", "V", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M"]
        },
        {
          id: "207", code: "207", name: "ปรเมษฐ นันอุมาลี", phone: "064-052-7512", initials: "ปน",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift C",
          shifts: ["O", "M/N", "M/N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "MT", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M"]
        },
        {
          id: "214", code: "214", name: "ภาณุวัฒน์ ชำนิประโคน", phone: "095-497-7497", initials: "ภช",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift C",
          shifts: ["O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "O/M/S", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "N/O", "O", "V", "M"]
        },
        {
          id: "222", code: "222", name: "ธีรพงษ์ สมบัติ", phone: "089-112-3403", initials: "ธส",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift C",
          shifts: ["O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M"]
        },
      ]
    },
    shiftD: {
      id: "shiftD",
      name: "Shift \"D\"",
      thaiName: "กะชุด D",
      supervisorId: "71",
      employees: [
        {
          id: "71", code: "71", name: "วีรพล พุทธตาล", phone: "061-935-6628", initials: "วพ",
          roleCategory: "Shift Supervisor", position: "Shift Supervisor (S)", shiftType: "Shift D",
          shifts: ["M", "O", "O", "M/N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O"]
        },
        {
          id: "118", code: "118", name: "ไพศาล ฉายาชวลิต", phone: "081-176-3650", initials: "ไฉ",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift D",
          shifts: ["M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "MT", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O"]
        },
        {
          id: "180", code: "180", name: "อลงกรณ์ หวังแซงกลาง", phone: "094-064-9618", initials: "อห",
          roleCategory: "Shift Employee", position: "Boardman (DCS)", shiftType: "Shift D",
          shifts: ["M", "MT", "O", "M/N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "MT", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O"]
        },
        {
          id: "206", code: "206", name: "สุลักษณ์ ศรีธาราม", phone: "092-117-9292", initials: "สศ",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift D",
          shifts: ["M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "NT", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O"]
        },
        {
          id: "169", code: "169", name: "ธนัท บูรพาเจริญ", phone: "092-949-8478", initials: "ธบ",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift D",
          shifts: ["M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "M/O", "S", "M", "O", "O", "S", "N", "O", "O", "M", "M", "O", "O", "O/N", "V", "O", "O"]
        },
        {
          id: "36", code: "36", name: "ชูชีพ จูทารี", phone: "084-0853337", initials: "ชจ",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift D",
          shifts: ["M", "O", "O", "M/N", "N", "O", "O", "M", "M", "O", "O", "N", "O/N", "O", "M/O", "M", "M", "O", "O", "N", "N", "N/O", "O", "O/M", "M", "O", "O", "N", "N", "O", "O"]
        },
        {
          id: "213", code: "213", name: "ศุภวิชญ์ เภตราเสถียร", phone: "099-028-7190", initials: "ศเ",
          roleCategory: "Shift Employee", position: "Field Operator", shiftType: "Shift D",
          shifts: ["M", "O", "O", "M/N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O", "M", "M", "O", "O", "N", "N", "O", "O"]
        },
      ]
    },
  },
  // Requests Queue Data
  requests: [
    {
      id: 101,
      type: 'สลับกะข้ามทีม (Shift A ↔ Shift B)',
      person: 'วราเทพ นิยากุล',
      requesterId: '140',
      initials: 'วน',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: 'กัณฑ์เอนก สุวัฒนกุล',
      targetRole: 'Shift Employee (Shift B)',
      date: '14 ส.ค. 2569',
      currentShift: 'N',
      targetShift: 'M',
      reason: 'ขอสลับกะกับเพื่อนร่วมงานต่างทีม (N↔M ข้ามทีม A↔B)',
      isCrossShift: true,
      approvers: [
        { role: 'Shift Supervisor B (สุระศักดิ์)', status: 'approved', at: '08:15' },
        { role: 'Shift Supervisor A (ณัฐพล)', status: 'pending' }
      ],
      status: 'รออนุมัติครบ 2 ฝ่าย',
      submittedAt: '1 ชั่วโมงที่แล้ว',
      quotaUsed: '1 / 2 ครั้ง'
    },
    {
      id: 103,
      type: 'ขอทำ OT',
      person: 'วราเทพ นิยากุล',
      requesterId: '140',
      initials: 'วน',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: null,
      targetRole: null,
      date: '20 ส.ค. 2569',
      currentShift: 'O',
      targetShift: 'OT',
      reason: 'ขอทำงานล่วงเวลาในวันหยุด — เสริมกำลังสายผลิตช่วงสั่งซื้อด่วน',
      isCrossShift: false,
      approvers: [
        { role: 'หัวหน้ากะตรวจสอบ (Shift A)', status: 'pending' },
        { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }
      ],
      status: 'รอดำเนินการ',
      submittedAt: '20 นาทีที่แล้ว',
      quotaUsed: '-'
    }
  ],

  // Audit History Logs
  auditLogs: [
    { id: 4, actor: 'วราเทพ นิยากุล', employeeId: '140', avatar: 'วน', action: 'ยื่นคำขอสลับกะข้ามทีม (Shift A ↔ Shift B) วันที่ 14 ส.ค. 2569', time: 'วันนี้ 08:35 น.' },
    { id: 6, actor: 'วราเทพ นิยากุล', employeeId: '140', avatar: 'วน', action: 'ยื่นคำขอทำงานล่วงเวลา (OT) วันที่ 20 ส.ค. 2569', time: 'วันนี้ 08:05 น.' },
    { id: 1, actor: 'ณัฐพล ดวงประสิทธิ์', avatar: 'ณด', action: 'อนุมัติตารางกะประจำเดือนสิงหาคม 2569 (August 2026 Official)', time: 'วันนี้ 08:42 น.' },
    { id: 3, actor: 'สุระศักดิ์ สงหลำ', avatar: 'สส', action: 'ยืนยันกะดึก OT ของยุรนันท์และวัชรพงศ์', time: 'เมื่อวาน 17:30 น.' }
  ],

  // Schedule Publishing (Feature List) — เก็บเดือนที่เผยแพร่แล้วเป็น "YYYY-MM" (format เดียวกับ hrDateFilter)
  publishedMonths: ['2026-08'],

  // Manager Self-Service Config (ข้อ 8 SRS) — mock editable configuration (ดูแลโดยบทบาทผู้จัดการฝ่ายผลิต)
  managerConfig: {
    shiftTimes: {
      M: '07:30–19:30 (รับ-ส่งกะถึง 20:00)',
      MT: '07:30–19:30 + OT x3.0',
      N: '19:30–07:30 (รับ-ส่งกะถึง 08:00)',
      NT: '19:30–07:30 + OT x3.0',
      D: '08:00–17:00'
    },
    // โครงสร้างตำแหน่งในแต่ละกะ (7 ตำแหน่งต่อกะ):
    // - หัวหน้ากะ (Shift Supervisor - S): 1 ตำแหน่งต่อกะ ทำหน้าที่รับผิดชอบและดูแลการทำงานรวมของทั้งกระบวนการผลิต
    // - พนักงานกะ (Shift Operator): 6 ตำแหน่ง (Boardman ดูแลระบบควบคุม DCS / Field Operator ดูแลเครื่องจักร สลับตำแหน่งกันได้เมื่อมีประสบการณ์)
    standardHeadcount: { supervisor: 1, operator: 6 },
    swapRequestMonthlyLimit: 2,
    // ตาม SRS §4: ทำงานติดต่อกันได้สูงสุด 6 วัน — วันที่ 7 ห้ามทำงานทุกรูปแบบ (ปกติ/OT/สลับ/D)
    maxConsecutiveWorkDays: 6
  },

  // ปีที่กำลังดูอยู่ในหน้า "ตารางรายปี" ของบทบาทผู้จัดการฝ่ายผลิต
  annualScheduleYear: 2026,
  // ผังตารางรายปีของบริษัท (ดูแลโดยบทบาทผู้จัดการฝ่ายผลิต) — เก็บแยกตามปี ค.ศ.
  // key = ปี ค.ศ. (เช่น 2026), value = { teamFamily, holidays }
  annualScheduleConfig: {
    2026: {
      teamFamily: { 'Shift A': 'M', 'Shift B': 'N', 'Shift C': 'N', 'Shift D': 'M' },
      holidays: ['01 ม.ค. 2569', '08 เม.ย. 2569', '13–15 เม.ย. 2569', '01 พ.ค. 2569', '12 ส.ค. 2569 (วันแม่แห่งชาติ)', '05 ธ.ค. 2569']
    }
  }
};

// Helper to get all employees (ครบทั้ง 4 ทีม)
function getAllEmployees() {
  return [
    ...state.shiftsData.shiftA.employees,
    ...state.shiftsData.shiftB.employees,
    ...state.shiftsData.shiftC.employees,
    ...state.shiftsData.shiftD.employees
  ];
}

function findEmployeeById(id) {
  return getAllEmployees().find(e => e.id === id);
}

function getTeamKeyByLabel(label) {
  const map = { 'Shift A': 'shiftA', 'Shift B': 'shiftB', 'Shift C': 'shiftC', 'Shift D': 'shiftD' };
  return map[label];
}

// จำนวนคำขอสลับ/เปลี่ยนกะของพนักงานในเดือนปัจจุบัน (สูงสุด 2 ครั้ง/เดือน ตามข้อ 6 SRS)
function countMonthlySwapRequests(employeeId) {
  if (!employeeId) return 0;
  return state.requests.filter(r => {
    const isSwapType = r.type && (r.type.includes('สลับกะ') || r.type.includes('เปลี่ยนกะ'));
    const isSameEmployee = r.requesterId === employeeId;
    const isActive = r.status !== 'ไม่อนุมัติ' && r.status !== 'ยกเลิกแล้ว'; // rejected/cancelled requests don't consume quota
    return isSwapType && isSameEmployee && isActive;
  }).length;
}

// ==========================================================================
// ตารางกะ "คาดการณ์" สำหรับเดือนที่ยังไม่มีข้อมูลจริง
// ต่อรอบ 2 วันทำงานสลับ 2 วันหยุด (คาบ 8 วัน) ของพนักงานแต่ละคนจากเดือนสิงหาคม
// โดยไม่ดึงรหัสสลับกะ/ลา/OT ที่เกิดขึ้นจริงแล้วในเดือนสิงหาคมมาปนด้วย
// ==========================================================================
const ROTATION_CYCLE_DAYS = 8;
const _basePatternCache = {};

function getEmployeeBasePattern(emp) {
  if (_basePatternCache[emp.id]) return _basePatternCache[emp.id];

  const leaveCodes = new Set(['V', 'B', 'S', 'H', 'VG', 'VGh']);
  const votes = Array.from({ length: ROTATION_CYCLE_DAYS }, () => ({}));

  emp.shifts.forEach((code, idx) => {
    const pos = idx % ROTATION_CYCLE_DAYS;
    let family = null;

    if (code === 'O') {
      family = 'O';
    } else if (code.includes('/')) {
      // รหัสสลับ/ปรับกะ เช่น "N/M" หรือ "O/M/N" — หาค่า "ต้นฉบับ/ปกติ" จากส่วนที่ไม่ใช่รหัสลา
      const parts = code.split('/');
      for (let i = parts.length - 1; i >= 0; i--) {
        if (!leaveCodes.has(parts[i]) && state.shiftDefs[parts[i]]) {
          const fam = state.shiftDefs[parts[i]].family;
          if (fam === 'M' || fam === 'N' || fam === 'O' || fam === 'D') { family = fam; break; }
        }
      }
    } else if (!leaveCodes.has(code) && state.shiftDefs[code]) {
      const fam = state.shiftDefs[code].family;
      if (fam === 'M' || fam === 'N' || fam === 'O' || fam === 'D') family = fam;
    }

    if (family) votes[pos][family] = (votes[pos][family] || 0) + 1;
  });

  const pattern = votes.map(v => {
    const entries = Object.entries(v);
    if (!entries.length) return 'O';
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  });

  _basePatternCache[emp.id] = pattern;
  return pattern;
}

function daysBetweenDates(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

// ==========================================================================
// ตารางรายปีของบริษัท (ดูแลโดยบทบาทผู้จัดการฝ่ายผลิต — Manager)
// กำหนด "ทิศทาง" การหมุนเวียนกะของแต่ละทีม (เริ่มกะเช้าก่อน หรือกะดึกก่อน) และ
// วันหยุดนักขัตฤกษ์ แยกเก็บเป็นรายปี แก้ไขย้อนหลัง/ล่วงหน้าได้ทุกปีโดยไม่จำกัด
// การตั้งค่านี้เป็นเพียง "ผังรายปี" ระดับทีม ไม่ยุ่งกับกะรายวันของพนักงานรายคน และ
// จะมีผลเฉพาะเดือนที่ยังไม่มีข้อมูลจริง (เดือนที่มีข้อมูลจริงคือสิงหาคม 2569 จะไม่ถูกเขียนทับ)
// ==========================================================================

// ทิศทางตามธรรมชาติของแต่ละทีม อ้างอิงจากข้อมูลจริงเดือนสิงหาคม 2569
// (Shift A, D เริ่มกะเช้าก่อน (M) / Shift B, C เริ่มกะดึกก่อน (N))
const NATURAL_TEAM_FAMILY = { 'Shift A': 'M', 'Shift B': 'N', 'Shift C': 'N', 'Shift D': 'M' };
const ANNUAL_SCHEDULE_TEAMS = ['Shift A', 'Shift B', 'Shift C', 'Shift D'];

function getDefaultAnnualConfig() {
  return {
    teamFamily: { ...NATURAL_TEAM_FAMILY },
    holidays: []
  };
}

// ดึงค่าตั้งค่ารายปี ถ้าปีนั้นยังไม่เคยมีการตั้งค่ามาก่อนจะสร้างค่าเริ่มต้นให้อัตโนมัติ
// (ทิศทางตามธรรมชาติ + ไม่มีวันหยุด) เพื่อให้ผู้จัดการเข้ามาแก้ไขปีไหนก็ได้ทันที
function getAnnualConfig(year) {
  if (!state.annualScheduleConfig[year]) {
    state.annualScheduleConfig[year] = getDefaultAnnualConfig();
  }
  return state.annualScheduleConfig[year];
}

function getHolidaysForYear(year) {
  return getAnnualConfig(year).holidays;
}

function getTeamFamilyForYear(shiftType, year) {
  const cfg = getAnnualConfig(year);
  return (cfg.teamFamily && cfg.teamFamily[shiftType]) || NATURAL_TEAM_FAMILY[shiftType] || 'M';
}

function flipShiftFamily(code) {
  if (code === 'M') return 'N';
  if (code === 'N') return 'M';
  return code;
}

// จุดเข้าถึงรหัสกะเดียวสำหรับทั้งแอป: เดือนสิงหาคม 2569 = ข้อมูลจริง,
// เดือนอื่น = ค่าที่แก้ไขไว้ (ถ้ามี) หรือค่าคาดการณ์จากรอบการทำงานของพนักงานคนนั้น
// (ปรับทิศทางเช้า/ดึกตามผังตารางรายปีที่ผู้จัดการฝ่ายผลิตตั้งค่าไว้สำหรับปีนั้นๆ ด้วย)
function getShiftCodeForDate(emp, year, month, day) {
  if (!emp) return 'O';
  if (hasScheduleDataForMonth(year, month)) {
    return emp.shifts[day - 1] || 'O';
  }
  const key = `${year}-${month}`;
  const override = state.scheduleOverrides[key] && state.scheduleOverrides[key][emp.id] && state.scheduleOverrides[key][emp.id][day];
  if (override) return override;

  const pattern = getEmployeeBasePattern(emp);
  const diff = daysBetweenDates(new Date(year, month, day), new Date(SCHEDULE_DATA_YEAR, SCHEDULE_DATA_MONTH, 1));
  const pos = ((diff % ROTATION_CYCLE_DAYS) + ROTATION_CYCLE_DAYS) % ROTATION_CYCLE_DAYS;
  let code = pattern[pos];

  const naturalFamily = NATURAL_TEAM_FAMILY[emp.shiftType];
  const yearFamily = getTeamFamilyForYear(emp.shiftType, year);
  if (naturalFamily && yearFamily && naturalFamily !== yearFamily) {
    code = flipShiftFamily(code);
  }
  return code;
}

function setShiftOverride(empId, year, month, day, code) {
  const key = `${year}-${month}`;
  if (!state.scheduleOverrides[key]) state.scheduleOverrides[key] = {};
  if (!state.scheduleOverrides[key][empId]) state.scheduleOverrides[key][empId] = {};
  state.scheduleOverrides[key][empId][day] = code;
}

function isMonthLocked(year, month) {
  const today = DEMO_TODAY;
  if (year < today.getFullYear()) return true;
  if (year === today.getFullYear() && month < today.getMonth()) return true;
  return false;
}

// ข้อ 6 SRS: สร้างลำดับการอนุมัติคำขอสลับกะ — สลับได้เฉพาะข้ามทีมเท่านั้น
// หัวหน้ากะของฝ่ายที่จะรับคนมาทำงานอนุมัติก่อน แล้วหัวหน้ากะอีกฝ่ายให้ความยินยอม (ไม่ผ่าน Manager ยกเว้น OT/เคสพิเศษ)
function buildApprovalChain(aEmp, bEmp) {
  const teamAKey = getTeamKeyByLabel(aEmp.shiftType);
  const teamBKey = bEmp ? getTeamKeyByLabel(bEmp.shiftType) : null;
  const supA = teamAKey ? state.shiftsData[teamAKey].employees.find(e => e.id === state.shiftsData[teamAKey].supervisorId) : null;
  const supB = teamBKey ? state.shiftsData[teamBKey].employees.find(e => e.id === state.shiftsData[teamBKey].supervisorId) : null;

  const chain = [];
  if (bEmp) chain.push({ role: `Shift Supervisor B (${supB ? supB.name.split(' ')[0] : bEmp.shiftType})`, status: 'pending' });
  chain.push({ role: `Shift Supervisor A (${supA ? supA.name.split(' ')[0] : aEmp.shiftType})`, status: 'pending' });
  return { chain, isCrossTeam: true };
}

function isMonthPublished(year, month) {
  return state.publishedMonths.includes(`${year}-${String(month + 1).padStart(2, '0')}`);
}

function publishSchedule() {
  const key = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}`;
  if (state.publishedMonths.includes(key)) {
    showToast('ตารางกะเดือนนี้เผยแพร่แล้ว');
    return;
  }
  state.publishedMonths.push(key);
  state.auditLogs.unshift({
    id: Date.now(),
    actor: state.roles[state.activeRole]?.name || state.activeRole,
    avatar: state.roles[state.activeRole]?.initials || '--',
    action: `เผยแพร่ตารางกะประจำเดือน${thaiMonthName(state.currentMonth)} ${state.currentYear + 543} (Schedule Publishing)`,
    time: 'เมื่อสักครู่'
  });
  showToast('เผยแพร่ตารางกะเรียบร้อยแล้ว ✓');
  renderApp();
}

// SVG Icon Library
function getIcon(name, className = 'icon') {
  const icons = {
    grid: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    'check-square': '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
    history: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
    search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    sun: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    x: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    alert: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    chevronDown: '<polyline points="6 9 12 15 18 9"></polyline>',
    clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
  };

  const svgInner = icons[name] || icons.grid;
  return `<svg class="${className}" viewBox="0 0 24 24">${svgInner}</svg>`;
}

// Business Rules Validation Engine (§7 & E04: 2-on 2-off rotating & Max 6 days)
// --------------------------------------------------------------------------
// Shift Family Helpers & Swap/OT Transition Rules
// ตามข้อกำหนดการเปลี่ยน/สลับกะ: "Con 4 check for swap"
//  1) ถ้าวันเดิมเป็นวันหยุด (O) → เปลี่ยนได้เลย
//  2) ก่อน-หลังวันที่เปลี่ยน ภายใน 6 วัน ต้องมีวันหยุดอย่างน้อย 1 วัน
//  3) ถ้าเปลี่ยน "เป็นกะดึก" (→N) ตรวจสอบวันหยุดก่อน-หลังภายใน 6 วัน (M→N / N→N อนุญาต)
//  4) ถ้าเปลี่ยน "เป็นกะเช้า" (→M) ตรวจสอบว่าวันก่อนหน้าเป็นกะดึกหรือไม่
//     (M→M อนุญาต, N→M ไม่อนุญาตถ้าไม่มีวันหยุดคั่น เพราะพักผ่อนไม่พอ)
// --------------------------------------------------------------------------
function getShiftFamily(code) {
  const def = state.shiftDefs[code];
  if (!def) return 'OTHER';
  if (code === 'O') return 'O';
  if (def.leave) return 'LEAVE';
  if (code === 'D') return 'D';
  if (['M', 'MT', 'MTh'].includes(code)) return 'M';
  if (['N', 'NT', 'NTh'].includes(code)) return 'N';
  return 'OTHER';
}

function isLeaveCode(code) {
  return getShiftFamily(code) === 'LEAVE';
}

function checkShiftTransitionRules(emp, targetDay, targetShiftCode) {
  const results = [];
  let hasHardBlock = false;

  const targetFamily = getShiftFamily(targetShiftCode);
  const currentCodeOnDay = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, targetDay);
  const currentFamily = getShiftFamily(currentCodeOnDay);
  const prevCode = targetDay > 1 ? getShiftCodeForDate(emp, state.currentYear, state.currentMonth, targetDay - 1) : null;
  const prevFamily = prevCode ? getShiftFamily(prevCode) : null;

  // เงื่อนไข 1: สถานะวันเดิม
  if (currentFamily === 'O') {
    results.push({ rule: 'เงื่อนไข 1: สถานะวันเดิม', status: 'pass', msg: 'วันดังกล่าวเดิมเป็นวันหยุด (O) — เปลี่ยนกะได้ทันที' });
  } else {
    results.push({ rule: 'เงื่อนไข 1: สถานะวันเดิม', status: 'pass', msg: `วันดังกล่าวเดิมเป็นกะ ${currentCodeOnDay} — ตรวจสอบเงื่อนไขทิศทางกะด้านล่าง` });
  }

  // เงื่อนไข 3/4: ทิศทางการสลับกะ (Morning ↔ Night Matrix)
  if (targetFamily === 'N') {
    results.push({ rule: 'เงื่อนไข 3: เปลี่ยนเป็นกะดึก (M→N / N→N)', status: 'pass', msg: 'อนุญาตให้เปลี่ยน/สลับเป็นกะดึกได้ — ตรวจสอบวันหยุดตามรอบ 6 วันด้านล่างประกอบ' });
  } else if (targetFamily === 'M') {
    if (prevFamily === 'N') {
      results.push({
        rule: 'เงื่อนไข 4: เปลี่ยนเป็นกะเช้า หลังกะดึก (N→M)',
        status: 'fail',
        msg: `วันก่อนหน้า (วันที่ ${targetDay - 1}) เป็นกะดึก (${prevCode}) — ห้ามสลับเป็นกะเช้าทันที ต้องมีวันหยุดคั่นอย่างน้อย 1 วันก่อนเข้ากะเช้า`
      });
      hasHardBlock = true;
    } else {
      results.push({ rule: 'เงื่อนไข 4: เปลี่ยนเป็นกะเช้า (M→M)', status: 'pass', msg: 'วันก่อนหน้าไม่ใช่กะดึก — อนุญาตให้เปลี่ยน/สลับเป็นกะเช้าได้' });
    }
  }

  return { hasHardBlock, results };
}

// ตรวจสอบทั้งสองฝั่งเมื่อมีการ "สลับกะ" ระหว่างพนักงาน 2 คน (ต้อง check both operator)
// A ได้รับกะเดิมของ B และ B ได้รับกะเดิมของ A
function validateSwapBothSides(empAId, empBId, day) {
  const empA = findEmployeeById(empAId);
  const empB = findEmployeeById(empBId);
  if (!empA || !empB) return { valid: false, sideA: null, sideB: null };

  const aOldCode = getShiftCodeForDate(empA, state.currentYear, state.currentMonth, day);
  const bOldCode = getShiftCodeForDate(empB, state.currentYear, state.currentMonth, day);

  const sideA = validateShiftAssignment(empAId, day, bOldCode);
  const sideB = validateShiftAssignment(empBId, day, aOldCode);

  return {
    valid: sideA.valid && sideB.valid,
    sideA,
    sideB,
    aOldCode,
    bOldCode,
    aNewCode: bOldCode, // A รับกะเดิมของ B
    bNewCode: aOldCode  // B รับกะเดิมของ A
  };
}

// ตรวจสอบคำขอ OT โดยเฉพาะ: เช็ควันทำงานติดต่อกัน 6 วัน + เคยทำกะดึกมาก่อนหรือไม่ + มีวันหยุดคั่นก่อนหน้าหรือไม่
// → ต้องผ่านหัวหน้ากะตรวจสอบ (Supervisor Review) แล้วผู้จัดการอนุมัติ (Manager Approve)
function validateOTRequest(empId, day, otShiftCode) {
  const emp = findEmployeeById(empId);
  if (!emp) return { valid: false, results: [], requiresManagerSpecialReview: false };

  const base = validateShiftAssignment(empId, day, otShiftCode);
  const results = [...base.results];
  let hasHardBlock = !base.valid;

  const prevCode = day > 1 ? getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day - 1) : null;
  const prevFamily = prevCode ? getShiftFamily(prevCode) : null;
  const otFamily = getShiftFamily(otShiftCode);

  // ตรวจสอบว่าทำกะดึกมาก่อนหรือไม่ (สำคัญมากถ้าขอ OT กะเช้า)
  if (otFamily === 'M' && prevFamily === 'N') {
    results.push({ rule: 'ตรวจสอบกะดึกวันก่อนหน้า (OT กะเช้า)', status: 'fail', msg: `พบว่าทำกะดึกในวันก่อนหน้า (วันที่ ${day - 1}) — ไม่อนุญาตให้ทำ OT กะเช้าต่อทันที ต้องพักก่อนอย่างน้อย 1 วัน` });
    hasHardBlock = true;
  } else {
    results.push({ rule: 'ตรวจสอบกะดึกวันก่อนหน้า', status: 'pass', msg: 'ไม่พบการทำกะดึกในวันก่อนหน้าที่กระทบต่อการทำ OT' });
  }

  // ตรวจสอบวันหยุดก่อนหน้า (ความพร้อม/ความเหนื่อยล้าก่อนทำ OT)
  if (prevFamily === 'O') {
    results.push({ rule: 'ตรวจสอบวันหยุดก่อนหน้า', status: 'pass', msg: `วันก่อนหน้า (วันที่ ${day - 1}) เป็นวันหยุด — พร้อมสำหรับการทำ OT` });
  } else {
    results.push({ rule: 'ตรวจสอบวันหยุดก่อนหน้า', status: 'warn', msg: `วันก่อนหน้าไม่ใช่วันหยุด (เป็นกะ ${prevCode || '-'}) — โปรดพิจารณาความเหนื่อยล้าก่อนอนุมัติ` });
  }

  // กรณีพิเศษ: ขอ OT ระหว่างสัปดาห์ลาพักร้อน (Question for Operator)
  const currentCodeOnDay = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day);
  const onVacation = currentCodeOnDay === 'V';
  if (onVacation) {
    results.push({ rule: 'กรณีพิเศษ: ขอ OT ระหว่างลาพักร้อน', status: 'warn', msg: 'พนักงานอยู่ในช่วงลาพักร้อน (V) — การขอ OT ระหว่างวันลาต้องได้รับอนุมัติพิเศษจากผู้จัดการเป็นกรณีๆ ไป (ไม่บล็อกอัตโนมัติ)' });
  }

  return { valid: !hasHardBlock, results, requiresManagerSpecialReview: onVacation };
}

function validateShiftAssignment(empId, targetDay, targetShiftCode) {
  const emp = findEmployeeById(empId);
  if (!emp) return { valid: false, errors: ['ไม่พบข้อมูลพนักงาน'] };

  const results = [];
  let hasHardBlock = false;

  // เงื่อนไข 1/3/4: ทิศทางการเปลี่ยนกะ (Morning ↔ Night transition matrix)
  const transitionCheck = checkShiftTransitionRules(emp, targetDay, targetShiftCode);
  results.push(...transitionCheck.results);
  if (transitionCheck.hasHardBlock) hasHardBlock = true;

  // เงื่อนไข 2: Max 6 consecutive working days (ต้องไม่เกิน 6 วัน และต้องมีวันหยุดพักผ่อน)
  const daysInTargetMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const shiftsCopy = Array.from({ length: daysInTargetMonth }, (_, i) =>
    getShiftCodeForDate(emp, state.currentYear, state.currentMonth, i + 1)
  );
  shiftsCopy[targetDay - 1] = targetShiftCode;

  const leaveCodes = ['V', 'B', 'S', 'H', 'VG', 'VGh'];
  let maxConsecutive = 0;
  let currentStreak = 0;
  for (let s of shiftsCopy) {
    if (s !== 'O' && !leaveCodes.includes(s)) {
      currentStreak++;
      if (currentStreak > maxConsecutive) maxConsecutive = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  const maxDays = state.managerConfig.maxConsecutiveWorkDays;
  if (maxConsecutive > maxDays) {
    results.push({ rule: `วันทำงานติดต่อกันสูงสุด (Max ${maxDays} Days)`, status: 'fail', msg: `เกินเกณฑ์ ${maxDays} วันติดต่อกัน (นับได้ ${maxConsecutive} วัน) — ฝ่าฝืนกฎความปลอดภัยและกฎหมายแรงงาน` });
    hasHardBlock = true;
  } else if (maxConsecutive >= maxDays - 2) {
    results.push({ rule: 'วันทำงานติดต่อกัน', status: 'warn', msg: `ทำงานต่อเนื่อง ${maxConsecutive}/${maxDays} วัน (ใกล้ครบกำหนด ต้องจัดวันหยุดชดเชย)` });
  } else {
    results.push({ rule: 'รอบการเข้ากะ (2-on 2-off Pattern)', status: 'pass', msg: `สอดคล้องกับรอบหมุนเวียน (ทำงานต่อเนื่อง ${maxConsecutive}/${maxDays} วัน)` });
  }

  // Rule 2: OT / Shift Family Check
  if (['MT', 'NT', 'MTh', 'NTh', 'OT'].includes(targetShiftCode)) {
    results.push({ rule: 'ชั่วโมงล่วงเวลา (OT Check)', status: 'pass', msg: 'มีชั่วโมง OT ส่งต่องานกะ (บันทึกเข้า Payroll ตามอัตรา x1.5 / x3.0)' });
  } else {
    results.push({ rule: 'สังกัดชุดกะ', status: 'pass', msg: `ตรงตามรหัสพนักงาน ${emp.code} (${emp.shiftType})` });
  }

  // Rule 3: Allowed Change Window (±7 Days)
  const diff = Math.abs(targetDay - state.currentDay);
  if (diff > 7) {
    results.push({ rule: 'กรอบเวลาการขอปรับเปลี่ยน (±7 วัน)', status: 'warn', msg: `วันที่ ${targetDay} อยู่นอกกรอบ ±7 วันจากปัจจุบัน (${state.currentDay})` });
  } else {
    results.push({ rule: 'กรอบเวลายื่นเรื่อง', status: 'pass', msg: 'อยู่ภายในกรอบเวลาที่ระบบอนุญาต (±7 วัน)' });
  }

  // Rule 4: Monthly swap/change quota (สูงสุด 2 ครั้ง/เดือน ตามข้อ 6 SRS)
  const usedQuota = countMonthlySwapRequests(empId);
  const quotaLimit = state.managerConfig.swapRequestMonthlyLimit;
  if (usedQuota >= quotaLimit) {
    results.push({ rule: `สิทธิ์คำขอสลับ/เปลี่ยนกะ (สูงสุด ${quotaLimit} ครั้ง/เดือน)`, status: 'fail', msg: `ใช้สิทธิ์ไปแล้ว ${usedQuota}/${quotaLimit} ครั้ง — ระบบไม่อนุญาตให้ยื่นคำขอเพิ่มในเดือนนี้` });
    hasHardBlock = true;
  } else {
    results.push({ rule: 'สิทธิ์คำขอสลับ/เปลี่ยนกะ', status: 'pass', msg: `ใช้สิทธิ์ไปแล้ว ${usedQuota}/${quotaLimit} ครั้งในเดือนนี้` });
  }

  return {
    valid: !hasHardBlock,
    results
  };
}

// Toast Helper
function showToast(message, icon = 'check') {
  const container = document.getElementById('toastRoot');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${getIcon(icon, 'icon-sm')} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// แปลงรหัสกะ → คลาส CSS ที่ปลอดภัย (รองรับรหัสผสม เช่น N/M, M/O ที่มี "/" ซึ่งใช้เป็นชื่อคลาสตรงๆ ไม่ได้)
function getBadgeClass(code) {
  const def = state.shiftDefs[code];
  if (!def) return 'O';
  switch (def.family) {
    case 'leave': return 'leave';
    case 'swap': return 'swap';
    case 'D': return 'D';
    case 'OT': return 'OT';
    case 'M': return code.startsWith('M') ? code.replace('Th', 'T') === 'MT' ? 'MT' : 'M' : 'M';
    case 'N': return code.startsWith('N') ? code.replace('Th', 'T') === 'NT' ? 'NT' : 'N' : 'N';
    case 'O': return 'O';
    default: return 'O';
  }
}

// Render Shift Badge Component (Clean & Scannable for Excel-Grid)
function renderShiftBadge(code, isInteractive = false, dayNum = null, empId = null, isProjected = false) {
  const def = state.shiftDefs[code] || state.shiftDefs.O;
  const badgeClass = getBadgeClass(code);
  const halfMarker = def.half ? ' ot-half' : '';
  const otMarker = def.ot && !def.half ? ' ot-marker' : '';
  const projectedMarker = isProjected ? ' projected-cell' : '';
  const interactiveAttr = isInteractive ? `onclick="openShiftEditor('${empId}', ${dayNum})"` : '';
  const projectedNote = isProjected ? ' · คาดการณ์จากรอบการทำงานปกติ (ยังไม่มีข้อมูลจริง)' : '';

  return `
    <span class="shift-badge-cell ${badgeClass}${otMarker}${halfMarker}${projectedMarker}"
          ${interactiveAttr}
          title="${def.label} (${def.time})${projectedNote} · ${isInteractive ? 'คลิกเพื่อแก้ไข' : 'ล็อกแล้ว ไม่สามารถแก้ไขได้'}">
      ${code}
    </span>
  `;
}

// Global Modal Controller
function openModal(title, bodyHtml, footerHtml = '') {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="icon-btn" onclick="closeModal()">${getIcon('x', 'icon-sm')}</button>
        </div>
        <div class="modal-body">
          ${bodyHtml}
        </div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    </div>
  `;
}

function closeModal() {
  const root = document.getElementById('modalRoot');
  if (root) root.innerHTML = '';
}

// ==========================================================================
// REDESIGNED SHIFT SCHEDULE VIEW: YEAR-ROUND MONTH NAVIGATION
// ==========================================================================
function renderScheduleView() {
  const selectedMonthDate = new Date(state.currentYear, state.currentMonth, 1);
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthLabel = selectedMonthDate.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric'
  });
  const monthShortLabel = selectedMonthDate.toLocaleDateString('th-TH', {
    month: 'short'
  });

  const weekGroups = Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, index) => {
    const start = index * 7 + 1;
    const end = Math.min(start + 6, daysInMonth);
    return {
      label: `Week ${index + 1} (${String(start).padStart(2, '0')}–${String(end).padStart(2, '0')} ${monthShortLabel})`,
      span: end - start + 1,
      start,
      end
    };
  });

  const weekdayName = d => {
    const dt = new Date(state.currentYear, state.currentMonth, d);
    return dt.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isWeekend = d => {
    const day = new Date(state.currentYear, state.currentMonth, d).getDay();
    return day === 0 || day === 6;
  };

  const isWeekStart = d => d > 1 && (d - 1) % 7 === 0;

  // Grouped by Shift A / B / C / D (ข้อ 2 SRS: 4 ทีมหลัก)
  const shiftSections = [];
  const filterMap = { A: 'shiftA', B: 'shiftB', C: 'shiftC', D: 'shiftD' };
  Object.keys(filterMap).forEach(key => {
    if (state.selectedShiftFilter === 'ALL' || state.selectedShiftFilter === key) {
      shiftSections.push(state.shiftsData[filterMap[key]]);
    }
  });

  const allEmployees = getAllEmployees();
  const currentViewerId = ['Shift Supervisor', 'Shift Employee'].includes(state.activeRole)
    ? allEmployees.find(employee => employee.name === state.roles[state.activeRole].name)?.id
    : null;
  const today = DEMO_TODAY;
  const isCurrentDate = d => d === today.getDate()
    && state.currentMonth === today.getMonth()
    && state.currentYear === today.getFullYear();
  const currentDateLabel = `วันที่ ${today.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}`;

  // ข้อ 10 SRS: ล็อกข้อมูลย้อนหลังเมื่อพ้นเดือนปัจจุบัน
  const monthLocked = isMonthLocked(state.currentYear, state.currentMonth);
  const monthPublished = isMonthPublished(state.currentYear, state.currentMonth);
  const hasData = hasScheduleDataForMonth(state.currentYear, state.currentMonth);
  const canPublish = (state.activeRole === 'Shift Supervisor' || state.activeRole === 'Manager') && !monthLocked && hasData;
  // HR: ดึงข้อมูล (view/export) ได้เท่านั้น ห้ามแก้ไขตารางกะใดๆ ทั้งสิ้น
  const isReadOnlyRole = state.activeRole === 'HR';
  const canInteractSchedule = !monthLocked && !isReadOnlyRole;

  return `
    <div style="display:flex;flex-direction:column;gap:20px">
      <!-- Focused schedule header -->
      <div class="card schedule-header">
        <div class="schedule-header-title">
          <h2>ตารางกะฝ่ายผลิต</h2>
          <span>${currentDateLabel}</span>
          ${!hasData ? `<span class="pill pill-draft" title="เดือนนี้ยังไม่มีข้อมูลจริง ระบบคาดการณ์ตารางกะจากรอบการทำงานปกติของแต่ละคนให้ ยังไม่มีการสลับ/ปรับกะใดๆ เกิดขึ้น">${getIcon('alert', 'icon-sm')} ตารางคาดการณ์ (ยังไม่มีข้อมูลจริง)</span>` : isReadOnlyRole ? `<span class="pill pill-draft" title="บทบาท HR ดึงข้อมูลได้อย่างเดียว ไม่สามารถแก้ไขตารางกะได้">${getIcon('lock', 'icon-sm')} โหมดดูข้อมูลอย่างเดียว (Read-only)</span>` : monthLocked ? `<span class="pill pill-draft" title="ข้อมูลเดือนนี้ถูกล็อกแล้ว ไม่สามารถแก้ไขได้ (ตามข้อ 10 SRS)">${getIcon('lock', 'icon-sm')} ข้อมูลถูกล็อก</span>` : `<span class="pill pill-approved">${getIcon('check', 'icon-sm')} แก้ไขได้</span>`}
          ${hasData ? (monthPublished ? `<span class="pill pill-live">${getIcon('check', 'icon-sm')} เผยแพร่แล้ว (Published)</span>` : `<span class="pill pill-pending">ฉบับร่าง (Draft)</span>`) : ''}
          ${canPublish && !monthPublished ? `<button class="btn btn-mint btn-sm" onclick="publishSchedule()">${getIcon('check', 'icon-sm')} เผยแพร่ตารางกะ (Publish)</button>` : ''}
        </div>
        ${!hasData ? `
          <div class="validation-panel" style="margin-top:10px">
            <div class="validation-check-item warn">
              ${getIcon('alert', 'icon-sm')}
              <span><strong>${monthLabel} ยังไม่มีข้อมูลตารางกะจริง</strong> — ระบบนำรอบการทำงาน 2 วันสลับ 2 วันของพนักงานแต่ละคนจากเดือนสิงหาคม 2569 มาคาดการณ์ให้ล่วงหน้า โดยยังไม่มีการสลับ/ปรับกะ/ลาใดๆ เกิดขึ้นในเดือนนี้ ${!monthLocked ? 'สามารถคลิกที่ช่องกะเพื่อทดลองแก้ไข หรือยื่นคำขอสลับกะ/ขอลาได้ตามปกติ' : 'เดือนนี้ถูกล็อก (อยู่ในอดีต) จึงดูได้อย่างเดียว'}</span>
            </div>
          </div>
        ` : ''}

        <div class="schedule-header-controls">
          <!-- Month navigation -->
          <div class="schedule-month-picker" aria-label="เลือกเดือนของตารางกะ">
            <button class="month-nav-btn" type="button" onclick="changeScheduleMonth(-1)" aria-label="เดือนก่อนหน้า">
              ${getIcon('arrowLeft', 'icon-sm')}
            </button>
            <button class="month-picker-trigger" type="button" onclick="toggleMonthPicker()" aria-label="เลือกเดือนและปีโดยตรง" aria-expanded="${state.monthPickerOpen}">
              ${getIcon('calendar', 'icon-sm')}
              <strong>${monthLabel}</strong>
              ${getIcon('chevronDown', 'icon-xs')}
            </button>
            <button class="month-nav-btn" type="button" onclick="changeScheduleMonth(1)" aria-label="เดือนถัดไป">
              ${getIcon('arrowRight', 'icon-sm')}
            </button>

            ${state.monthPickerOpen ? `
              <div class="month-picker-backdrop" onclick="toggleMonthPicker(false)"></div>
              <div class="month-picker-popover" role="dialog" aria-label="เลือกเดือนและปี">
                <div class="month-picker-popover-head">
                  <select aria-label="เลือกปี" onchange="jumpToScheduleMonth(this.value, ${state.currentMonth})">
                    ${Array.from({ length: 5 }, (_, i) => SCHEDULE_DATA_YEAR - 1 + i).map(y => `
                      <option value="${y}" ${y === state.currentYear ? 'selected' : ''}>${y + 543}</option>
                    `).join('')}
                  </select>
                  <button type="button" class="icon-btn" onclick="toggleMonthPicker(false)" aria-label="ปิด">${getIcon('x', 'icon-sm')}</button>
                </div>
                <div class="month-picker-grid">
                  ${Array.from({ length: 12 }, (_, m) => m).map(m => {
                    const isActive = m === state.currentMonth;
                    const hasData = hasScheduleDataForMonth(state.currentYear, m);
                    return `
                      <button type="button" class="month-picker-chip ${isActive ? 'active' : ''} ${hasData ? 'has-data' : ''}"
                        onclick="jumpToScheduleMonth(${state.currentYear}, ${m})"
                        title="${hasData ? 'มีข้อมูลตารางกะจริง' : 'ยังไม่มีข้อมูล'}">
                        ${thaiMonthName(m, 'short')}
                      </button>
                    `;
                  }).join('')}
                </div>
                <button type="button" class="month-picker-today-btn" onclick="jumpToScheduleDataMonth()">
                  ${getIcon('check', 'icon-sm')} ไปเดือนที่มีข้อมูลจริง (${thaiMonthName(SCHEDULE_DATA_MONTH, 'long')} ${SCHEDULE_DATA_YEAR + 543})
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Filter Shift -->
          <label class="schedule-filter role-switch-pill">
            <span class="role-switch-label">ชุดกะ</span>
            <select class="role-select" onchange="filterScheduleShiftType(this.value)">
              <option value="ALL" ${state.selectedShiftFilter === 'ALL' ? 'selected' : ''}>ทั้ง 4 ชุดกะ (Shift A–D)</option>
              <option value="A" ${state.selectedShiftFilter === 'A' ? 'selected' : ''}>เฉพาะ Shift "A"</option>
              <option value="B" ${state.selectedShiftFilter === 'B' ? 'selected' : ''}>เฉพาะ Shift "B"</option>
              <option value="C" ${state.selectedShiftFilter === 'C' ? 'selected' : ''}>เฉพาะ Shift "C"</option>
              <option value="D" ${state.selectedShiftFilter === 'D' ? 'selected' : ''}>เฉพาะ Shift "D"</option>
            </select>
          </label>

        </div>
      </div>

      <!-- Unified Availability Grid with Shift Sections -->
      <div class="table-responsive" style="box-shadow:var(--shadow-sm)">
        <table class="data-table">
          <thead>
            <!-- Top Header: Week Groupings -->
            <tr>
              <th class="sticky-col-1" style="z-index:25;min-width:180px">รหัส & ชื่อพนักงาน</th>
              <th class="sticky-col-2" style="z-index:25;min-width:140px;text-align:left">เบอร์โทรศัพท์</th>
              ${weekGroups.map(w => `
                <th colspan="${w.span}" class="week-group-header">
                  ${w.label}
                </th>
              `).join('')}
              <th style="min-width:64px;background:#f1f5f9;border-left:2px solid var(--line)">วันทำ</th>
              <th style="min-width:64px;background:#f1f5f9">วันหยุด</th>
              <th style="min-width:70px;background:#f1f5f9">ชม. รวม</th>
            </tr>

            <!-- Sub Header: Days of Month (01 to 31) -->
            <tr>
              <th class="sticky-col-1" style="background:#f8fafc"></th>
              <th class="sticky-col-2" style="background:#f8fafc"></th>
              ${days.map(d => {
                const isToday = isCurrentDate(d);
                const weekend = isWeekend(d);
                const weekStartClass = isWeekStart(d) ? 'week-start' : '';

                let thStyle = '';
                if (weekend) thStyle = 'background:#fef08a;color:#854d0e;';

                return `
                  <th class="${isToday ? 'today-col' : ''} ${weekStartClass}" style="min-width:34px;${thStyle}">
                    <span style="font-size:9px;opacity:0.85">${weekdayName(d)}</span><br>
                    <b style="font-size:11px">${String(d).padStart(2, '0')}</b>
                  </th>
                `;
              }).join('')}
              <th style="background:#f8fafc;border-left:2px solid var(--line);font-size:10px">วัน</th>
              <th style="background:#f8fafc;font-size:10px">วัน</th>
              <th style="background:#f8fafc;font-size:10px">ชม.</th>
            </tr>
          </thead>
          <tbody>
            ${shiftSections.map(section => `
              <!-- Shift Section Header Banner Row (Shift A / B / C / D) -->
              <tr style="background:#0f273d;color:#ffffff">
                <td colspan="2" class="sticky-col-1" style="background:#0f273d !important;color:#ffffff;font-weight:800;font-size:12px;padding:8px 16px;z-index:20">
                  ${section.name} (${section.thaiName})
                </td>
                <td colspan="${daysInMonth + 3}" style="background:#0f273d !important;color:#cbd5e1;font-size:10px;text-align:left;padding-left:12px">
                  รอบการทำงานแบบ 2 วันสลับ 2 วัน (2-on 2-off Rotation) · กะละ 12 ชั่วโมง · โครงสร้าง ${section.employees.length} ตำแหน่ง (หัวหน้ากะ 1 + พนักงานกะ ${section.employees.length - 1})
                </td>
              </tr>

              <!-- Employees in this Shift Section -->
              ${section.employees.map((emp, empIdx) => {
                const isSupervisor = empIdx === 0;
                const isCurrentViewer = emp.id === currentViewerId;
                const leaveCodes = ['V', 'B', 'S', 'H', 'VG', 'VGh'];
                const monthCodes = days.map(d => getShiftCodeForDate(emp, state.currentYear, state.currentMonth, d));
                const workDays = monthCodes.filter(s => s !== 'O' && !leaveCodes.includes(s)).length;
                const offDays = monthCodes.filter(s => s === 'O').length;
                const otDays = monthCodes.filter(s => state.shiftDefs[s] && state.shiftDefs[s].ot).length;
                const totalHours = workDays * 12 + otDays * 0.5; // 12-hour shifts + 30 min handover per OT day

                return `
                  <tr class="${isCurrentViewer ? 'current-user-row' : ''}" style="${isSupervisor && !isCurrentViewer ? 'background:#f8fafc;font-weight:600' : ''}">
                    <!-- Col 1: Employee Code & Name -->
                    <td class="sticky-col-1" style="${isSupervisor && !isCurrentViewer ? 'background:#f8fafc !important' : ''}">
                      <div class="person-chip">
                        ${isSupervisor ? `<span style="color:#b91c1c;font-weight:900;font-size:11px;margin-right:2px" title="Shift Supervisor">S</span>` : ''}
                        <span style="font-family:monospace;font-size:10px;color:var(--muted);margin-right:4px">${emp.code}</span>
                        <div class="person-chip-name" style="${isSupervisor ? 'font-weight:800;color:var(--navy-2)' : ''}">
                          ${emp.name}
                          ${isCurrentViewer ? '<span class="current-user-marker">คุณ</span>' : ''}
                        </div>
                      </div>
                    </td>

                    <!-- Col 2: Telephone Number -->
                    <td class="sticky-col-2" style="${isSupervisor && !isCurrentViewer ? 'background:#f8fafc !important' : ''};font-family:monospace;font-size:10px;color:var(--ink-secondary)">
                      ${emp.phone}
                    </td>

                    <!-- Days Shift Cells -->
                    ${days.map(d => {
                      const isToday = isCurrentDate(d);
                      const weekend = isWeekend(d);
                      const weekStartClass = isWeekStart(d) ? 'week-start' : '';

                      let tdBg = '';
                      if (weekend) tdBg = 'background:#fefce8;';

                      const shiftCode = hasData ? (emp.shifts[d - 1] || 'O') : getShiftCodeForDate(emp, state.currentYear, state.currentMonth, d);
                      return `
                        <td class="${isToday ? 'today-col' : ''} ${weekStartClass}" style="${tdBg}">
                          ${renderShiftBadge(shiftCode, canInteractSchedule, d, emp.id, !hasData)}
                        </td>
                      `;
                    }).join('')}

                    <!-- Summary Columns -->
                    <td style="border-left:2px solid var(--line)">
                      <strong>${workDays}</strong>
                    </td>
                    <td>
                      <span style="color:var(--muted)">${offDays}</span>
                    </td>
                    <td>
                      <strong style="color:var(--navy-2)">${totalHours}</strong>
                    </td>
                  </tr>
                `;
              }).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Clean Minimal Structured Legend Box -->
      <div class="card" style="padding:16px 20px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm)">
        <div style="font-size:11px;font-weight:800;color:var(--ink);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">
          คำอธิบายสัญลักษณ์และประเภทกะ (Shift Legend — ครบตามข้อ 3 SRS)
        </div>
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <div class="legend-item"><span class="shift-badge-cell M" style="width:26px;height:22px;font-size:10px">M</span> <span style="font-size:11px;color:var(--ink-secondary)">กะเช้า</span></div>
          <div class="legend-item"><span class="shift-badge-cell MT ot-marker" style="width:26px;height:22px;font-size:10px">MT</span> <span style="font-size:11px;color:var(--ink-secondary)">กะเช้า + OT</span></div>
          <div class="legend-item"><span class="shift-badge-cell MT ot-half" style="width:26px;height:22px;font-size:9px">MTh</span> <span style="font-size:11px;color:var(--ink-secondary)">กะเช้า + OT ครึ่งวัน</span></div>
          <div class="legend-item"><span class="shift-badge-cell N ot-marker" style="width:26px;height:22px;font-size:10px">N</span> <span style="font-size:11px;color:var(--ink-secondary)">กะดึก</span></div>
          <div class="legend-item"><span class="shift-badge-cell NT ot-marker" style="width:26px;height:22px;font-size:10px">NT</span> <span style="font-size:11px;color:var(--ink-secondary)">กะดึก + OT</span></div>
          <div class="legend-item"><span class="shift-badge-cell D" style="width:26px;height:22px;font-size:10px">D</span> <span style="font-size:11px;color:var(--ink-secondary)">เวลาทำการปกติ</span></div>
          <div class="legend-item"><span class="shift-badge-cell O" style="width:26px;height:22px;font-size:9px">O</span> <span style="font-size:11px;color:var(--ink-secondary)">วันหยุด</span></div>
          <div class="legend-item"><span class="shift-badge-cell swap" style="width:26px;height:22px;font-size:8px">N/M</span> <span style="font-size:11px;color:var(--ink-secondary)">สลับ/ปรับกะ (M↔N↔O)</span></div>
          <div class="legend-item"><span class="shift-badge-cell leave" style="width:26px;height:22px;font-size:10px">V</span> <span style="font-size:11px;color:var(--ink-secondary)">ลาพักร้อน</span></div>
          <div class="legend-item"><span class="shift-badge-cell leave" style="width:26px;height:22px;font-size:10px">B</span> <span style="font-size:11px;color:var(--ink-secondary)">ลากิจ</span></div>
          <div class="legend-item"><span class="shift-badge-cell leave" style="width:26px;height:22px;font-size:10px">S</span> <span style="font-size:11px;color:var(--ink-secondary)">ลาป่วย</span></div>
          <div class="legend-item"><span class="shift-badge-cell leave" style="width:26px;height:22px;font-size:10px">H</span> <span style="font-size:11px;color:var(--ink-secondary)">วันหยุดนักขัตฤกษ์</span></div>
          <div class="legend-item"><span class="shift-badge-cell leave" style="width:26px;height:22px;font-size:8px">VG</span> <span style="font-size:11px;color:var(--ink-secondary)">ลาอื่นๆ</span></div>
          <div class="legend-item"><span style="display:inline-block;width:16px;height:16px;background:#fef08a;border:1px solid #fde047;border-radius:4px"></span> <span style="font-size:11px;color:var(--ink-secondary)">วันเสาร์–อาทิตย์</span></div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// OTHER ROLE VIEWS & DASHBOARDS (Preserving Full Spec Functionality)
// ==========================================================================

// Overview Dashboard (Supervisor)
function renderOverviewView() {
  const pendingCount = state.requests.filter(r => r.status.includes('รอ')).length;
  const todayLabel = DEMO_TODAY.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const allEmployees = getAllEmployees();
  const teamSizes = ['shiftA', 'shiftB', 'shiftC', 'shiftD'].map(key => state.shiftsData[key].employees.length);
  const totalOnDutyToday = allEmployees.length; // simplified — all rostered
  const crossShiftPending = state.requests.filter(r => r.isCrossShift && r.status.includes('รอ')).length;

  return `
    <div class="page-header dashboard-page-header">
      <div class="page-headline">
        <h1>ภาพรวมกำลังพล</h1>
        <p>สรุปกำลังพล คำขอ และสถานะกะที่ต้องติดตามวันนี้ · ทั้งหมด ${allEmployees.length} คน (4 ทีม x 7 ตำแหน่ง)</p>
      </div>
      <span class="dashboard-date">วันที่ ${todayLabel}</span>
    </div>

    <div class="metrics-grid dashboard-metrics">
      <div class="metric-card" onclick="switchView('schedule')">
        <div class="metric-card-top">
          <div class="metric-icon-box mint">${getIcon('users')}</div>
        </div>
        <div class="metric-value">${allEmployees.length} คน</div>
        <div class="metric-label">กำลังพลรวมทั้งระบบ</div>
        <div class="metric-sub">Shift A (${teamSizes[0]}) · B (${teamSizes[1]}) · C (${teamSizes[2]}) · D (${teamSizes[3]})</div>
      </div>

      <div class="metric-card" onclick="switchView('requests')">
        <div class="metric-card-top">
          <div class="metric-icon-box amber">${getIcon('check-square')}</div>
          <span class="pill pill-pending">รอตรวจสอบ</span>
        </div>
        <div class="metric-value">${String(pendingCount).padStart(2, '0')} รายการ</div>
        <div class="metric-label">คำขอรอดำเนินการ (Approval Queue)</div>
        <div class="metric-sub">สลับกะ / ขอลา / เปลี่ยนวันหยุด</div>
      </div>

      <div class="metric-card" onclick="switchView('requests')">
        <div class="metric-card-top">
          <div class="metric-icon-box red">${getIcon('alert')}</div>
          <span class="pill pill-rejected">Cross-Shift</span>
        </div>
        <div class="metric-value">${String(crossShiftPending).padStart(2, '0')} รายการ</div>
        <div class="metric-label">คำขอสลับข้ามชุดกะ</div>
        <div class="metric-sub">รอการยืนยันจากหัวหน้ากะทั้ง 2 ฝ่าย</div>
      </div>
    </div>

    <!-- Active Shifts Summary Card -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <h3>สถานะกะการทำงานวันนี้ <span class="pill pill-live">กำลังใช้งาน</span></h3>
          <p>สรุปกำลังพลของทั้ง 4 ทีมกะ (A / B / C / D)</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="switchView('schedule')">
          ดูตารางเต็มเดือน ${getIcon('arrowRight', 'icon-sm')}
        </button>
      </div>

      <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
        <!-- Shift A Summary -->
        <div style="padding:16px 20px;border:1px solid #fde68a;background:#fffbeb;border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:#fef3c7;color:#b45309;display:grid;place-items:center">
              ${getIcon('sun')}
            </div>
            <div>
              <strong style="font-size:14px;color:#92400e">Shift "A" (กะเช้า: 07:30–19:30)</strong>
              <p style="font-size:12px;color:#b45309;margin:2px 0 0">หัวหน้ากะ: ณัฐพล ดวงประสิทธิ์ · กำลังพลทั้งทีม ${teamSizes[0]} คน (หัวหน้ากะ 1 + พนักงานกะ ${teamSizes[0] - 1})</p>
            </div>
          </div>
          <span class="pill pill-approved" style="background:#fef3c7;color:#92400e;border-color:#fde68a;font-size:11px;padding:4px 10px">Active Now</span>
        </div>

        <!-- Shift B Summary -->
        <div style="padding:16px 20px;border:1px solid #c7d2fe;background:#eef2ff;border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:#e0e7ff;color:#3730a3;display:grid;place-items:center">
              ${getIcon('moon')}
            </div>
            <div>
              <strong style="font-size:14px;color:#3730a3">Shift "B" (กะดึก: 19:30–07:30)</strong>
              <p style="font-size:12px;color:#4338ca;margin:2px 0 0">หัวหน้ากะ: สุระศักดิ์ สงหลำ · กำลังพลทั้งทีม ${teamSizes[1]} คน (หัวหน้ากะ 1 + พนักงานกะ ${teamSizes[1] - 1})</p>
            </div>
          </div>
          <span class="pill pill-draft" style="color:#3730a3;font-size:11px;padding:4px 10px">Starts 19:30</span>
        </div>

        <!-- Shift C Summary -->
        <div style="padding:16px 20px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:#e0f2fe;color:#0369a1;display:grid;place-items:center">
              ${getIcon('sun')}
            </div>
            <div>
              <strong style="font-size:14px;color:#0369a1">Shift "C" (กะเช้า: 07:30–19:30)</strong>
              <p style="font-size:12px;color:#0369a1;margin:2px 0 0">หัวหน้ากะ: โรจนะ ยังสุข · กำลังพลทั้งทีม ${teamSizes[2]} คน (หัวหน้ากะ 1 + พนักงานกะ ${teamSizes[2] - 1})</p>
            </div>
          </div>
          <span class="pill pill-draft" style="color:#0369a1;font-size:11px;padding:4px 10px">Standby</span>
        </div>

        <!-- Shift D Summary -->
        <div style="padding:16px 20px;border:1px solid #f5d0fe;background:#fdf4ff;border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:#fae8ff;color:#86198f;display:grid;place-items:center">
              ${getIcon('moon')}
            </div>
            <div>
              <strong style="font-size:14px;color:#86198f">Shift "D" (กะดึก: 19:30–07:30)</strong>
              <p style="font-size:12px;color:#86198f;margin:2px 0 0">หัวหน้ากะ: วีรพล พุทธตาล · กำลังพลทั้งทีม ${teamSizes[3]} คน (หัวหน้ากะ 1 + พนักงานกะ ${teamSizes[3] - 1})</p>
            </div>
          </div>
          <span class="pill pill-draft" style="color:#86198f;font-size:11px;padding:4px 10px">Standby</span>
        </div>
      </div>
    </div>
  `;
}

function getVisibleRequests() {
  if (state.activeRole !== 'Shift Employee') return state.requests;

  const employee = getAllEmployees().find(item => item.name === state.roles[state.activeRole].name);
  return state.requests.filter(request => request.requesterId === employee?.id || request.person === employee?.name);
}

// Requests View with Interactive Testcase Sandbox Runner
function renderRequestsView() {
  const visibleRequests = getVisibleRequests();
  const isOperatorView = state.activeRole === 'Shift Employee';

  return `
    <div class="requests-page ${isOperatorView ? 'operator-requests' : ''}" style="display:flex;flex-direction:column;gap:20px">
      <!-- เครื่องมือจำลอง test cases สำหรับหัวหน้ากะเท่านั้น ซ่อนจากพนักงาน/ผู้จัดการ/HR -->
      ${state.activeRole === 'Shift Supervisor' ? `
      <div class="card" style="padding:18px 24px;background:#f8fafc;border:1.5px solid #cbd5e1">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="avatar avatar-sm" style="background:var(--navy);color:#ffffff">⚡</span>
              <strong style="font-size:14px;color:var(--navy)">Interactive Test Cases Sandbox (ทดสอบ Flow ข้อ 4 & ข้อ 6)</strong>
            </div>
            <p style="font-size:11px;color:var(--muted);margin-top:2px">
              คลิกปุ่มด้านล่างเพื่อจำลองเหตุการณ์จริงตามโจทย์: Quota เกินกำหนด (US-023), Dual Approval 2 ฝ่าย (US-024) และ Reject พร้อมระบุเหตุผล (US-033)
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="resetTestcases()">
            ${getIcon('history', 'icon-sm')} รีเซ็ตข้อมูลทดสอบ
          </button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px">
          <!-- Testcase 1: Quota Exceeded Simulation -->
          <div style="padding:12px;background:#ffffff;border:1px solid var(--line);border-radius:var(--radius-md);display:flex;flex-direction:column;justify-content:space-between;gap:8px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:12px;color:var(--ink)">Testcase 1: Quota สลับกะ (US-023)</strong>
                <span class="pill pill-draft" style="color:#b45309">โควตา $\le$ ${state.managerConfig.swapRequestMonthlyLimit} ครั้ง/เดือน</span>
              </div>
              <p style="font-size:11px;color:var(--muted);margin-top:4px">
                ทดสอบกรณียื่นสลับกะครบ ${state.managerConfig.swapRequestMonthlyLimit}/${state.managerConfig.swapRequestMonthlyLimit} ครั้งแล้ว และพยายามส่งคำขอเพิ่ม (ระบบจะบล็อคทันที)
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" style="width:100%;font-weight:700" onclick="simulateQuotaExceeded()">
              ▶ จำลองพนักงานใช้โควตาเกิน ${state.managerConfig.swapRequestMonthlyLimit} ครั้ง
            </button>
          </div>

          <!-- Testcase 2: Dual Approval Progression -->
          <div style="padding:12px;background:#ffffff;border:1px solid var(--line);border-radius:var(--radius-md);display:flex;flex-direction:column;justify-content:space-between;gap:8px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:12px;color:var(--ink)">Testcase 2: อนุมัติ 2 ฝ่าย (US-024)</strong>
                <span class="pill pill-approved">Cross-Shift Stepper</span>
              </div>
              <p style="font-size:11px;color:var(--muted);margin-top:4px">
                ทดสอบการอนุมัติแบบเป็นขั้น: Shift Supervisor A อนุมัติแล้ว $\to$ รอ Shift Supervisor B กดยืนยันครบถ้วน
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" style="width:100%;font-weight:700" onclick="simulateDualApprovalStep()">
              ▶ จำลองกดยืนยันฝ่ายที่ 2 (ครบ 2 ฝ่าย)
            </button>
          </div>

          <!-- Testcase 3: Reject with Reason Prompt -->
          <div style="padding:12px;background:#ffffff;border:1px solid var(--line);border-radius:var(--radius-md);display:flex;flex-direction:column;justify-content:space-between;gap:8px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:12px;color:var(--ink)">Testcase 3: ไม่อนุมัติพร้อมเหตุผล (US-033)</strong>
                <span class="pill pill-rejected">Reason Required</span>
              </div>
              <p style="font-size:11px;color:var(--muted);margin-top:4px">
                ทดสอบการเปิด Modal ปฏิเสธคำขอ บังคับพิมพ์เหตุผลเพื่อบันทึกลงประวัติและแจ้งเตือนพนักงาน
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" style="width:100%;font-weight:700;color:#b91c1c" onclick="promptRejectRequest(101)">
              ▶ ทดสอบเปิดฟอร์มปฏิเสธคำขอ
            </button>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Requests Queue Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <h3>${isOperatorView ? 'คำขอของฉัน' : 'คิวคำขอตรวจสอบและอนุมัติ (Approval Queue)'}</h3>
            <p>${isOperatorView ? 'ติดตามสถานะคำขอสลับกะ เปลี่ยนวันหยุด และการลาของคุณ' : 'คำขอสลับกะ เปลี่ยนวันหยุด และขอลา — ตรวจสอบตามกฎความปลอดภัยและสิทธิ์คงเหลือ'}</p>
          </div>
          <span class="pill pill-pending">${isOperatorView ? 'คำขอของฉัน' : `รอดำเนินการ ${visibleRequests.filter(r => r.status.includes('รอ')).length} รายการ`}</span>
        </div>

        <div>
          ${visibleRequests.length ? visibleRequests.map(req => renderRequestCard(req, false)).join('') : '<div class="request-empty-state">ยังไม่มีคำขอของคุณ</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderRequestCard(req, isCompact = false) {
  const isPending = req.status.includes('รอ');
  const nextApprover = req.approvers ? req.approvers.find(a => a.status !== 'approved') : null;
  const canReview = nextApprover
    ? (state.activeRole === 'Manager' ? nextApprover.role.includes('ผู้จัดการ') || nextApprover.role.includes('Manager')
      : state.activeRole === 'Shift Supervisor' ? nextApprover.role.includes('Shift Supervisor') || nextApprover.role.includes('หัวหน้ากะ')
      : false)
    : state.activeRole === 'Shift Supervisor';
  const isApproved = req.status === 'อนุมัติแล้ว';
  const isRejected = req.status === 'ไม่อนุมัติ';
  const isCancelled = req.status === 'ยกเลิกแล้ว';

  const statusPill = isApproved
    ? '<span class="pill pill-approved">✓ อนุมัติเรียบร้อย</span>'
    : isRejected
    ? '<span class="pill pill-rejected">✕ ไม่อนุมัติ</span>'
    : isCancelled
    ? '<span class="pill pill-draft">ยกเลิกคำขอแล้ว</span>'
    : `<span class="pill pill-pending">⏳ ${req.status}</span>`;

  const hasShiftChange = req.currentShift && req.currentShift !== '-';

  return `
    <article class="request-card" id="request-${req.id}" style="${isRejected ? 'background:#fff8f8;' : isApproved ? 'background:#f0fdf4;' : isCancelled ? 'opacity:0.65;' : ''}">
      <div class="avatar request-card-avatar" style="${isSupervisorRole(req.person) ? 'background:var(--navy-2);color:#ffffff' : ''}">${req.initials}</div>
      <div class="request-card-body">
        <div class="request-card-head">
          <div class="request-card-heading">
            <strong>${req.person}</strong>
            <span class="request-card-subtitle">${req.roleCategory}</span>
          </div>
          <div class="request-card-state">
            <span class="request-type-label">${req.type}</span>
            ${statusPill}
          </div>
        </div>

        <div class="request-card-desc">
          <strong>${req.date}</strong><span class="request-card-dot">·</span><span>${req.reason}</span>
        </div>

        ${hasShiftChange || req.targetPerson ? `
          <div class="request-info-grid">
            ${hasShiftChange ? `
              <div class="request-info-item">
                <span class="request-info-label">${req.type.includes('OT') ? 'กะเดิม → OT ที่ขอ' : 'กะเดิม → กะใหม่'}</span>
                <span class="request-info-value request-shift-change">${req.currentShift} ${getIcon('arrowRight', 'icon-xs')} ${req.targetShift}</span>
              </div>
            ` : ''}
            ${req.targetPerson ? `
              <div class="request-info-item">
                <span class="request-info-label">คู่สลับ</span>
                <span class="request-info-value">${getIcon('users', 'icon-xs')} ${req.targetPerson}${req.targetRole ? `<span class="request-info-secondary">${req.targetRole}</span>` : ''}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${req.rejectReason ? `
          <div class="request-rejection-note">
            <strong>เหตุผลที่ไม่อนุมัติ:</strong> ${req.rejectReason}
          </div>
        ` : ''}

        <div class="request-card-meta">
          <span>${getIcon('clock', 'icon-sm')} ยื่นเมื่อ ${req.submittedAt}</span>
          ${req.quotaUsed !== '-' ? `<span class="request-meta-divider"></span><span>โควตาเดือนนี้ <strong>${req.quotaUsed}</strong></span>` : ''}
        </div>

        ${req.approvers && req.approvers.length > 1 ? `
          <div class="request-approval">
            <span class="request-approval-title">ขั้นตอนอนุมัติ</span>
            <div class="approval-stepper">
              ${req.approvers.map((a, i) => {
                const priorAllApproved = req.approvers.slice(0, i).every(p => p.status === 'approved');
                const stepClass = a.status === 'approved' ? 'done' : (priorAllApproved ? 'active' : '');
                const isLast = i === req.approvers.length - 1;
                const label = a.status === 'approved'
                  ? (isLast ? 'อนุมัติครบแล้ว' : 'อนุมัติแล้ว')
                  : (priorAllApproved ? 'รอดำเนินการ' : `รอขั้นที่ ${i + 1}`);
                return `
                  <span class="stepper-step ${stepClass}">
                    ${a.status === 'approved' ? getIcon('check', 'icon-xs') : getIcon('clock', 'icon-xs')}
                    <span>${a.role}<small>${label}</small></span>
                  </span>
                  ${!isLast ? '<span class="stepper-arrow">›</span>' : ''}
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      ${isPending && canReview ? `
        <div class="request-actions">
          <button class="btn-icon-action btn-icon-reject" aria-label="ไม่อนุมัติคำขอ" title="ปฏิเสธคำขอ (ระบุเหตุผล)" onclick="promptRejectRequest(${req.id})">
            ${getIcon('x', 'icon-sm')}<span>ไม่อนุมัติ</span>
          </button>
          <button class="btn-icon-action btn-icon-approve" aria-label="อนุมัติคำขอ" title="อนุมัติคำขอ" onclick="approveRequest(${req.id})">
            ${getIcon('check', 'icon-sm')}<span>อนุมัติ</span>
          </button>
        </div>
      ` : state.activeRole === 'Shift Employee' ? `
        <div class="request-view-action">
          <button class="btn btn-secondary btn-sm" onclick="openRequestDetails(${req.id})">ดูรายละเอียด</button>
          ${canWithdrawRequest(req)
            ? `<button class="btn btn-secondary btn-sm" style="color:#b91c1c" title="ยกเลิกได้จนกว่าหัวหน้ากะจะเริ่มตรวจสอบ" onclick="withdrawRequest(${req.id})">ยกเลิกคำขอ</button>`
            : isPending ? `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.45;cursor:not-allowed" title="ยกเลิกไม่ได้ — คำขอนี้ผ่านการตรวจสอบไปแล้ว">ยกเลิกคำขอ</button>` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

function openRequestDetails(reqId) {
  const req = state.requests.find(request => request.id === reqId);
  if (!req) return;

  const statusLabel = req.status === 'อนุมัติแล้ว'
    ? 'อนุมัติแล้ว'
    : req.status === 'ไม่อนุมัติ'
      ? 'ไม่อนุมัติ'
      : 'รอตรวจสอบ';
  const statusClass = req.status === 'อนุมัติแล้ว'
    ? 'pill-approved'
    : req.status === 'ไม่อนุมัติ'
      ? 'pill-rejected'
      : 'pill-pending';

  const bodyHtml = `
    <div class="request-detail-view">
      <div class="request-detail-status">
        <span>สถานะคำขอ</span>
        <span class="pill ${statusClass}">${statusLabel}</span>
      </div>
      <dl class="request-detail-list">
        <div class="request-detail-row"><dt>ประเภทคำขอ</dt><dd>${req.type}</dd></div>
        <div class="request-detail-row"><dt>วันที่เกี่ยวข้อง</dt><dd>${req.date}</dd></div>
        ${req.targetPerson ? `<div class="request-detail-row"><dt>คู่สลับ/ผู้เกี่ยวข้อง</dt><dd>${req.targetPerson}${req.targetRole ? ` (${req.targetRole})` : ''}</dd></div>` : ''}
        ${req.currentShift && req.currentShift !== '-' ? `<div class="request-detail-row"><dt>กะเดิม → กะใหม่</dt><dd>${req.currentShift} → ${req.targetShift}</dd></div>` : ''}
        <div class="request-detail-row request-detail-row-long"><dt>รายละเอียด</dt><dd>${req.reason}</dd></div>
        <div class="request-detail-row"><dt>ส่งคำขอเมื่อ</dt><dd>${req.submittedAt}</dd></div>
        <div class="request-detail-row"><dt>ผู้ตรวจสอบ</dt><dd>${req.approvers.map(approver => approver.role).join(', ')}</dd></div>
        ${req.rejectReason ? `<div class="request-detail-row request-detail-row-long"><dt>เหตุผลที่ไม่อนุมัติ</dt><dd>${req.rejectReason}</dd></div>` : ''}
      </dl>
    </div>
  `;

  const footerHtml = canWithdrawRequest(req)
    ? `<button class="btn btn-secondary" onclick="closeModal()">ปิด</button><button class="btn btn-danger" onclick="withdrawRequest(${req.id})">ยกเลิกคำขอ</button>`
    : '<button class="btn btn-secondary" onclick="closeModal()">ปิด</button>';
  openModal('รายละเอียดคำขอ', bodyHtml, footerHtml);
}

function isSupervisorRole(name) {
  return getAllEmployees().some(e => e.name === name && e.roleCategory === 'Shift Supervisor');
}

// Interactive Testcase Handlers
function simulateQuotaExceeded() {
  const limit = state.managerConfig.swapRequestMonthlyLimit;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-md);color:#991b1b">
        <strong style="display:block;font-size:12px">⚠️ ตรวจพบข้อจำกัดโควตา (US-023 Quota Exceeded)</strong>
        <p style="font-size:11px;margin-top:4px">
          พนักงาน <strong>วราเทพ นิยากุล</strong> ได้ใช้สิทธิ์สลับกะในเดือน${thaiMonthName(state.currentMonth)} ${state.currentYear + 543} ไปแล้ว <strong>${limit} / ${limit} ครั้ง</strong> (ครบโควตาสูงสุดที่ระบบอนุญาต)
        </p>
      </div>

      <div class="form-group">
        <label>ผู้ยื่นคำขอ</label>
        <div class="form-readonly">
          <div class="form-readonly-name">วราเทพ นิยากุล</div>
          <div class="form-readonly-meta">Shift Employee · Shift A</div>
        </div>
      </div>

      <div class="form-group">
        <label>สิทธิ์คงเหลือเดือนนี้</label>
        <div class="form-readonly">
          <div class="form-readonly-name" style="color:#b91c1c">0 / ${limit} ครั้ง — ใช้สิทธิ์ครบแล้ว</div>
        </div>
      </div>

      <div class="validation-panel">
        <div class="validation-panel-title">ผลการตรวจสอบสิทธิ์อัตโนมัติ</div>
        <div class="validation-check-item fail">
          ${getIcon('x', 'icon-sm')}
          <span><strong>สิทธิ์สลับกะ:</strong> เกินโควตาสูงสุด ${limit} ครั้ง/เดือน — ระบบไม่อนุญาตให้ส่งคำขอเพิ่ม</span>
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
    <button type="button" class="btn btn-primary" disabled style="opacity:0.5;cursor:not-allowed">
      ส่งคำขอ (ถูกบล็อคโดยระบบ)
    </button>
  `;

  openModal('ทดสอบระบบโควตา: วราเทพ นิยากุล (US-023)', bodyHtml, footerHtml);
}

function simulateDualApprovalStep() {
  const req = state.requests.find(r => r.isCrossShift && r.approvers && r.approvers.length > 1);
  if (!req) {
    showToast('ไม่พบคำขอข้ามทีมที่ต้องอนุมัติ 2 ฝ่าย', 'alert');
    return;
  }

  const nextStep = req.approvers.find(a => a.status !== 'approved');
  if (!nextStep) {
    showToast('คำขอนี้ได้รับการอนุมัติครบทุกฝ่ายเรียบร้อยแล้ว');
    return;
  }

  // Complete the pending approval step
  nextStep.status = 'approved';
  nextStep.at = '09:05';
  req.status = 'อนุมัติแล้ว';

  state.auditLogs.unshift({
    id: Date.now(),
    actor: state.roles[state.activeRole]?.name || state.activeRole,
    avatar: state.roles[state.activeRole]?.initials || '--',
    action: `อนุมัติคำขอสลับกะข้ามทีม (ฝ่ายสุดท้ายครบสมบูรณ์) ของ ${req.person}`,
    time: 'เมื่อสักครู่'
  });

  showToast(`${nextStep.role} กดยืนยันแล้ว — อนุมัติครบทุกฝ่ายเรียบร้อย!`, 'check');
  renderApp();
}

function resetTestcases() {
  state.requests = [
    {
      id: 101,
      type: 'สลับกะข้ามทีม (Shift A ↔ Shift B)',
      person: 'วราเทพ นิยากุล',
      requesterId: '140',
      initials: 'วน',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: 'กัณฑ์เอนก สุวัฒนกุล',
      targetRole: 'Shift Employee (Shift B)',
      date: '14 ส.ค. 2569',
      currentShift: 'N',
      targetShift: 'M',
      reason: 'ขอสลับกะกับเพื่อนร่วมงานต่างทีม (N↔M ข้ามทีม A↔B)',
      isCrossShift: true,
      approvers: [
        { role: 'Shift Supervisor B (สุระศักดิ์)', status: 'approved', at: '08:15' },
        { role: 'Shift Supervisor A (ณัฐพล)', status: 'pending' }
      ],
      status: 'รออนุมัติครบ 2 ฝ่าย',
      submittedAt: '1 ชั่วโมงที่แล้ว',
      quotaUsed: '1 / 2 ครั้ง'
    },
    {
      id: 103,
      type: 'ขอทำ OT',
      person: 'วราเทพ นิยากุล',
      requesterId: '140',
      initials: 'วน',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: null,
      targetRole: null,
      date: '20 ส.ค. 2569',
      currentShift: 'O',
      targetShift: 'OT',
      reason: 'ขอทำงานล่วงเวลาในวันหยุด — เสริมกำลังสายผลิตช่วงสั่งซื้อด่วน',
      isCrossShift: false,
      approvers: [
        { role: 'หัวหน้ากะตรวจสอบ (Shift A)', status: 'pending' },
        { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }
      ],
      status: 'รอดำเนินการ',
      submittedAt: '20 นาทีที่แล้ว',
      quotaUsed: '-'
    }
  ];

  showToast('รีเซ็ตข้อมูลคำขอทดสอบเรียบร้อยแล้ว');
  renderApp();
}

function getEmployeeFacingRoleLabel(roleCategory) {
  const labels = { 'Shift Supervisor': 'หัวหน้ากะ', 'Shift Employee': 'พนักงานปฏิบัติ' };
  return labels[roleCategory] || roleCategory;
}

function getEmployeeFacingShiftLabel(code) {
  const labels = {
    M: 'กะเช้า',
    MT: 'กะเช้าพร้อมทำงานล่วงเวลา',
    MTh: 'กะเช้าพร้อมทำงานล่วงเวลาครึ่งวัน',
    N: 'กะดึก',
    NT: 'กะดึกพร้อมทำงานล่วงเวลา',
    NTh: 'กะดึกพร้อมทำงานล่วงเวลาครึ่งวัน',
    OT: 'ทำงานล่วงเวลา (OT)',
    D: 'เวลาทำการปกติ',
    O: 'วันหยุด',
    V: 'ลาพักร้อน',
    B: 'ลากิจ',
    S: 'ลาป่วย',
    H: 'วันหยุดนักขัตฤกษ์',
    VG: 'ลาอื่นๆ',
    VGh: 'ลาอื่นๆ ครึ่งวัน'
  };
  return labels[code] || state.shiftDefs[code]?.label || code;
}

// เมนูคำขอตามบริบทของวัน — แตะการ์ดวันแล้วเลือกประเภทคำขอที่ทำได้จริงสำหรับวันนั้น
function openDayActionMenu(dayNum) {
  const currentEmp = getAllEmployees().find(e => e.name === state.roles['Shift Employee'].name);
  if (!currentEmp) return;

  const code = getShiftCodeForDate(currentEmp, state.currentYear, state.currentMonth, dayNum);
  const def = state.shiftDefs[code] || state.shiftDefs.O;
  const dt = new Date(state.currentYear, state.currentMonth, dayNum);
  const dateLabel = dt.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const menuBtn = (icon, bg, color, title, sub, onclick) => `
    <button class="btn btn-secondary request-action-btn" style="margin-bottom:8px" onclick="${onclick}">
      <div class="avatar avatar-sm" style="background:${bg};color:${color}">${getIcon(icon, 'icon-sm')}</div>
      <div class="req-text">
        <strong>${title}</strong>
        <small>${sub}</small>
      </div>
      ${getIcon('arrowRight', 'icon-sm')}
    </button>`;

  let actions;
  if (code === 'H') {
    actions = menuBtn('check', '#ecfdf5', '#047857',
      'เลือกใช้สิทธิ์วันหยุดนักขัตฤกษ์',
      'ขอใช้สิทธิ์หยุดตามประกาศวันหยุดนักขัตฤกษ์ (H)',
      `openPublicHolidayModal('${currentEmp.id}')`);
  } else if (def.leave) {
    actions = `<div style="padding:12px;background:var(--bg-subtle);border-radius:var(--radius-md);font-size:12px;color:var(--muted);line-height:1.5">
      วันนี้เป็น${getEmployeeFacingShiftLabel(code)}แล้ว — ไม่สามารถยื่นคำขอเพิ่มเติมสำหรับวันนี้ได้ หากต้องการแก้ไขกรุณาติดต่อหัวหน้ากะ
    </div>`;
  } else if (def.family === 'O') {
    actions = menuBtn('calendar', '#fffbeb', '#b45309',
      'ขอเปลี่ยนวันหยุด',
      'เลือกวันใหม่ไม่เกิน 7 วันก่อนหรือหลังวันหยุดเดิม',
      `openDayOffChangeModal('${currentEmp.id}', ${dayNum})`)
      + menuBtn('clock', '#fef3c7', '#92400e',
      'ขอทำงานล่วงเวลา (OT)',
      'ทำงานล่วงเวลาในวันหยุดนี้',
      `openOTRequestModal('${currentEmp.id}', ${dayNum})`);
  } else {
    actions = menuBtn('users', 'var(--mint-light)', 'var(--mint-text)',
      'ขอสลับกะกับเพื่อนร่วมงาน',
      `สลับ${getEmployeeFacingShiftLabel(code)}ของวันนี้กับเพื่อนต่างทีม`,
      `openColleagueSwapModal(findEmployeeById('${currentEmp.id}'), null, ${dayNum})`)
      + menuBtn('inbox', '#eef2ff', '#4338ca',
      'ขอลาในวันนี้',
      'เลือกประเภทการลาสำหรับวันที่เลือก',
      `openLeaveRequestModal('${currentEmp.id}', ${dayNum})`)
      + menuBtn('clock', '#fef3c7', '#92400e',
      'ขอทำงานล่วงเวลา (OT)',
      'เลือกรูปแบบ OT สำหรับวันนี้',
      `openOTRequestModal('${currentEmp.id}', ${dayNum})`);
  }

  openModal(dateLabel, `
    <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-subtle);border-radius:var(--radius-md);margin-bottom:14px">
      <span class="shift-badge-cell ${getBadgeClass(code)}" style="width:36px;height:30px;font-size:12px;flex-shrink:0">${code}</span>
      <div style="min-width:0">
        <strong style="display:block;font-size:13px">${getEmployeeFacingShiftLabel(code)}</strong>
        <div style="font-size:11px;color:var(--muted)">${def.time || ''}</div>
      </div>
    </div>
    ${actions}
  `);
}

// Operator View
function renderOperatorView() {
  const currentEmp = getAllEmployees().find(employee => employee.name === state.roles['Shift Employee'].name);
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const monthLabel = new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const todayNum = Math.min(state.currentDay, daysInMonth);

  const hasData = hasScheduleDataForMonth(state.currentYear, state.currentMonth);

  // ทีมหัวหน้ากะที่รับผิดชอบพนักงานคนนี้ (ดึงจากข้อมูลจริง ไม่ Hardcode ชื่อ)
  const teamSupervisor = currentEmp
    ? getAllEmployees().find(e => e.roleCategory === 'Shift Supervisor' && e.shiftType === currentEmp.shiftType)
    : null;

  const todayCode = currentEmp ? getShiftCodeForDate(currentEmp, state.currentYear, state.currentMonth, todayNum) : 'O';
  const todayDef = state.shiftDefs[todayCode] || state.shiftDefs.O;
  const todayDateStr = new Date(state.currentYear, state.currentMonth, todayNum).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // นับวันทำงานต่อเนื่องจริงจากข้อมูลกะ (นับย้อนหลังจากวันนี้จนกว่าจะเจอวันหยุด)
  let consecutiveDays = 0;
  if (currentEmp) {
    for (let d = todayNum; d >= 1; d--) {
      const code = getShiftCodeForDate(currentEmp, state.currentYear, state.currentMonth, d);
      const def = state.shiftDefs[code];
      if (!def || def.family === 'off' || code === 'O' || def.leave) break;
      consecutiveDays++;
    }
  }

  // สร้างแถบ 7 วัน โดยเริ่มจากวันนี้ (ไม่เกินจำนวนวันจริงในเดือน)
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = todayNum + i;
    if (d > daysInMonth) break;
    const code = currentEmp ? getShiftCodeForDate(currentEmp, state.currentYear, state.currentMonth, d) : 'O';
    const def = state.shiftDefs[code] || state.shiftDefs.O;
    const dt = new Date(state.currentYear, state.currentMonth, d);
    days.push({
      dayNum: d,
      label: `${dt.toLocaleDateString('th-TH', { weekday: 'short' })} ${String(d).padStart(2, '0')}`,
      code,
      status: getEmployeeFacingShiftLabel(code)
    });
  }

  // คำขอที่รอดำเนินการของพนักงานคนนี้จริง (ไม่ใช้ตัวอย่างสมมติ)
  const myPendingRequests = currentEmp
    ? state.requests.filter(r => r.requesterId === currentEmp.id && r.status !== 'อนุมัติแล้ว').slice(0, 3)
    : [];

  return `
    <div class="grid-2col">
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="operator-hero-card">
          <div class="operator-hero-date">${todayDateStr} · ทีม ${currentEmp?.shiftType || '-'}</div>
          <div class="operator-hero-shift">${getEmployeeFacingShiftLabel(todayCode)} · รหัส ${todayCode}</div>
          <p style="color:#cbd5e1;font-size:13px">หัวหน้ากะ: ${teamSupervisor ? `คุณ${teamSupervisor.name}` : 'ไม่ระบุ'}</p>

          <div class="operator-hero-meta">
            <div class="operator-meta-col">
              <small>เวลาปฏิบัติงาน</small>
              <strong>${todayDef.time || '-'}</strong>
            </div>
            <div class="operator-meta-col">
              <small>รหัสพนักงาน</small>
              <strong>${currentEmp?.code || currentEmp?.id || '-'}</strong>
            </div>
            <div class="operator-meta-col">
              <small>วันทำงานต่อเนื่อง</small>
              <strong>${consecutiveDays} / ${state.managerConfig.maxConsecutiveWorkDays} วัน</strong>
            </div>
          </div>
        </div>

        <div class="card" style="flex:1;display:flex;flex-direction:column">
          <div class="card-header">
            <div class="card-title">
              <h3>ตารางกะของฉัน ${days.length} วัน (${monthLabel})</h3>
              <p>แตะวันเพื่อดูรายละเอียดและเลือกประเภทคำขอ · ${hasData ? 'แสดงข้อมูลตารางจริง' : 'ตารางนี้เป็นการคาดการณ์ ยังไม่ใช่ตารางจริง'}</p>
            </div>
          </div>
          <div class="card-body" style="flex:1;display:flex;flex-direction:column;justify-content:center">
            <div class="seven-day-strip">
              ${days.map(d => `
                <div class="day-card ${d.dayNum === todayNum ? 'today' : ''}" onclick="openDayActionMenu(${d.dayNum})" title="แตะเพื่อดูรายละเอียดและเลือกคำขอสำหรับวันนี้">
                  <div class="day-card-date">${d.label}</div>
                  ${renderShiftBadge(d.code, false, null, null, !hasData)}
                  <div class="day-card-status">${d.status}</div>
                </div>
              `).join('')}
            </div>
            ${!hasData ? `<div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;color:var(--muted)"><span class="shift-badge-cell O projected-cell" style="width:22px;height:18px;font-size:9px;flex-shrink:0">O</span>เส้นประ = ตารางคาดการณ์ ยังไม่ประกาศอย่างเป็นทางการ</div>` : ''}
            <button class="btn btn-secondary" style="width:100%;margin-top:14px" onclick="toggleOperatorFullGrid(true)">
              ${getIcon('calendar', 'icon-sm')} ดูตารางกะเต็มรูปแบบของทุกทีม
            </button>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <h3>ส่งคำขอ</h3>
              <p>ระบบตรวจสอบเงื่อนไขเบื้องต้นก่อนส่งให้หัวหน้ากะพิจารณา</p>
            </div>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
            <button class="btn btn-secondary request-action-btn" onclick="openColleagueSwapModal(findEmployeeById('${currentEmp?.id}'), null, ${todayNum})">
              <div class="avatar avatar-sm" style="background:var(--mint-light);color:var(--mint-text)">${getIcon('users', 'icon-sm')}</div>
              <div class="req-text">
                <strong>ขอสลับกะกับเพื่อนร่วมงาน</strong>
                <small>เลือกเพื่อนร่วมงานต่างทีม · เหลือสิทธิ์ ${Math.max(0, state.managerConfig.swapRequestMonthlyLimit - countMonthlySwapRequests(currentEmp?.id))}/${state.managerConfig.swapRequestMonthlyLimit} ครั้ง</small>
              </div>
              ${getIcon('arrowRight', 'icon-sm')}
            </button>

            <button class="btn btn-secondary request-action-btn" onclick="openDayOffChangeModal('${currentEmp?.id}')">
              <div class="avatar avatar-sm" style="background:#fffbeb;color:#b45309">${getIcon('calendar', 'icon-sm')}</div>
              <div class="req-text">
                <strong>ขอเปลี่ยนวันหยุด</strong>
                <small>เลือกวันใหม่ไม่เกิน 7 วันก่อนหรือหลังวันหยุดเดิม</small>
              </div>
              ${getIcon('arrowRight', 'icon-sm')}
            </button>

            <button class="btn btn-secondary request-action-btn" onclick="openLeaveRequestModal('${currentEmp?.id}')">
              <div class="avatar avatar-sm" style="background:#eef2ff;color:#4338ca">${getIcon('inbox', 'icon-sm')}</div>
              <div class="req-text">
                <strong>ขอลา</strong>
                <small>เลือกประเภทการลาและวันที่ต้องการลา</small>
              </div>
              ${getIcon('arrowRight', 'icon-sm')}
            </button>

            <button class="btn btn-secondary request-action-btn" onclick="openOTRequestModal('${currentEmp?.id}')">
              <div class="avatar avatar-sm" style="background:#fef3c7;color:#92400e">${getIcon('clock', 'icon-sm')}</div>
              <div class="req-text">
                <strong>ขอทำงานล่วงเวลา (OT)</strong>
                <small>เลือกวันและรูปแบบ OT · อนุมัติโดยหัวหน้ากะและผู้จัดการ</small>
              </div>
              ${getIcon('arrowRight', 'icon-sm')}
            </button>

            <button class="btn btn-secondary request-action-btn" onclick="openPublicHolidayModal('${currentEmp?.id}')">
              <div class="avatar avatar-sm" style="background:#ecfdf5;color:#047857">${getIcon('check', 'icon-sm')}</div>
              <div class="req-text">
                <strong>เลือกใช้สิทธิ์วันหยุดนักขัตฤกษ์</strong>
                <small>ขอใช้สิทธิ์หยุดตามประกาศวันหยุดนักขัตฤกษ์ (H)</small>
              </div>
              ${getIcon('arrowRight', 'icon-sm')}
            </button>
          </div>
        </div>

        <div class="card" style="flex:1;display:flex;flex-direction:column">
          <div class="card-header">
            <div class="card-title">
              <h3>สถานะคำขอของฉัน</h3>
              <p>ดูรายการคำขอและสถานะล่าสุดของคุณ</p>
            </div>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            ${myPendingRequests.length ? myPendingRequests.map(r => `
              <div style="padding:12px;border-radius:var(--radius-md);background:var(--bg-subtle);border:1px solid var(--line)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong style="font-size:12px">${r.type} · ${r.date}</strong>
                  <span class="pill pill-pending">${r.status}</span>
                </div>
                ${r.targetPerson ? `<p style="font-size:11px;color:var(--ink-secondary);margin-top:4px">สลับกะกับ ${r.targetPerson}</p>` : ''}
                <small style="display:block;color:var(--muted);margin-top:6px;font-size:10px">ยื่นเมื่อ ${r.submittedAt}</small>
              </div>
            `).join('') : `
              <div style="padding:12px;border-radius:var(--radius-md);background:var(--bg-subtle);border:1px solid var(--line);text-align:center;color:var(--muted);font-size:12px">
                ไม่มีคำขอที่รอดำเนินการในขณะนี้
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

// HR View
function renderHRView() {
  const allEmps = getAllEmployees();
  const otEligible = allEmps.filter(e => e.shifts.some(s => state.shiftDefs[s] && state.shiftDefs[s].ot)).length;

  return `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-card-top">
          <div class="metric-icon-box mint">${getIcon('file-text')}</div>
        </div>
        <div class="metric-value">${allEmps.length * 30} กะ</div>
        <div class="metric-label">กะที่อนุมัติแล้วประจำเดือน</div>
        <div class="metric-sub">4 ทีม x 30 วัน</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-top">
          <div class="metric-icon-box amber">${getIcon('clock')}</div>
          <span class="pill pill-pending">พร้อมคิดเงิน</span>
        </div>
        <div class="metric-value">${otEligible} คน</div>
        <div class="metric-label">พนักงานที่มีชั่วโมงล่วงเวลา (OT)</div>
        <div class="metric-sub">MT / NT / MTh / NTh / OT ส่งต่องานกะ</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-top">
          <div class="metric-icon-box indigo">${getIcon('download')}</div>
          <span class="pill pill-draft">CSV / Excel</span>
        </div>
        <div class="metric-value">08:42 น.</div>
        <div class="metric-label">ส่งออกข้อมูลล่าสุด</div>
        <div class="metric-sub">เปลี่ยนแปลงหลังส่งออก: 0 รายการ</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-top">
          <div class="metric-icon-box mint">${getIcon('users')}</div>
          <span class="pill pill-approved">4 Shifts</span>
        </div>
        <div class="metric-value">${allEmps.length} คน</div>
        <div class="metric-label">จำนวนพนักงานรวมทั้ง 4 กะ</div>
        <div class="metric-sub">Shift Supervisors (4) + Shift Operators (${allEmps.length - 4})</div>
      </div>
    </div>

    <div class="grid-2col">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <h3>ข้อมูลตารางกะที่อนุมัติแล้ว (HR Master Data)</h3>
            <p>แสดงเฉพาะข้อมูลที่ผ่านการอนุมัติอย่างเป็นทางการ เพื่อใช้คิดเงินเดือน เบี้ยกะ และ OT</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ-นามสกุล</th>
                <th>สังกัดกะ</th>
                <th>บทบาท</th>
                <th>วันทำงาน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${allEmps.map(emp => {
                const workDays = emp.shifts.filter(s => s !== 'O').length;
                return `
                  <tr>
                    <td><strong>${emp.id}</strong></td>
                    <td><b>${emp.name}</b></td>
                    <td>${emp.shiftType}</td>
                    <td><span class="pill pill-draft">${emp.roleCategory}</span></td>
                    <td>${workDays} วัน</td>
                    <td><span class="pill pill-approved">พร้อมนำเข้า Payroll</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <h3>ส่งออกไฟล์ข้อมูล (Export Center)</h3>
            <p>ดาวน์โหลดโครงสร้างไฟล์ CSV ตามมาตรฐาน Payroll</p>
          </div>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
          <div style="padding:16px;border:1px solid var(--line);border-radius:var(--radius-md)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong style="display:block;font-size:13px">ตารางกะทั้ง 4 กะรายเดือน</strong>
                <small style="color:var(--muted)">CSV Data Format · Shift A / B / C / D</small>
              </div>
              <button class="btn btn-primary btn-sm" onclick="exportMonthlyCSV()">
                ${getIcon('download', 'icon-sm')} ส่งออก CSV
              </button>
            </div>
          </div>

          <div style="padding:16px;border:1px solid var(--line);border-radius:var(--radius-md)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong style="display:block;font-size:13px">ประวัติการลา (Leave Records)</strong>
                <small style="color:var(--muted)">V / B / S / H / VG / VGh — สำหรับฝ่ายบุคคล</small>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="exportLeaveRecordsCSV()">
                ${getIcon('download', 'icon-sm')} ส่งออก CSV
              </button>
            </div>
          </div>

          <div style="padding:16px;border:1px solid var(--line);border-radius:var(--radius-md)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong style="display:block;font-size:13px">ประวัติการทำ OT (OT Records)</strong>
                <small style="color:var(--muted)">MT / NT / MTh / NTh / OT — สำหรับฝ่ายบุคคล</small>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="exportOTRecordsCSV()">
                ${getIcon('download', 'icon-sm')} ส่งออก CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Driver View
function renderDriverView() {
  const isAck = state.driverAcknowledged;

  return `
    <div style="max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
      <div style="padding:16px 20px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:var(--radius-lg);display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar avatar-sm" style="background:#047857;color:#ffffff">${getIcon('check', 'icon-sm')}</div>
          <div>
            <strong style="color:#065f46;font-size:13px;display:block">ข้อมูลตารางรับส่งล่าสุด (Fresh & Approved)</strong>
            <small style="color:#047857;font-size:11px">อัปเดตล่าสุด 08:42 น. · Morning Shift (05:45 น.) / Night Shift (18:30 น.)</small>
          </div>
        </div>
        <span class="pill pill-approved">สายหลัก (สาย A)</span>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <h3>รายชื่อพนักงานและจุดรับส่งวันนี้ (แยกตามกะ)</h3>
            <p>วัน${new Date(state.currentYear, state.currentMonth, Math.min(state.currentDay, new Date(state.currentYear, state.currentMonth + 1, 0).getDate())).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · รถตู้ทะเบียน ฮฮ-8899 กทม.</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>ชื่อ-นามสกุล</th>
                <th>สังกัดกะ</th>
                <th>บทบาท</th>
                <th>จุดรับ-ส่ง</th>
                <th>เวลานัดหมาย</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td><b>Kanya Srisawat</b></td>
                <td>Morning Shift</td>
                <td><span class="pill pill-approved">Shift Supervisor</span></td>
                <td>Gate 1</td>
                <td>06:30 น.</td>
              </tr>
              <tr>
                <td>2</td>
                <td><b>Charuwan Kasaempan</b></td>
                <td>Morning Shift</td>
                <td><span class="pill pill-draft">Shift Employee</span></td>
                <td>หอพักพนักงาน A</td>
                <td>06:35 น.</td>
              </tr>
              <tr>
                <td>3</td>
                <td><b>Thanakorn Chaiyawan</b></td>
                <td>Night Shift</td>
                <td><span class="pill pill-approved">Shift Supervisor</span></td>
                <td>Gate 2</td>
                <td>18:15 น.</td>
              </tr>
              <tr>
                <td>4</td>
                <td><b>Juladit Teekawiwat</b></td>
                <td>Night Shift</td>
                <td><span class="pill pill-draft">Shift Employee</span></td>
                <td>หอพักพนักงาน B</td>
                <td>18:25 น.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-body" style="background:var(--surface-muted);border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-size:12px;color:var(--ink)">ยืนยันการรับทราบตารางรับส่งประจำวัน</strong>
            <p style="font-size:11px;color:var(--muted)">เมื่อกดยืนยัน ระบบจะบันทึกเวลาเพื่อให้หัวหน้ากะทราบว่าคนขับได้รับข้อมูลแล้ว</p>
          </div>
          ${isAck ? `
            <span class="pill pill-approved" style="font-size:12px;padding:6px 14px">
              ${getIcon('check', 'icon-sm')} ยืนยันแล้วเมื่อ ${state.driverAckTime}
            </span>
          ` : `
            <button class="btn btn-mint" onclick="acknowledgeDriverSchedule()">
              ${getIcon('check', 'icon-sm')} รับทราบและยืนยันตารางงาน
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// Employee and Team Management (Manager)
function renderPeopleView() {
  const teams = ['ALL', 'Shift A', 'Shift B', 'Shift C', 'Shift D'];
  const allEmployees = getAllEmployees();
  const employees = allEmployees.filter(employee => {
    const matchesTeam = state.employeeTeamFilter === 'ALL' || employee.shiftType === state.employeeTeamFilter;
    const searchTerm = state.employeeSearch.trim().toLowerCase();
    const matchesSearch = !searchTerm
      || employee.name.toLowerCase().includes(searchTerm)
      || employee.id.includes(searchTerm);
    return matchesTeam && matchesSearch;
  });
  const teamCounts = ['Shift A', 'Shift B', 'Shift C', 'Shift D'].map(team => ({
    team,
    count: allEmployees.filter(employee => employee.shiftType === team).length
  }));

  return `
    <div class="people-page">
      <div class="people-summary" aria-label="สรุปจำนวนพนักงาน" style="grid-template-columns:repeat(5, 1fr)">
        <div class="people-stat">
          <span class="people-stat-label">พนักงานทั้งหมด</span>
          <strong>${allEmployees.length}</strong>
          <span>คน</span>
        </div>
        ${teamCounts.map(({ team, count }) => `
          <div class="people-stat">
            <span class="people-stat-label">${team}</span>
            <strong>${count}</strong>
            <span>คน</span>
          </div>
        `).join('')}
      </div>

      <section class="card people-list-card">
        <div class="card-header people-list-header">
          <div class="card-title">
            <h3>รายชื่อพนักงาน</h3>
            <p>แก้ไขข้อมูลหรือย้ายพนักงานระหว่างทีมจากรายการนี้ (โครงสร้างมาตรฐาน 7 ตำแหน่งต่อกะ: หัวหน้ากะ 1 + พนักงานกะ 6)</p>
          </div>
          <div class="people-list-tools">
            <button class="btn btn-primary people-add-button" onclick="openEmployeeForm()">
              ${getIcon('users', 'icon-sm')} เพิ่มพนักงาน
            </button>
            <div class="people-filters">
            <label class="people-search">
              <span class="sr-only">ค้นหาพนักงาน</span>
              <input class="form-control" value="${state.employeeSearch}" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" oninput="filterEmployeeSearch(this.value)">
            </label>
            <label class="people-team-filter">
              <span>ทีม</span>
              <select class="role-select" onchange="filterEmployeeTeam(this.value)">
                ${teams.map(team => `<option value="${team}" ${state.employeeTeamFilter === team ? 'selected' : ''}>${team === 'ALL' ? 'ทั้งหมด' : team}</option>`).join('')}
              </select>
            </label>
            </div>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table people-table">
            <thead>
              <tr>
                <th>รหัสพนักงาน</th>
                <th>ชื่อ-นามสกุล</th>
                <th>ทีม</th>
                <th>ตำแหน่ง</th>
                <th>เบอร์ติดต่อ</th>
                <th class="table-action-heading">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${employees.length ? employees.map(employee => `
                <tr>
                  <td class="employee-code">${employee.id}</td>
                  <td><strong>${employee.name}</strong></td>
                  <td><span class="pill pill-draft">${employee.shiftType}</span></td>
                  <td>${employee.position || (employee.roleCategory === 'Shift Supervisor' ? 'Shift Supervisor (S)' : 'Shift Operator')}</td>
                  <td class="employee-phone">${employee.phone}</td>
                  <td class="table-action-cell">
                    <button class="btn btn-secondary people-edit-button" onclick="openEmployeeForm('${employee.id}')">แก้ไข</button>
                  </td>
                </tr>
              `).join('') : `
                <tr><td colspan="6" class="people-empty-state">ไม่พบพนักงานตามตัวกรอง</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

// History View
function getVisibleAuditLogs() {
  if (state.activeRole !== 'Shift Employee') return state.auditLogs;

  const employee = getAllEmployees().find(item => item.name === state.roles[state.activeRole].name);
  return state.auditLogs.filter(log => log.employeeId === employee?.id || log.actor === employee?.name);
}

function renderHistoryView() {
  const isOperatorView = state.activeRole === 'Shift Employee';
  const visibleLogs = getVisibleAuditLogs();

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <h3>${isOperatorView ? 'ประวัติการทำรายการของฉัน' : 'บันทึกประวัติการเปลี่ยนแปลงตารางกะ (Audit Log & History)'}</h3>
          <p>${isOperatorView ? 'ตรวจสอบคำขอและการเปลี่ยนแปลงที่เกิดจากบัญชีของคุณ' : 'ประวัติการสร้าง แก้ไข อนุมัติ และส่งออกข้อมูลย้อนหลังตามมาตรฐาน ISO/IT Audit'}</p>
        </div>
      </div>
      <div class="card-body">
        <div class="audit-list">
          ${visibleLogs.length ? visibleLogs.map(log => `
            <div class="audit-item" style="padding-bottom:12px;border-bottom:1px solid var(--line-subtle)">
              <div class="avatar">${log.avatar}</div>
              <div>
                <p style="font-size:12px"><strong>${log.actor}</strong> ${log.action}</p>
                <small style="color:var(--muted)">บันทึกเวลา: ${log.time} · System Verified</small>
              </div>
            </div>
          `).join('') : '<div class="request-empty-state">ยังไม่มีประวัติการทำรายการ</div>'}
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// ANNUAL SCHEDULE (ตารางรายปี) — บทบาทผู้จัดการฝ่ายผลิตเท่านั้น
// จัดผังการหมุนเวียนกะรายทีมและวันหยุดนักขัตฤกษ์เป็น "รายปี" แก้ไขปีไหนก็ได้
// ไม่มีการแก้ไข/สลับกะรายบุคคลหรือรายวันในหน้านี้ (ทุกช่องกะเป็นตัวอย่าง ไม่คลิกได้)
// ==========================================================================
function renderAnnualScheduleView() {
  const year = state.annualScheduleYear;
  const cfg = getAnnualConfig(year);

  // พนักงานตัวแทนของแต่ละทีม ใช้คำนวณตัวเลขสรุปในภาพรวมเท่านั้น (ไม่ใช่การแก้ไขกะของคนนี้โดยเฉพาะ)
  const repEmpByTeam = {};
  ANNUAL_SCHEDULE_TEAMS.forEach(team => {
    repEmpByTeam[team] = getAllEmployees().find(e => e.shiftType === team && e.roleCategory !== 'Shift Supervisor')
      || getAllEmployees().find(e => e.shiftType === team);
  });

  const teamCards = ANNUAL_SCHEDULE_TEAMS.map(team => {
    const family = getTeamFamilyForYear(team, year);
    const memberCount = getAllEmployees().filter(e => e.shiftType === team).length;
    const isNatural = family === NATURAL_TEAM_FAMILY[team];
    return `
      <section class="card annual-team-card" aria-labelledby="annual-team-${team.replace(/\s+/g, '-').toLowerCase()}">
        <div class="card-body">
          <div class="annual-team-heading">
            <h3 id="annual-team-${team.replace(/\s+/g, '-').toLowerCase()}">${team}</h3>
            <span>${memberCount} คน${isNatural ? '' : ' · ปรับจากค่าเริ่มต้น'}</span>
          </div>
          <div class="big-toggle-group" role="group" aria-label="เลือกลำดับกะของ ${team}">
            <button type="button" class="big-toggle-btn ${family === 'M' ? 'active' : ''}" aria-pressed="${family === 'M'}" onclick="updateAnnualTeamFamily(${year}, '${team}', 'M')">
              ${getIcon('sun', 'icon-lg')}
              เช้าก่อน
            </button>
            <button type="button" class="big-toggle-btn ${family === 'N' ? 'active family-n' : ''}" aria-pressed="${family === 'N'}" onclick="updateAnnualTeamFamily(${year}, '${team}', 'N')">
              ${getIcon('moon', 'icon-lg')}
              ดึกก่อน
            </button>
          </div>
        </div>
      </section>
    `;
  }).join('');

  const holidays = cfg.holidays;
  const holidayPills = holidays.length ? holidays.map((h, idx) => `
    <span class="annual-holiday-chip">
      <span>${h}</span>
      <button class="annual-holiday-remove" type="button" onclick="removeAnnualHoliday(${year}, ${idx})" aria-label="ลบวันหยุด ${h}" title="ลบวันหยุดนี้">${getIcon('x', 'icon-sm')}</button>
    </span>
  `).join('') : `<span class="annual-empty-holidays">ยังไม่มีวันหยุดที่ตั้งค่าไว้</span>`;

  // ภาพรวม 12 เดือน — แบบการ์ดอ่านง่าย แสดงแค่ "ทำงานกี่วัน / หยุดกี่วัน" ต่อทีม ไม่มีตัวอักษรรหัสกะเรียงเป็นแถวให้ตาลาย
  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('th-TH', { month: 'long' }));
  const monthCards = monthNames.map((label, m) => {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const hasData = hasScheduleDataForMonth(year, m);
    const teamRows = ANNUAL_SCHEDULE_TEAMS.map(team => {
      const emp = repEmpByTeam[team];
      if (!emp) return '';
      let morningDays = 0, nightDays = 0, offDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const code = getShiftCodeForDate(emp, year, m, d);
        const def = state.shiftDefs[code];
        if (code === 'O') offDays++;
        else if (def && def.family === 'M') morningDays++;
        else if (def && def.family === 'N') nightDays++;
      }
      return `
        <div class="annual-month-team-row">
          <span class="annual-month-team">${team}</span>
          <span class="annual-month-count" aria-label="กะเช้า ${morningDays} วัน" title="กะเช้า ${morningDays} วัน">${getIcon('sun', 'icon-xs')} ${morningDays}</span>
          <span class="annual-month-count" aria-label="กะดึก ${nightDays} วัน" title="กะดึก ${nightDays} วัน">${getIcon('moon', 'icon-xs')} ${nightDays}</span>
          <span class="annual-month-off">O ${offDays}</span>
        </div>
      `;
    }).join('');
    return `
      <article class="card annual-month-card">
        <div class="card-body">
          <div class="annual-month-heading">
            <strong>${label}</strong>
            ${hasData ? `<span class="pill pill-approved">ข้อมูลจริง</span>` : ''}
          </div>
          <div class="annual-month-rows">${teamRows}</div>
        </div>
      </article>
    `;
  }).join('');

  return `
    <div class="annual-schedule-page">
      <header class="page-header annual-page-header">
        <div class="annual-year-control" aria-label="เลือกปีตาราง">
          <div class="annual-year-actions">
            <button class="btn btn-secondary annual-year-arrow" onclick="jumpAnnualYear(-1)" aria-label="ปีก่อนหน้า">${getIcon('arrowLeft', 'icon-sm')}</button>
            <strong class="annual-year-value">${year}</strong>
            <button class="btn btn-secondary annual-year-arrow" onclick="jumpAnnualYear(1)" aria-label="ปีถัดไป">${getIcon('arrowRight', 'icon-sm')}</button>
            ${year !== SCHEDULE_DATA_YEAR ? `<button class="btn btn-secondary annual-year-current" onclick="jumpAnnualYearTo(${SCHEDULE_DATA_YEAR})">กลับไปปี ${SCHEDULE_DATA_YEAR}</button>` : ''}
          </div>
        </div>
      </header>

      <section class="annual-section" aria-labelledby="annual-team-title">
        <div class="annual-section-heading">
          <div>
            <h2 id="annual-team-title">ลำดับกะของแต่ละทีม</h2>
            <p>การหมุนเวียน: กะที่เลือก 2 วัน → หยุด 2 วัน → อีกกะ 2 วัน → หยุด 2 วัน</p>
          </div>
          <span class="annual-scope-note">ไม่เปลี่ยนตารางจริงของ ส.ค. ${SCHEDULE_DATA_YEAR}</span>
        </div>
        <div class="annual-team-grid">${teamCards}</div>
      </section>

      <section class="card annual-holidays" aria-labelledby="annual-holiday-title">
        <div class="card-header">
          <div class="card-title">
            <h2 id="annual-holiday-title">วันหยุดนักขัตฤกษ์</h2>
            <p>ปี ${year} · ใช้ในคำขอสิทธิ์วันหยุดนักขัตฤกษ์</p>
          </div>
        </div>
        <div class="card-body">
          <div class="annual-holiday-list">${holidayPills}</div>
          <div class="annual-holiday-add">
            <input class="form-control" id="newHolidayInput" aria-label="ชื่อหรือวันที่วันหยุดใหม่" placeholder="เช่น 01 ม.ค. ${year + 543}" onkeyup="if(event.key==='Enter') addAnnualHoliday(${year})">
            <button class="btn btn-primary" onclick="addAnnualHoliday(${year})">${getIcon('plus', 'icon-sm')} เพิ่มวันหยุด</button>
          </div>
        </div>
      </section>

      <section class="annual-section" aria-labelledby="annual-overview-title">
        <div class="annual-section-heading annual-overview-heading">
          <div>
            <h2 id="annual-overview-title">ภาพรวมทั้งปี</h2>
            <p>จำนวนวันตามรูปแบบกะที่ตั้งไว้ · ดูอย่างเดียว</p>
          </div>
          <div class="annual-month-legend" aria-label="คำอธิบายตัวเลข">
            <span>${getIcon('sun', 'icon-xs')} กะเช้า</span>
            <span>${getIcon('moon', 'icon-xs')} กะดึก</span>
            <span>O วันหยุด</span>
          </div>
        </div>
        <div class="annual-month-grid">${monthCards}</div>
      </section>
    </div>
  `;
}

function jumpAnnualYear(delta) {
  state.annualScheduleYear += delta;
  renderApp();
}

function jumpAnnualYearTo(rawYear) {
  const y = parseInt(rawYear, 10);
  if (!y || y < 2000 || y > 2200) {
    showToast('กรุณาระบุปี ค.ศ. ที่ถูกต้อง', 'alert');
    return;
  }
  state.annualScheduleYear = y;
  renderApp();
}

function updateAnnualTeamFamily(year, team, value) {
  const cfg = getAnnualConfig(year);
  cfg.teamFamily[team] = value;
  showToast(`อัปเดตทิศทางกะของ ${team} ปี ${year} เรียบร้อยแล้ว`);
  renderApp();
}

function addAnnualHoliday(year) {
  const input = document.getElementById('newHolidayInput');
  const value = input?.value?.trim();
  if (!value) {
    showToast('กรุณาระบุชื่อ/วันที่วันหยุด', 'alert');
    return;
  }
  const cfg = getAnnualConfig(year);
  cfg.holidays.push(value);
  showToast('เพิ่มวันหยุดนักขัตฤกษ์เรียบร้อยแล้ว');
  renderApp();
}

function removeAnnualHoliday(year, index) {
  const cfg = getAnnualConfig(year);
  cfg.holidays.splice(index, 1);
  showToast('ลบวันหยุดนักขัตฤกษ์เรียบร้อยแล้ว');
  renderApp();
}

// ==========================================================================
// MANAGER SELF-SERVICE CONFIGURATION PANEL (ข้อ 8 SRS)
// ==========================================================================
function renderManagerSettingsView() {
  const cfg = state.managerConfig;
  const holidays = getHolidaysForYear(state.currentYear);

  return `
    <div class="manager-settings-page">
      <div class="manager-settings-primary">
        <section class="card" aria-labelledby="settings-shift-times-title">
          <div class="card-header">
            <div class="card-title">
              <h2 id="settings-shift-times-title">ช่วงเวลากะ</h2>
              <p>เวลาที่กำหนดให้แต่ละรหัสกะ</p>
            </div>
          </div>
          <div class="card-body">
            <div class="settings-time-grid">
              ${Object.keys(cfg.shiftTimes).map(code => `
                <div class="form-group">
                  <label for="manager-shift-time-${code}">${code} · ${state.shiftDefs[code]?.label || ''}</label>
                  <input class="form-control" id="manager-shift-time-${code}" value="${cfg.shiftTimes[code]}" onchange="updateManagerShiftTime('${code}', this.value)">
                </div>
              `).join('')}
            </div>
          </div>
        </section>

        <div class="manager-settings-side">
          <section class="card" aria-labelledby="settings-rules-title">
            <div class="card-header">
              <div class="card-title">
                <h2 id="settings-rules-title">กฎการทำงานและคำขอ</h2>
                <p>ใช้ตรวจสอบเงื่อนไขก่อนส่งคำขอ</p>
              </div>
            </div>
            <div class="card-body settings-rule-list">
              <div class="settings-rule-row">
                <div>
                  <label for="manager-max-work-days">วันทำงานติดต่อกันสูงสุด</label>
                  <p>นับรวมกะปกติ, OT และการสลับกะ</p>
                </div>
                <div class="settings-number-field">
                  <input class="form-control" id="manager-max-work-days" type="number" value="${cfg.maxConsecutiveWorkDays}" onchange="updateManagerRule('maxConsecutiveWorkDays', this.value)">
                  <span>วัน</span>
                </div>
              </div>
              <div class="settings-rule-row">
                <div>
                  <label for="manager-swap-limit">คำขอสลับ/เปลี่ยนกะต่อเดือน</label>
                  <p>จำนวนครั้งสูงสุดต่อพนักงาน</p>
                </div>
                <div class="settings-number-field">
                  <input class="form-control" id="manager-swap-limit" type="number" value="${cfg.swapRequestMonthlyLimit}" onchange="updateManagerRule('swapRequestMonthlyLimit', this.value)">
                  <span>ครั้ง</span>
                </div>
              </div>
            </div>
          </section>

          <section class="manager-settings-overview" aria-labelledby="settings-overview-title">
            <h2 id="settings-overview-title">ข้อมูลและทางลัด</h2>
            <div class="manager-overview-list">
              <div class="manager-overview-row">
                <div>
                  <strong>โครงสร้างตำแหน่งในแต่ละกะ (7 ตำแหน่งต่อกะ)</strong>
                  <p>หัวหน้ากะ (Shift Supervisor - S) ${cfg.standardHeadcount.supervisor} ตำแหน่ง (ดูแลภาพรวมกระบวนการผลิต) · พนักงานกะ (Shift Operator) ${cfg.standardHeadcount.operator} ตำแหน่ง (Boardman ดูแลระบบ DCS / Field Operator ดูแลเครื่องจักร สลับตำแหน่งกันได้เมื่อมีประสบการณ์) · รวม ${cfg.standardHeadcount.supervisor + cfg.standardHeadcount.operator} ตำแหน่งต่อกะ</p>
                </div>
              </div>
              <div class="manager-overview-row">
                <div>
                  <strong>วันหยุดนักขัตฤกษ์ · ปี ${state.currentYear}</strong>
                  <p>${holidays.length ? `ตั้งค่าไว้ ${holidays.length} วัน` : 'ยังไม่มีวันที่ตั้งค่าไว้'}</p>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="switchView('annual-schedule')">จัดการตารางรายปี ${getIcon('arrowRight', 'icon-sm')}</button>
              </div>
              <div class="manager-overview-row">
                <div>
                  <strong>พนักงานและทีม</strong>
                  <p>จัดการรายชื่อและทีมกะ</p>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="switchView('people')">เปิดหน้าจัดการ ${getIcon('arrowRight', 'icon-sm')}</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function updateManagerShiftTime(code, value) {
  state.managerConfig.shiftTimes[code] = value;
  showToast(`อัปเดตช่วงเวลากะ ${code} เรียบร้อยแล้ว`);
}

function updateManagerRule(key, rawValue) {
  const value = parseInt(rawValue, 10);
  if (Number.isNaN(value) || value <= 0) {
    showToast('กรุณาระบุตัวเลขที่มากกว่า 0', 'alert');
    renderApp();
    return;
  }
  state.managerConfig[key] = value;
  showToast('บันทึกค่าคอนฟิกเรียบร้อยแล้ว');
  renderApp();
}

// ==========================================================================
// MODALS & ACTIONS
// ==========================================================================

function openShiftEditor(empId, dayNum) {
  const emp = findEmployeeById(empId);
  if (!emp) return;

  // HR: ดึงข้อมูล (view/export) ได้เท่านั้น ห้ามแก้ไขตารางกะใดๆ ทั้งสิ้น
  if (state.activeRole === 'HR') {
    showToast('บทบาท HR สามารถดึงข้อมูลได้เท่านั้น ไม่สามารถแก้ไขตารางกะได้', 'alert');
    return;
  }

  if (isMonthLocked(state.currentYear, state.currentMonth)) {
    showToast('เดือนนี้ถูกล็อกข้อมูลแล้ว ไม่สามารถแก้ไขได้ (ข้อ 10 SRS)', 'alert');
    return;
  }

  const currentViewer = state.activeRole === 'Shift Employee'
    ? getAllEmployees().find(employee => employee.name === state.roles['Shift Employee'].name)
    : null;
  const isOperatorRequest = state.activeRole === 'Shift Employee';
  const isOwnRow = isOperatorRequest && currentViewer?.id === emp.id;

  // เพื่อนร่วมงาน → เปิด modal สลับกะโดยเฉพาะ (ตรวจสอบทั้งสองฝั่ง + โหมดลา+OT)
  // สลับกะได้เฉพาะคนที่มีสิทธิ์ตามเงื่อนไข (ต่างทีมเท่านั้น) — ถ้าไม่มีสิทธิ์แจ้งเตือนแทนการเปิดฟอร์ม
  if (isOperatorRequest && !isOwnRow) {
    if (!getEligibleSwapColleagues(currentViewer).some(e => e.id === emp.id)) {
      showToast('สลับกะได้เฉพาะกับพนักงานต่างทีมเท่านั้น', 'alert');
      return;
    }
    openColleagueSwapModal(currentViewer, emp, dayNum);
    return;
  }

  const currentShift = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, dayNum);
  const initialValidation = validateShiftAssignment(empId, dayNum, currentShift);
  const modalTitle = isOperatorRequest
    ? `ขอเปลี่ยนกะของฉัน · ${emp.name}`
    : `ปรับแก้กะพนักงาน · ${emp.name}`;
  const shiftLabel = isOperatorRequest ? 'กะที่ต้องการเปลี่ยน' : 'ประเภทกะที่มอบหมาย';
  const submitAction = isOperatorRequest
    ? `submitOperatorShiftRequest('${empId}', ${dayNum}, 'change')`
    : `saveShiftEdit('${empId}', ${dayNum})`;
  const submitLabel = isOperatorRequest ? 'ส่งคำขอเปลี่ยนกะ' : 'บันทึกการปรับกะ';

  // ข้อ 9 SRS: ดึงข้อมูลผู้ร้องขออัตโนมัติ (Auto-populate) — รหัส/แผนก/เบอร์โทร
  // เคสพนักงานขอเอง: ผู้ยื่นคือคนในกะคนเดียวกัน รวมเป็นบล็อกเดียวไม่ซ้ำ / เคสผู้จัดการปรับกะ: แสดงเป็น "พนักงานในกะ"
  const personLabel = isOperatorRequest ? 'ผู้ยื่นคำขอ' : 'พนักงานในกะ';
  const personMeta = isOperatorRequest
    ? `รหัส ${emp.code || '-'} · ${emp.shiftType || '-'} · โทร ${emp.phone || '-'}`
    : `${getEmployeeFacingRoleLabel(emp.roleCategory)} · ${emp.shiftType}`;
  const autoPopulateHtml = `
    <div class="form-group">
      <label>${personLabel}</label>
      <div class="form-readonly">
        <div class="form-readonly-name">${emp.name}</div>
        <div class="form-readonly-meta">${personMeta}</div>
      </div>
    </div>
  `;

  // เลือกตัวเลือกรหัสกะให้ครบตามข้อ 3 SRS
  const shiftOptionGroups = [
    { label: 'กะเช้า', codes: ['M', 'MT', 'MTh'] },
    { label: 'กะดึก', codes: ['N', 'NT', 'NTh'] },
    { label: 'อื่นๆ', codes: ['D', 'OT', 'O'] },
    { label: 'สลับ/ปรับกะ', codes: ['N/M', 'M/N', 'M/O', 'N/O', 'O/M', 'O/N'] },
    { label: 'ลา/หยุด', codes: ['V', 'B', 'S', 'H', 'VG', 'VGh'] }
  ];

  const bodyHtml = `
    <form id="shiftEditForm" onsubmit="event.preventDefault(); ${submitAction}">
      ${autoPopulateHtml}
      <div class="form-group">
        <label>วันที่</label>
        <div class="form-readonly">
          <div class="form-readonly-name">วันที่ ${dayNum} ${new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</div>
          <div class="form-readonly-meta">กะปัจจุบัน: ${getEmployeeFacingShiftLabel(currentShift)}</div>
        </div>
      </div>

      <div class="form-group">
        <label>${shiftLabel}</label>
        <select class="form-control" id="modalShiftSelect" onchange="runLiveShiftValidation('${empId}', ${dayNum}, this.value)">
          ${shiftOptionGroups.map(group => `
            <optgroup label="${group.label}">
              ${group.codes.map(code => `<option value="${code}" ${currentShift === code ? 'selected' : ''}>${code} · ${state.shiftDefs[code].label}</option>`).join('')}
            </optgroup>
          `).join('')}
        </select>
      </div>

      <div class="validation-panel" id="modalValidationPanel">
        ${renderValidationChecks(initialValidation.results)}
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="button" class="btn btn-primary" id="btnSaveShift" ${!initialValidation.valid ? 'disabled' : ''} onclick="${submitAction}">
      ${submitLabel}
    </button>
  `;

  openModal(modalTitle, bodyHtml, footerHtml);
}

// รายชื่อเพื่อนร่วมงานที่มีสิทธิ์สลับกะด้วยได้ (Eligible Swap Colleagues):
//  - หัวหน้ากะ (Shift Supervisor) สลับได้เฉพาะกับหัวหน้ากะด้วยกันเท่านั้น
//  - พนักงานทั่วไป ห้ามสลับกะกับเพื่อนร่วมงานใน "shift" (ทีม) เดียวกันของตนเอง ต้องเป็นคนละทีมเท่านั้น
function getEligibleSwapColleagues(aEmp) {
  const others = getAllEmployees().filter(e => e.id !== aEmp.id);
  if (aEmp.roleCategory === 'Shift Supervisor') {
    return others.filter(e => e.roleCategory === 'Shift Supervisor');
  }
  return others.filter(e => e.shiftType !== aEmp.shiftType);
}

// --------------------------------------------------------------------------
// Colleague Swap Modal — สองโหมด:
//  A) สลับกะกัน (Mutual Swap) — กำหนดตายตัว (A รับกะเดิมของ B, B รับกะเดิมของ A)
//     ต้องตรวจสอบทั้งสองฝั่ง (check both operator)
//  B) ฉันขอลา + ให้เพื่อนร่วมงานทำ OT แทน (Leave + OT Cover) — ตรวจสอบเฉพาะฝั่ง OT (check only B)
//
// ผู้ยื่นคำขอสามารถเปลี่ยนชื่อเพื่อนร่วมงานที่จะสลับด้วยได้ผ่าน dropdown แต่ตัวเลือกจะถูกจำกัด
// ตามกฎ: หัวหน้ากะสลับได้แค่กับหัวหน้ากะ / พนักงานทั่วไปห้ามสลับกับคนใน shift (ทีม) ตัวเอง
// --------------------------------------------------------------------------
function openColleagueSwapModal(aEmp, bEmp, dayNum) {
  if (!aEmp) return;

  const eligible = getEligibleSwapColleagues(aEmp);
  if (!eligible.length) {
    showToast('ไม่พบเพื่อนร่วมงานที่มีสิทธิ์สลับกะด้วยตามเงื่อนไข', 'alert');
    return;
  }

  // ไม่เลือกเพื่อนร่วมงานให้อัตโนมัติ — ผู้ใช้ต้องเลือกเองจากรายชื่อที่มีสิทธิ์
  // ถ้าส่ง bEmp มาแต่ไม่อยู่ในรายชื่อที่มีสิทธิ์ (เช่น คนในทีมเดียวกัน) ให้ถือว่ายังไม่ได้เลือก
  if (bEmp && !eligible.some(e => e.id === bEmp.id)) {
    bEmp = null;
  }

  const aOldCode = getShiftCodeForDate(aEmp, state.currentYear, state.currentMonth, dayNum);
  const bOldCode = bEmp ? getShiftCodeForDate(bEmp, state.currentYear, state.currentMonth, dayNum) : null;
  const monthLabel = new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const restrictionNote = aEmp.roleCategory === 'Shift Supervisor'
    ? 'สลับกะได้เฉพาะกับหัวหน้ากะจากทีมอื่นเท่านั้น'
    : 'สลับกะได้เฉพาะกับพนักงานจากทีมอื่นเท่านั้น';

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-intro">สลับกะกับเพื่อนร่วมงานจากทีมอื่นในวันเดียวกัน หรือขอลาแล้วให้เพื่อนร่วมงานมาทำงานล่วงเวลาแทน</div>
      <div class="form-group">
        <label>ผู้ยื่นคำขอ</label>
        <div class="form-readonly">
          <div class="form-readonly-name">${aEmp.name}</div>
          <div class="form-readonly-meta">รหัส ${aEmp.code} · ${aEmp.shiftType} · โทร ${aEmp.phone}</div>
        </div>
      </div>
      <div class="form-group">
        <label>เพื่อนร่วมงานที่จะสลับด้วย</label>
        <select class="form-control" id="colleagueSelect" onchange="changeColleagueSwapTarget('${aEmp.id}', this.value, ${dayNum})">
          <option value="" disabled ${bEmp ? '' : 'selected'}>— เลือกเพื่อนร่วมงานจากทีมอื่น —</option>
          ${eligible.map(e => `<option value="${e.id}" ${bEmp && e.id === bEmp.id ? 'selected' : ''}>${e.name} (${getEmployeeFacingRoleLabel(e.roleCategory)} · ${e.shiftType})</option>`).join('')}
        </select>
        <div class="form-hint">${restrictionNote}</div>
      </div>
      <div class="form-group">
        <label>วันที่สลับกะ</label>
        <div class="form-readonly">
          <div class="form-readonly-name">วันที่ ${dayNum} ${monthLabel}</div>
          <div class="form-readonly-meta">กะของคุณ: ${getEmployeeFacingShiftLabel(aOldCode)}${bEmp ? ` ↔ เพื่อนร่วมงาน: ${getEmployeeFacingShiftLabel(bOldCode)}` : ' · รอเลือกเพื่อนร่วมงาน'}</div>
        </div>
      </div>
      <div class="form-group">
        <label>ประเภทคำขอ</label>
        <select class="form-control" id="swapModeSelect" onchange="renderColleagueSwapValidation('${aEmp.id}', '${bEmp ? bEmp.id : ''}', ${dayNum})">
          <option value="mutual">สลับกะกัน — แลกกะของวันเดียวกัน</option>
          <option value="leaveOT">ขอลา + ให้เพื่อนร่วมงานทำงานล่วงเวลา (OT) แทน</option>
        </select>
      </div>
      <div id="swapModeExtra"></div>
      <div class="validation-panel" id="modalValidationPanel"></div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="button" class="btn btn-primary" id="btnSaveShift" onclick="submitColleagueSwapRequest('${aEmp.id}', document.getElementById('colleagueSelect').value, ${dayNum})">
      ส่งคำขอ
    </button>
  `;

  openModal(bEmp ? `ส่งคำขอสลับกะกับ ${bEmp.name}` : 'ส่งคำขอสลับกะกับเพื่อนร่วมงาน', bodyHtml, footerHtml);
  renderColleagueSwapValidation(aEmp.id, bEmp ? bEmp.id : '', dayNum);
}

// เมื่อผู้ยื่นคำขอเปลี่ยนชื่อเพื่อนร่วมงานจาก dropdown — เปิด modal ใหม่ด้วยคู่สลับที่เลือก
function changeColleagueSwapTarget(aId, newBId, dayNum) {
  const aEmp = findEmployeeById(aId);
  const bEmp = findEmployeeById(newBId);
  if (!aEmp || !bEmp) return;
  openColleagueSwapModal(aEmp, bEmp, dayNum);
}

function renderColleagueSwapValidation(aId, bId, day) {
  const mode = document.getElementById('swapModeSelect')?.value || 'mutual';
  const extraEl = document.getElementById('swapModeExtra');
  const panel = document.getElementById('modalValidationPanel');
  const btn = document.getElementById('btnSaveShift');
  const aEmp = findEmployeeById(aId);
  const bEmp = findEmployeeById(bId);
  if (!aEmp) return;
  if (!bEmp) {
    if (panel) panel.innerHTML = '<div class="validation-panel-title">เลือกเพื่อนร่วมงานจากรายชื่อด้านบนเพื่อให้ระบบตรวจสอบเงื่อนไข</div>';
    if (btn) btn.disabled = true;
    return;
  }

  if (mode === 'mutual') {
    if (extraEl) extraEl.innerHTML = '';
    // ตรวจสอบทั้งสองฝั่ง (check both operator)
    const swap = validateSwapBothSides(aId, bId, day);
    if (panel) {
      panel.innerHTML = `
        <div class="validation-panel-title">ผลตรวจสอบคำขอของคุณ (${aEmp.name}: ${getEmployeeFacingShiftLabel(swap.aOldCode)} → ${getEmployeeFacingShiftLabel(swap.aNewCode)})</div>
        ${swap.sideA.results.map(c => renderCheckItem(c)).join('')}
        <div class="validation-panel-title" style="margin-top:10px">ผลตรวจสอบคำขอของ ${bEmp.name} (${getEmployeeFacingShiftLabel(swap.bOldCode)} → ${getEmployeeFacingShiftLabel(swap.bNewCode)})</div>
        ${swap.sideB.results.map(c => renderCheckItem(c)).join('')}
      `;
    }
    if (btn) btn.disabled = !swap.valid;
  } else {
    // leaveOT mode: A ลา, B ทำ OT แทน — ตรวจสอบเฉพาะฝั่ง B (check only B)
    if (extraEl) {
      extraEl.innerHTML = `
        <div class="form-group">
          <label>ประเภทการลาของคุณ</label>
          <select class="form-control" id="leaveTypeSelect" onchange="renderColleagueSwapValidation('${aId}','${bId}',${day})">
            <option value="V">ลาพักร้อน (V)</option>
            <option value="B">ลากิจ (B)</option>
            <option value="S">ลาป่วย (S)</option>
            <option value="VG">ลาอื่นๆ (VG)</option>
          </select>
        </div>
        <div class="form-group">
          <label>รูปแบบ OT ที่ให้เพื่อนร่วมงานทำแทน</label>
          <select class="form-control" id="otCodeSelect" onchange="renderColleagueSwapValidation('${aId}','${bId}',${day})">
            <option value="MT">กะเช้าพร้อมทำงานล่วงเวลาเต็มกะ (MT)</option>
            <option value="NT">กะดึกพร้อมทำงานล่วงเวลาเต็มกะ (NT)</option>
            <option value="MTh">กะเช้าพร้อมทำงานล่วงเวลาครึ่งวัน (MTh)</option>
            <option value="NTh">กะดึกพร้อมทำงานล่วงเวลาครึ่งวัน (NTh)</option>
            <option value="OT">ทำงานล่วงเวลาเพิ่มเติม (OT)</option>
          </select>
        </div>
      `;
    }
    const otCode = document.getElementById('otCodeSelect')?.value || 'MT';
    const otCheck = validateOTRequest(bId, day, otCode);
    if (panel) {
      panel.innerHTML = `
        <div class="validation-panel-title">ตรวจสอบเงื่อนไขการทำงานล่วงเวลาของ ${bEmp.name} · ผู้ที่ลาไม่ต้องตรวจสอบกฎกะเพิ่มเติม</div>
        ${otCheck.results.map(c => renderCheckItem(c)).join('')}
      `;
    }
    if (btn) btn.disabled = !otCheck.valid;
  }
}

function submitColleagueSwapRequest(aId, bId, day) {
  const aEmp = findEmployeeById(aId);
  const bEmp = findEmployeeById(bId);
  if (!aEmp) return;
  if (!bEmp) {
    showToast('กรุณาเลือกเพื่อนร่วมงานจากทีมอื่นก่อนส่งคำขอ', 'alert');
    return;
  }

  const usedQuota = countMonthlySwapRequests(aId);
  const quotaLimit = state.managerConfig.swapRequestMonthlyLimit;
  if (usedQuota >= quotaLimit) {
    showToast(`ไม่สามารถส่งคำขอได้ — ใช้สิทธิ์ครบ ${quotaLimit} ครั้ง/เดือนแล้ว`, 'alert');
    return;
  }

  const mode = document.getElementById('swapModeSelect')?.value || 'mutual';
  const dateLabel = `${day} ${new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`;
  const isCrossShift = aEmp.shiftType !== bEmp.shiftType;
  const requestId = Date.now();

  if (mode === 'mutual') {
    const swap = validateSwapBothSides(aId, bId, day);
    if (!swap.valid) {
      showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบไม่ผ่านเงื่อนไข', 'alert');
      return;
    }
    state.requests.unshift({
      id: requestId,
      type: 'สลับกะ',
      person: aEmp.name,
      requesterId: aEmp.id,
      initials: aEmp.initials,
      roleCategory: aEmp.roleCategory,
      targetPerson: bEmp.name,
      targetRole: bEmp.roleCategory,
      date: dateLabel,
      currentShift: swap.aOldCode,
      targetShift: swap.aNewCode,
      reason: `สลับกะกับ ${bEmp.name} (${swap.aOldCode} ↔ ${swap.bOldCode})`,
      isCrossShift,
      approvers: buildApprovalChain(aEmp, bEmp).chain,
      status: 'รอดำเนินการ',
      submittedAt: 'เมื่อสักครู่',
      quotaUsed: `${usedQuota + 1} / ${quotaLimit} ครั้ง`
    });
    state.auditLogs.unshift({
      id: requestId,
      actor: aEmp.name,
      employeeId: aEmp.id,
      avatar: aEmp.initials,
      action: `ยื่นคำขอสลับกะวันที่ ${dateLabel} กับ ${bEmp.name} (${swap.aOldCode} ↔ ${swap.bOldCode})`,
      time: 'เมื่อสักครู่'
    });
    closeModal();
    showToast(`ส่งคำขอสลับกะเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา (ใช้สิทธิ์ ${usedQuota + 1}/${quotaLimit} ครั้งในเดือนนี้)`);
  } else {
    const leaveCode = document.getElementById('leaveTypeSelect')?.value || 'V';
    const otCode = document.getElementById('otCodeSelect')?.value || 'MT';
    const otCheck = validateOTRequest(bId, day, otCode);
    if (!otCheck.valid) {
      showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบฝั่ง OT ไม่ผ่านเงื่อนไข', 'alert');
      return;
    }
    state.requests.unshift({
      id: requestId,
      type: 'ลา + OT คุมกะแทน',
      person: aEmp.name,
      requesterId: aEmp.id,
      initials: aEmp.initials,
      roleCategory: aEmp.roleCategory,
      targetPerson: bEmp.name,
      targetRole: bEmp.roleCategory,
      date: dateLabel,
      currentShift: getShiftCodeForDate(aEmp, state.currentYear, state.currentMonth, day),
      targetShift: leaveCode,
      reason: `${aEmp.name} ขอลา (${leaveCode}) และให้ ${bEmp.name} ทำ OT (${otCode}) แทน${otCheck.requiresManagerSpecialReview ? ' — มีวันลาพักร้อนซ้อนทับ ต้องอนุมัติพิเศษจากผู้จัดการ' : ''}`,
      isCrossShift: false,
      approvers: [
        { role: `หัวหน้ากะตรวจสอบ (${bEmp.shiftType})`, status: 'pending' },
        { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }
      ],
      status: 'รอดำเนินการ',
      submittedAt: 'เมื่อสักครู่',
      quotaUsed: `${usedQuota + 1} / ${quotaLimit} ครั้ง`
    });
    state.auditLogs.unshift({
      id: requestId,
      actor: aEmp.name,
      employeeId: aEmp.id,
      avatar: aEmp.initials,
      action: `ยื่นคำขอลา (${leaveCode}) พร้อมให้ ${bEmp.name} ทำ OT (${otCode}) แทน วันที่ ${dateLabel}`,
      time: 'เมื่อสักครู่'
    });
    closeModal();
    showToast('ส่งคำขอลา + OT คุมกะแทนเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
  }

  state.activeView = 'my-requests';
  renderApp();
}

function renderCheckItem(c) {
  return `
    <div class="validation-check-item ${c.status}">
      ${c.status === 'pass' ? getIcon('check', 'icon-sm') : c.status === 'warn' ? getIcon('alert', 'icon-sm') : getIcon('x', 'icon-sm')}
      <span><strong>${c.rule}:</strong> ${c.msg}</span>
    </div>
  `;
}

function renderValidationChecks(checks) {
  return `
    <div class="validation-panel-title">ผลการตรวจสอบกฎความปลอดภัยและข้อกำหนด</div>
    ${checks.map(c => renderCheckItem(c)).join('')}
  `;
}

function runLiveShiftValidation(empId, dayNum, shiftCode) {
  const isOT = state.shiftDefs[shiftCode] && state.shiftDefs[shiftCode].ot;
  const validation = isOT ? validateOTRequest(empId, dayNum, shiftCode) : validateShiftAssignment(empId, dayNum, shiftCode);
  const panel = document.getElementById('modalValidationPanel');
  const btn = document.getElementById('btnSaveShift');

  if (panel) panel.innerHTML = renderValidationChecks(validation.results);
  if (btn) btn.disabled = !validation.valid;
}

function submitOperatorShiftRequest(targetEmpId, dayNum, requestMode) {
  const currentEmp = getAllEmployees().find(employee => employee.name === state.roles['Shift Employee'].name);
  const shiftCode = document.getElementById('modalShiftSelect')?.value;
  if (!currentEmp || !shiftCode) return;

  // บังคับสิทธิ์คำขอสลับ/เปลี่ยนกะ ไม่เกิน 2 ครั้ง/เดือน (ข้อ 6 SRS)
  const usedQuota = countMonthlySwapRequests(currentEmp.id);
  const quotaLimit = state.managerConfig.swapRequestMonthlyLimit;
  if (usedQuota >= quotaLimit) {
    showToast(`ไม่สามารถส่งคำขอได้ — ใช้สิทธิ์ครบ ${quotaLimit} ครั้ง/เดือนแล้ว`, 'alert');
    return;
  }

  const isOT = state.shiftDefs[shiftCode] && state.shiftDefs[shiftCode].ot;
  const requestType = isOT ? 'ขอทำ OT' : 'ขอเปลี่ยนกะ';
  const requestId = Date.now();
  const dateLabel = `${dayNum} ${new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}`;

  state.requests.unshift({
    id: requestId,
    type: requestType,
    person: currentEmp.name,
    requesterId: currentEmp.id,
    initials: currentEmp.initials,
    roleCategory: currentEmp.roleCategory,
    targetPerson: null,
    targetRole: null,
    date: dateLabel,
    currentShift: getShiftCodeForDate(currentEmp, state.currentYear, state.currentMonth, dayNum),
    targetShift: shiftCode,
    reason: isOT
      ? `ขอทำ OT (${shiftCode}) วันที่ ${dateLabel}`
      : `ขอเปลี่ยนกะของฉันเป็น ${shiftCode}`,
    isCrossShift: false,
    // OT ต้องผ่าน 2 ขั้นตอน: หัวหน้ากะตรวจสอบ → ผู้จัดการอนุมัติ
    approvers: isOT
      ? [
          { role: `หัวหน้ากะตรวจสอบ (${currentEmp.shiftType})`, status: 'pending' },
          { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }
        ]
      : [{ role: `Shift Supervisor (${currentEmp.shiftType})`, status: 'pending' }],
    status: 'รอดำเนินการ',
    submittedAt: 'เมื่อสักครู่',
    quotaUsed: `${usedQuota + 1} / ${quotaLimit} ครั้ง`
  });

  state.auditLogs.unshift({
    id: requestId,
    actor: currentEmp.name,
    employeeId: currentEmp.id,
    avatar: currentEmp.initials,
    action: `${requestType}วันที่ ${dateLabel}`,
    time: 'เมื่อสักครู่'
  });

  closeModal();
  showToast(`ส่ง${requestType}เรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา (ใช้สิทธิ์ ${usedQuota + 1}/${quotaLimit} ครั้งในเดือนนี้)`);
  state.activeView = 'my-requests';
  renderApp();
}

// ===== Leave Request (ขอลา) — ฟีเจอร์ Leave Request ใน Design Draft =====
function openLeaveRequestModal(empId, prefillDay) {
  const emp = findEmployeeById(empId);
  if (!emp) return;

  const todayDay = prefillDay || Math.min(state.currentDay, 28);
  // เพื่อนร่วมทีมที่สามารถเลือกมาทำงานแทนวันที่ลาได้ (คนที่จะเข้ามารับกะแทนควรอยู่ทีมเดียวกัน)
  const coverCandidates = getAllEmployees().filter(e => e.id !== emp.id && e.shiftType === emp.shiftType);

  const monthLabel = new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-intro">ขอลาในวันที่ต้องการ และเลือกผู้มาทำงานแทนได้ (ถ้ามี) — คำขอจะส่งให้หัวหน้ากะพิจารณา</div>
      <div class="form-group">
        <label>ผู้ยื่นคำขอ</label>
        <div class="form-readonly">
          <div class="form-readonly-name">${emp.name}</div>
          <div class="form-readonly-meta">รหัส ${emp.code} · ${emp.shiftType} · โทร ${emp.phone}</div>
        </div>
      </div>
      <div class="form-group">
        <label>ประเภทการลา</label>
        <select class="form-control" id="leaveReqTypeSelect">
          <option value="V">ลาพักร้อน (V)</option>
          <option value="B">ลากิจ (B)</option>
          <option value="S">ลาป่วย (S)</option>
          <option value="H">ลาวันหยุดนักขัตฤกษ์ (H)</option>
        </select>
      </div>
      <div class="form-group">
        <label>วันที่ต้องการลา</label>
        <input class="form-control" type="number" id="leaveReqDay" min="1" max="31" value="${todayDay}" onchange="renderLeaveCoverValidation('${empId}')" />
        <div class="form-hint">ระบุเลขวันของ${monthLabel}</div>
      </div>
      <div class="form-group">
        <label>ผู้มาทำงานแทน (ไม่บังคับ)</label>
        <select class="form-control" id="leaveCoverSelect" onchange="renderLeaveCoverValidation('${empId}')">
          <option value="">ไม่ระบุ — ให้หัวหน้ากะจัดคนแทนภายหลัง</option>
          ${coverCandidates.map(c => `<option value="${c.id}">${c.name} (${getEmployeeFacingRoleLabel(c.roleCategory)} · ${c.shiftType})</option>`).join('')}
        </select>
        <div class="form-hint">ถ้าเลือก ระบบจะส่งคำขอทำงานล่วงเวลาให้พนักงานคนนี้มาทำแทนในวันที่คุณลา</div>
      </div>
      <div id="leaveCoverExtra"></div>
      <div class="form-group">
        <label>เหตุผล / รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
        <textarea class="form-control" id="leaveReqReason" rows="2" placeholder="ระบุเหตุผลการลา"></textarea>
      </div>
      <label class="form-check">
        <input type="checkbox" id="leaveReqRetroactive" />
        ยื่นคำขอย้อนหลัง (สำหรับวันที่ผ่านมาแล้ว)
      </label>
      <div class="validation-panel" id="leaveValidationPanel"></div>
    </div>
  `;
  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" id="btnSubmitLeave" onclick="submitLeaveRequest('${empId}')">ส่งคำขอลา</button>
  `;
  openModal('ส่งคำขอลา', bodyHtml, footerHtml);
  renderLeaveCoverValidation(empId);
}

// เมื่อเลือกเพื่อนร่วมงานมาทำแทน — ให้แสดงตัวเลือกรหัส OT และตรวจสอบกฎให้ทันที (เหมือนโหมด Leave + OT Cover)
function renderLeaveCoverValidation(empId) {
  const coverId = document.getElementById('leaveCoverSelect')?.value || '';
  const day = parseInt(document.getElementById('leaveReqDay')?.value, 10) || state.currentDay;
  const extraEl = document.getElementById('leaveCoverExtra');
  const panel = document.getElementById('leaveValidationPanel');
  const btn = document.getElementById('btnSubmitLeave');

  if (!coverId) {
    if (extraEl) extraEl.innerHTML = '';
    if (panel) panel.innerHTML = '';
    if (btn) btn.disabled = false;
    return;
  }

  const coverEmp = findEmployeeById(coverId);
  if (!coverEmp) return;

  if (extraEl) {
    extraEl.innerHTML = `
      <div class="form-group">
        <label>รูปแบบ OT ที่ให้ ${coverEmp.name} ทำแทน</label>
        <select class="form-control" id="leaveCoverOtCode" onchange="renderLeaveCoverValidation('${empId}')">
          <option value="MT">กะเช้าพร้อมทำงานล่วงเวลาเต็มกะ (MT)</option>
          <option value="NT">กะดึกพร้อมทำงานล่วงเวลาเต็มกะ (NT)</option>
          <option value="MTh">กะเช้าพร้อมทำงานล่วงเวลาครึ่งวัน (MTh)</option>
          <option value="NTh">กะดึกพร้อมทำงานล่วงเวลาครึ่งวัน (NTh)</option>
          <option value="OT">ทำงานล่วงเวลาเพิ่มเติม (OT)</option>
        </select>
      </div>
    `;
  }
  const otCode = document.getElementById('leaveCoverOtCode')?.value || 'MT';
  const otCheck = validateOTRequest(coverId, day, otCode);
  if (panel) {
    panel.innerHTML = `
      <div class="validation-panel-title">ตรวจสอบเงื่อนไขการทำงานล่วงเวลาของ ${coverEmp.name}</div>
      ${otCheck.results.map(c => renderCheckItem(c)).join('')}
    `;
  }
  if (btn) btn.disabled = !otCheck.valid;
}

function submitLeaveRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const leaveCode = document.getElementById('leaveReqTypeSelect')?.value || 'V';
  const day = parseInt(document.getElementById('leaveReqDay')?.value, 10) || state.currentDay;
  const reason = document.getElementById('leaveReqReason')?.value || '';
  const isRetroactive = document.getElementById('leaveReqRetroactive')?.checked || false;
  const coverId = document.getElementById('leaveCoverSelect')?.value || '';
  const coverEmp = coverId ? findEmployeeById(coverId) : null;
  const coverOtCode = document.getElementById('leaveCoverOtCode')?.value || 'MT';
  const dateLabel = `${day} ${new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`;
  const requestId = Date.now();

  if (coverEmp) {
    const otCheck = validateOTRequest(coverId, day, coverOtCode);
    if (!otCheck.valid) {
      showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบฝั่งผู้มาทำแทนไม่ผ่านเงื่อนไข', 'alert');
      return;
    }
  }

  const coverNote = coverEmp ? ` — มอบหมายให้ ${coverEmp.name} มาทำแทน (OT ${coverOtCode})` : '';

  state.requests.unshift({
    id: requestId,
    type: `ขอลา (${leaveCode})${isRetroactive ? ' — ย้อนหลัง' : ''}`,
    person: emp.name,
    requesterId: emp.id,
    initials: emp.initials,
    roleCategory: emp.roleCategory,
    targetPerson: coverEmp ? coverEmp.name : null,
    targetRole: coverEmp ? coverEmp.roleCategory : null,
    date: dateLabel,
    currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day) || '-',
    targetShift: leaveCode,
    reason: (reason || `ขอลา (${leaveCode}) วันที่ ${dateLabel}`) + coverNote,
    isCrossShift: false,
    isRetroactive,
    approvers: coverEmp
      ? [
          { role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' },
          { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }
        ]
      : [
          { role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }
        ],
    status: 'รอดำเนินการ',
    submittedAt: 'เมื่อสักครู่',
    quotaUsed: '-'
  });

  state.auditLogs.unshift({
    id: requestId,
    actor: emp.name,
    employeeId: emp.id,
    avatar: emp.initials,
    action: `ยื่นคำขอลา (${leaveCode}) วันที่ ${dateLabel}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}${coverEmp ? ` พร้อมมอบหมายให้ ${coverEmp.name} ทำ OT (${coverOtCode}) แทน` : ''}`,
    time: 'เมื่อสักครู่'
  });

  closeModal();
  showToast('ส่งคำขอลาเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
  state.activeView = 'my-requests';
  renderApp();
}

// ===== Day-Off Change Request (ขอเปลี่ยนวันหยุด) — Project Proposal 6.3 =====
function openDayOffChangeModal(empId, prefillDay) {
  const emp = findEmployeeById(empId);
  if (!emp) return;

  const daysInCurrentMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const offDays = Array.from({ length: daysInCurrentMonth }, (_, idx) => ({
    code: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, idx + 1),
    day: idx + 1
  }))
    .filter(d => d.code === 'O')
    .slice(0, 10);

  const monthLabel = new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const weekdayShort = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const offDayLabel = d => `วันที่ ${d.day} (${weekdayShort[new Date(state.currentYear, state.currentMonth, d.day).getDay()]})`;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-intro">ย้ายวันหยุดของคุณจากวันเดิมไปวันใหม่ — วันใหม่ต้องอยู่ในกรอบ ±7 วันจากวันหยุดเดิม</div>
      <div class="form-group">
        <label>ผู้ยื่นคำขอ</label>
        <div class="form-readonly">
          <div class="form-readonly-name">${emp.name}</div>
          <div class="form-readonly-meta">รหัส ${emp.code} · ${emp.shiftType} · โทร ${emp.phone}</div>
        </div>
      </div>
      <div class="form-group">
        <label>วันหยุดเดิมที่ต้องการเปลี่ยน</label>
        <select class="form-control" id="dayOffOldSelect">
          ${offDays.length ? offDays.map(d => `<option value="${d.day}" ${d.day === prefillDay ? 'selected' : ''}>${offDayLabel(d)}</option>`).join('') : '<option value="">ไม่พบวันหยุดในตาราง</option>'}
        </select>
        <div class="form-hint">แสดงเฉพาะวันที่ตารางกำหนดเป็นวันหยุด (O) ของ${monthLabel}</div>
      </div>
      <div class="form-group">
        <label>วันหยุดใหม่</label>
        <input class="form-control" type="number" id="dayOffNewDay" min="1" max="31" placeholder="ระบุเลขวัน เช่น 15" />
        <div class="form-hint">ระบุเลขวันของ${monthLabel} ไม่เกิน 7 วันก่อนหรือหลังวันหยุดเดิม</div>
      </div>
      <div class="form-group">
        <label>เหตุผล / รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
        <textarea class="form-control" id="dayOffReason" rows="2" placeholder="ระบุเหตุผลการเปลี่ยนวันหยุด"></textarea>
      </div>
      <label class="form-check">
        <input type="checkbox" id="dayOffRetroactive" />
        ยื่นคำขอย้อนหลัง (สำหรับวันที่ผ่านมาแล้ว)
      </label>
    </div>
  `;
  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitDayOffChangeRequest('${empId}')">ส่งคำขอ</button>
  `;
  openModal('ส่งคำขอเปลี่ยนวันหยุด', bodyHtml, footerHtml);
}

function submitDayOffChangeRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const oldDay = parseInt(document.getElementById('dayOffOldSelect')?.value, 10);
  const newDay = parseInt(document.getElementById('dayOffNewDay')?.value, 10);
  const reason = document.getElementById('dayOffReason')?.value || '';
  const isRetroactive = document.getElementById('dayOffRetroactive')?.checked || false;

  if (!oldDay || !newDay) {
    showToast('กรุณาระบุวันหยุดเดิมและวันหยุดใหม่ให้ครบถ้วน', 'alert');
    return;
  }
  if (Math.abs(newDay - oldDay) > 7) {
    showToast('ไม่สามารถส่งคำขอได้ — วันหยุดใหม่ต้องอยู่ในกรอบ ±7 วันจากวันหยุดเดิม', 'alert');
    return;
  }

  const dateLabel = `${oldDay} → ${newDay} ${new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`;
  const requestId = Date.now();

  state.requests.unshift({
    id: requestId,
    type: `เปลี่ยนวันหยุด${isRetroactive ? ' — ย้อนหลัง' : ''}`,
    person: emp.name,
    requesterId: emp.id,
    initials: emp.initials,
    roleCategory: emp.roleCategory,
    targetPerson: null,
    targetRole: null,
    date: dateLabel,
    currentShift: 'O',
    targetShift: 'O',
    reason: reason || `ขอเปลี่ยนวันหยุดจากวันที่ ${oldDay} เป็นวันที่ ${newDay}`,
    isCrossShift: false,
    isRetroactive,
    approvers: [
      { role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }
    ],
    status: 'รอดำเนินการ',
    submittedAt: 'เมื่อสักครู่',
    quotaUsed: '-'
  });

  state.auditLogs.unshift({
    id: requestId,
    actor: emp.name,
    employeeId: emp.id,
    avatar: emp.initials,
    action: `ยื่นคำขอเปลี่ยนวันหยุดจากวันที่ ${oldDay} เป็นวันที่ ${newDay}${isRetroactive ? ' (ยื่นย้อนหลัง)' : ''}`,
    time: 'เมื่อสักครู่'
  });

  closeModal();
  showToast('ส่งคำขอเปลี่ยนวันหยุดเรียบร้อยแล้ว · รอหัวหน้ากะพิจารณา');
  state.activeView = 'my-requests';
  renderApp();
}

// ===== OT Request Form — ฟอร์มขอทำงานล่วงเวลาโดยเฉพาะ (SRS §9) =====
function openOTRequestModal(empId, prefillDay) {
  const emp = findEmployeeById(empId);
  if (!emp) return;

  const todayDay = prefillDay || Math.min(state.currentDay, 28);
  const monthLabel = new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-intro">ขอทำงานล่วงเวลาเพิ่มจากกะปกติ — คำขอ OT ต้องผ่านการอนุมัติจากหัวหน้ากะและผู้จัดการ</div>
      <div class="form-group">
        <label>ผู้ยื่นคำขอ</label>
        <div class="form-readonly">
          <div class="form-readonly-name">${emp.name}</div>
          <div class="form-readonly-meta">รหัส ${emp.code} · ${emp.shiftType} · โทร ${emp.phone}</div>
        </div>
      </div>
      <div class="form-group">
        <label>วันที่ต้องการทำงานล่วงเวลา</label>
        <input class="form-control" type="number" id="otReqDay" min="1" max="31" value="${todayDay}" onchange="renderOTRequestValidation('${empId}')" />
        <div class="form-hint">ระบุเลขวันของ${monthLabel}</div>
      </div>
      <div class="form-group">
        <label>รูปแบบการทำงานล่วงเวลา</label>
        <select class="form-control" id="otReqCode" onchange="renderOTRequestValidation('${empId}')">
          <option value="MT">กะเช้าพร้อมทำงานล่วงเวลาเต็มกะ (MT)</option>
          <option value="NT">กะดึกพร้อมทำงานล่วงเวลาเต็มกะ (NT)</option>
          <option value="MTh">กะเช้าพร้อมทำงานล่วงเวลาครึ่งวัน (MTh)</option>
          <option value="NTh">กะดึกพร้อมทำงานล่วงเวลาครึ่งวัน (NTh)</option>
          <option value="OT">ทำงานล่วงเวลาเพิ่มเติม (OT)</option>
        </select>
      </div>
      <div class="form-group">
        <label>เหตุผล / รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
        <textarea class="form-control" id="otReqReason" rows="2" placeholder="ระบุเหตุผลการขอทำงานล่วงเวลา"></textarea>
      </div>
      <div class="validation-panel" id="otValidationPanel"></div>
    </div>
  `;
  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" id="btnSubmitOT" onclick="submitOTRequest('${empId}')">ส่งคำขอ OT</button>
  `;
  openModal('ส่งคำขอทำงานล่วงเวลา (OT)', bodyHtml, footerHtml);
  renderOTRequestValidation(empId);
}

function renderOTRequestValidation(empId) {
  const day = parseInt(document.getElementById('otReqDay')?.value, 10);
  const otCode = document.getElementById('otReqCode')?.value || 'MT';
  const panel = document.getElementById('otValidationPanel');
  const btn = document.getElementById('btnSubmitOT');
  if (!day || day < 1 || day > 31) {
    if (panel) panel.innerHTML = '<div class="validation-panel-title">กรุณาระบุวันที่ให้ถูกต้อง</div>';
    if (btn) btn.disabled = true;
    return;
  }
  const check = validateOTRequest(empId, day, otCode);
  if (panel) panel.innerHTML = check.results.map(c => renderCheckItem(c)).join('')
    + (check.requiresManagerSpecialReview ? '<div class="validation-panel-title" style="margin-top:8px">เคสนี้ต้องได้รับอนุมัติพิเศษจากผู้จัดการ</div>' : '');
  if (btn) btn.disabled = !check.valid;
}

function submitOTRequest(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const day = parseInt(document.getElementById('otReqDay')?.value, 10);
  const otCode = document.getElementById('otReqCode')?.value || 'MT';
  const reason = document.getElementById('otReqReason')?.value || '';
  if (!day) {
    showToast('กรุณาระบุวันที่ต้องการทำงานล่วงเวลา', 'alert');
    return;
  }

  const check = validateOTRequest(empId, day, otCode);
  if (!check.valid) {
    showToast('ไม่สามารถส่งคำขอได้ — ผลตรวจสอบไม่ผ่านเงื่อนไข', 'alert');
    return;
  }

  const dateLabel = `${day} ${new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`;
  const requestId = Date.now();
  state.requests.unshift({
    id: requestId,
    type: 'ขอทำ OT',
    person: emp.name,
    requesterId: emp.id,
    initials: emp.initials,
    roleCategory: emp.roleCategory,
    targetPerson: null,
    targetRole: null,
    date: dateLabel,
    currentShift: getShiftCodeForDate(emp, state.currentYear, state.currentMonth, day),
    targetShift: otCode,
    reason: (reason || `ขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}`) + (check.requiresManagerSpecialReview ? ' — มีวันลาพักร้อนซ้อนทับ ต้องอนุมัติพิเศษจากผู้จัดการ' : ''),
    isCrossShift: false,
    approvers: [
      { role: `หัวหน้ากะตรวจสอบ (${emp.shiftType})`, status: 'pending' },
      { role: 'ผู้จัดการอนุมัติ OT', status: 'pending' }
    ],
    status: 'รอดำเนินการ',
    submittedAt: 'เมื่อสักครู่',
    quotaUsed: '-'
  });
  state.auditLogs.unshift({
    id: requestId,
    actor: emp.name,
    employeeId: emp.id,
    avatar: emp.initials,
    action: `ยื่นคำขอทำงานล่วงเวลา (${otCode}) วันที่ ${dateLabel}`,
    time: 'เมื่อสักครู่'
  });
  closeModal();
  showToast('ส่งคำขอทำงานล่วงเวลาเรียบร้อยแล้ว · รอหัวหน้ากะและผู้จัดการพิจารณา');
  state.activeView = 'my-requests';
  renderApp();
}

// ===== Public Holiday Entitlement — เลือกหยุดหรือทำงานเป็น OT ในวันนักขัตฤกษ์ =====
function openPublicHolidayModal(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const holidays = getHolidaysForYear(state.currentYear);
  if (!holidays.length) {
    showToast(`ยังไม่มีการตั้งค่าวันหยุดนักขัตฤกษ์สำหรับปี ${state.currentYear} — กรุณาติดต่อผู้จัดการฝ่ายผลิตให้ตั้งค่าในหน้า "ตารางรายปี"`, 'alert');
    return;
  }

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-intro">เลือกวันหยุดนักขัตฤกษ์ที่ต้องการใช้สิทธิ์หยุด (H) ตามประกาศบริษัท — คำขอจะส่งให้หัวหน้ากะพิจารณา</div>
      <div class="form-group">
        <label>ผู้ยื่นคำขอ</label>
        <div class="form-readonly">
          <div class="form-readonly-name">${emp.name}</div>
          <div class="form-readonly-meta">รหัส ${emp.code} · ${emp.shiftType} · โทร ${emp.phone}</div>
        </div>
      </div>
      <div class="form-group">
        <label>วันหยุดนักขัตฤกษ์</label>
        <select class="form-control" id="publicHolidaySelect">
          ${holidays.map(h => `<option value="${h}">${h}</option>`).join('')}
        </select>
        <div class="form-hint">แสดงเฉพาะวันหยุดนักขัตฤกษ์ที่ผู้จัดการตั้งค่าไว้สำหรับปีนี้</div>
      </div>
      <div class="form-group">
        <label>สิทธิ์ที่ขอใช้</label>
        <div class="form-control" style="background:var(--bg-subtle);font-weight:600;color:var(--ink)">
          หยุดตามสิทธิ์วันหยุดนักขัตฤกษ์ (H)
        </div>
      </div>
    </div>
  `;
  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitPublicHolidayChoice('${empId}')">ยืนยันใช้สิทธิ์หยุด</button>
  `;
  openModal('เลือกใช้สิทธิ์วันหยุดนักขัตฤกษ์', bodyHtml, footerHtml);
}

function submitPublicHolidayChoice(empId) {
  const emp = findEmployeeById(empId);
  if (!emp) return;
  const holiday = document.getElementById('publicHolidaySelect')?.value;
  const requestId = Date.now();

  state.requests.unshift({
    id: requestId,
    type: 'สิทธิ์วันหยุดนักขัตฤกษ์',
    person: emp.name,
    requesterId: emp.id,
    initials: emp.initials,
    roleCategory: emp.roleCategory,
    targetPerson: null,
    targetRole: null,
    date: holiday,
    currentShift: '-',
    targetShift: 'H',
    reason: `ขอใช้สิทธิ์หยุดตามประกาศวันหยุดนักขัตฤกษ์ (${holiday})`,
    isCrossShift: false,
    approvers: [{ role: `Shift Supervisor (${emp.shiftType})`, status: 'pending' }],
    status: 'รอดำเนินการ',
    submittedAt: 'เมื่อสักครู่',
    quotaUsed: '-'
  });

  state.auditLogs.unshift({
    id: requestId,
    actor: emp.name,
    employeeId: emp.id,
    avatar: emp.initials,
    action: `ยื่นขอใช้สิทธิ์วันหยุดนักขัตฤกษ์ (${holiday})`,
    time: 'เมื่อสักครู่'
  });

  closeModal();
  showToast('ส่งคำขอใช้สิทธิ์วันหยุดนักขัตฤกษ์เรียบร้อยแล้ว');
  state.activeView = 'my-requests';
  renderApp();
}

function saveShiftEdit(empId, dayNum) {
  if (isMonthLocked(state.currentYear, state.currentMonth)) {
    showToast('เดือนนี้ถูกล็อกข้อมูลแล้ว ไม่สามารถแก้ไขได้', 'alert');
    closeModal();
    return;
  }
  const shiftCode = document.getElementById('modalShiftSelect').value;
  const emp = findEmployeeById(empId);
  if (emp) {
    const oldShift = getShiftCodeForDate(emp, state.currentYear, state.currentMonth, dayNum);

    if (hasScheduleDataForMonth(state.currentYear, state.currentMonth)) {
      // เดือนสิงหาคม 2569 = ข้อมูลจริง เขียนทับ shifts[] ของพนักงานโดยตรง
      emp.shifts[dayNum - 1] = shiftCode;
    } else {
      // เดือนอื่นๆ ยังไม่มีข้อมูลจริง — บันทึกการแก้ไข/ทดสอบแยกไว้ ไม่ยุ่งกับข้อมูลจริงของเดือนสิงหาคม
      setShiftOverride(empId, state.currentYear, state.currentMonth, dayNum, shiftCode);
    }

    state.auditLogs.unshift({
      id: Date.now(),
      actor: state.roles[state.activeRole].name,
      avatar: state.roles[state.activeRole].initials,
      action: `เปลี่ยนกะของ ${emp.name} วันที่ ${dayNum} จาก ${oldShift} เป็น ${shiftCode}`,
      time: 'เมื่อสักครู่'
    });

    closeModal();
    showToast(`อัปเดตตารางกะของ ${emp.name} เรียบร้อยแล้ว`);
    renderApp();
  }
}

// 3-Step Swap Modal for Operator
// หมายเหตุ: เดิมมี openOperatorRequestModal/submitSwapRequest เป็น flow เก่าที่แยกต่างหาก
// (ไม่ได้บังคับกฎ "ห้ามสลับในทีมตัวเอง / หัวหน้ากะสลับได้เฉพาะหัวหน้ากะ")
// รวม flow นี้เข้ากับ openColleagueSwapModal() ทั้งหมดแล้ว เพื่อให้มีจุดยื่นคำขอสลับกะจุดเดียว
// ที่บังคับใช้กฎสิทธิ์การสลับกะอย่างถูกต้องเสมอ ฟังก์ชันนี้คงไว้เผื่อโค้ดอื่นเรียกใช้ชื่อเดิม
function openOperatorRequestModal(dateStr, currentShift, dayNum) {
  const currentEmp = getAllEmployees().find(employee => employee.name === state.roles['Shift Employee'].name);
  if (!currentEmp) return;
  const day = dayNum || state.currentDay;
  openColleagueSwapModal(currentEmp, null, day);
}

// ผู้ยื่นถอนคำขอได้เองตราบใดที่ยังไม่มีผู้ตรวจสอบคนใดลงมือ (ทุกขั้นยัง pending)
// เมื่อมีการอนุมัติ/ปฏิเสธขั้นใดขั้นหนึ่งแล้ว ถือว่าคำขอเข้าสู่การ review ถอนไม่ได้อีก
function canWithdrawRequest(req) {
  if (!req || !req.status || !req.status.includes('รอ')) return false;
  return (req.approvers || []).every(a => a.status === 'pending');
}

function withdrawRequest(reqId) {
  const req = state.requests.find(r => r.id === reqId);
  if (!req || !canWithdrawRequest(req)) {
    showToast('ไม่สามารถยกเลิกคำขอนี้ได้ — คำขอผ่านการตรวจสอบแล้ว', 'alert');
    return;
  }
  req.status = 'ยกเลิกแล้ว';
  state.auditLogs.unshift({
    id: Date.now(),
    actor: state.roles[state.activeRole]?.name || state.activeRole,
    avatar: state.roles[state.activeRole]?.initials || '--',
    action: `ถอนคำขอ ${req.type} ของ ${req.person} (วันที่ ${req.date}) — ถอนก่อนการตรวจสอบ`,
    time: 'เมื่อสักครู่'
  });
  closeModal();
  showToast('ยกเลิกคำขอเรียบร้อยแล้ว');
  renderApp();
}

function approveRequest(reqId) {
  const req = state.requests.find(r => r.id === reqId);
  if (!req) return;

  if (req.approvers && req.approvers.length > 1) {
    // คำขอที่ต้องผ่านหลายขั้น (เช่น สลับข้ามทีม หรือ OT: หัวหน้ากะตรวจสอบ → ผู้จัดการอนุมัติ)
    const nextStep = req.approvers.find(a => a.status !== 'approved');
    if (nextStep) {
      nextStep.status = 'approved';
      nextStep.at = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }
    const allApproved = req.approvers.every(a => a.status === 'approved');
    if (allApproved) {
      req.status = 'อนุมัติแล้ว';
      state.auditLogs.unshift({
        id: Date.now(),
        actor: state.roles[state.activeRole].name,
        avatar: state.roles[state.activeRole].initials,
        action: `อนุมัติคำขอ ${req.type} ของ ${req.person} ครบทุกขั้นตอนแล้ว (วันที่ ${req.date})`,
        time: 'เมื่อสักครู่'
      });
      showToast(`อนุมัติคำขอของ ${req.person} ครบทุกขั้นตอนแล้ว`);
    } else {
      req.status = `รออนุมัติขั้นถัดไป (${nextStep ? req.approvers[req.approvers.indexOf(nextStep) + 1]?.role || '' : ''})`.trim();
      state.auditLogs.unshift({
        id: Date.now(),
        actor: state.roles[state.activeRole].name,
        avatar: state.roles[state.activeRole].initials,
        action: `ผ่านขั้นตอน "${nextStep ? req.approvers[req.approvers.indexOf(nextStep)].role : ''}" ของคำขอ ${req.type} ของ ${req.person} — รอขั้นถัดไป`,
        time: 'เมื่อสักครู่'
      });
      showToast(`ผ่านขั้นตอนนี้แล้ว — รออนุมัติขั้นถัดไป`);
    }
  } else {
    req.status = 'อนุมัติแล้ว';
    state.auditLogs.unshift({
      id: Date.now(),
      actor: state.roles[state.activeRole].name,
      avatar: state.roles[state.activeRole].initials,
      action: `อนุมัติคำขอ ${req.type} ของ ${req.person} (วันที่ ${req.date})`,
      time: 'เมื่อสักครู่'
    });
    showToast(`อนุมัติคำขอของ ${req.person} เรียบร้อยแล้ว`);
  }

  renderApp();
}

function promptRejectRequest(reqId) {
  const req = state.requests.find(r => r.id === reqId);
  if (!req) return;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <p style="font-size:12px;color:var(--ink-secondary)">
        คุณกำลังจะปฏิเสธคำขอ <strong>${req.type}</strong> ของ <strong>${req.person}</strong> (${req.date})
      </p>
      <div class="form-group">
        <label>ระบุเหตุผลในการไม่อนุมัติ (จำเป็นตามระเบียบ US-033)</label>
        <textarea class="form-control" id="rejectReasonInput" rows="3" placeholder="เช่น อัตรากำลังพลในกะไม่เพียงพอ ฯลฯ"></textarea>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="button" class="btn btn-danger" onclick="confirmRejectRequest(${reqId})">
      ยืนยันปฏิเสธคำขอ
    </button>
  `;

  openModal('ปฏิเสธคำขอพร้อมระบุเหตุผล', bodyHtml, footerHtml);
}

function confirmRejectRequest(reqId) {
  const reason = document.getElementById('rejectReasonInput').value;
  if (!reason.trim()) {
    alert('กรุณาระบุเหตุผลในการไม่อนุมัติ');
    return;
  }

  const req = state.requests.find(r => r.id === reqId);
  if (req) {
    req.status = 'ไม่อนุมัติ';
    req.rejectReason = reason;

    state.auditLogs.unshift({
      id: Date.now(),
      actor: state.roles[state.activeRole].name,
      avatar: state.roles[state.activeRole].initials,
      action: `ไม่อนุมัติคำขอ ${req.type} ของ ${req.person} (เหตุผล: ${reason})`,
      time: 'เมื่อสักครู่'
    });

    closeModal();
    showToast(`บันทึกการไม่อนุมัติคำขอเรียบร้อยแล้ว`, 'alert');
    renderApp();
  }
}

function acknowledgeDriverSchedule() {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;
  state.driverAcknowledged = true;
  state.driverAckTime = `วันนี้ ${timeStr}`;

  state.auditLogs.unshift({
    id: Date.now(),
    actor: 'Somchai Prasert (Driver)',
    avatar: 'SP',
    action: `คนขับรถตู้สาย A รับทราบและยืนยันตารางรับส่งประจำวัน`,
    time: 'เมื่อสักครู่'
  });

  showToast('รับทราบและยืนยันตารางงานเรียบร้อยแล้ว');
  renderApp();
}

function filterScheduleWeek(weekVal) {
  state.selectedWeek = weekVal;
  renderApp();
}

function changeScheduleMonth(monthDelta) {
  const nextMonth = new Date(state.currentYear, state.currentMonth + monthDelta, 1);
  state.currentYear = nextMonth.getFullYear();
  state.currentMonth = nextMonth.getMonth();
  renderApp();
}

// สลับระหว่างหน้า "กะของฉัน" แบบง่าย กับตารางกะเต็มรูปแบบทุกทีม (สำหรับพนักงานปฏิบัติ)
function toggleOperatorFullGrid(show) {
  state.operatorShowFullGrid = !!show;
  renderApp();
}

// เปิด/ปิดหน้าต่างเลือกเดือน-ปีโดยตรง แทนการต้องกดลูกศรเลื่อนทีละเดือน
function toggleMonthPicker(force) {
  state.monthPickerOpen = typeof force === 'boolean' ? force : !state.monthPickerOpen;
  renderApp();
}

// กระโดดไปยังเดือน-ปีที่เลือกได้ทันที
function jumpToScheduleMonth(year, month) {
  state.currentYear = parseInt(year, 10);
  state.currentMonth = parseInt(month, 10);
  state.monthPickerOpen = false;
  renderApp();
}

function jumpToScheduleDataMonth() {
  jumpToScheduleMonth(SCHEDULE_DATA_YEAR, SCHEDULE_DATA_MONTH);
}

function thaiMonthName(monthIndex, style = 'long') {
  return new Date(2000, monthIndex, 1).toLocaleDateString('th-TH', { month: style });
}

function filterScheduleShiftType(shiftTypeVal) {
  state.selectedShiftFilter = shiftTypeVal;
  renderApp();
}

function filterEmployeeSearch(searchValue) {
  state.employeeSearch = searchValue;
  renderApp();
}

function filterEmployeeTeam(teamValue) {
  state.employeeTeamFilter = teamValue;
  renderApp();
}

function openEmployeeForm(employeeId = '') {
  const employee = employeeId ? findEmployeeById(employeeId) : null;
  const title = employee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน';
  const bodyHtml = `
    <form id="employeeForm" onsubmit="event.preventDefault(); saveEmployeeProfile('${employeeId}')">
      <div class="form-group">
        <label for="employeeCode">รหัสพนักงาน (4 หลัก)</label>
        <input id="employeeCode" class="form-control" value="${employee?.id || ''}" required ${employee ? 'disabled' : ''}>
      </div>
      <div class="form-group">
        <label for="employeeName">ชื่อ-นามสกุล</label>
        <input id="employeeName" class="form-control" value="${employee?.name || ''}" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label for="employeeTeam">ทีม</label>
          <select id="employeeTeam" class="form-control">
            <option value="Shift A" ${employee?.shiftType === 'Shift A' ? 'selected' : ''}>Shift A</option>
            <option value="Shift B" ${employee?.shiftType === 'Shift B' ? 'selected' : ''}>Shift B</option>
            <option value="Shift C" ${employee?.shiftType === 'Shift C' ? 'selected' : ''}>Shift C</option>
            <option value="Shift D" ${employee?.shiftType === 'Shift D' ? 'selected' : ''}>Shift D</option>
          </select>
        </div>
        <div class="form-group">
          <label for="employeeRole">โครงสร้างตำแหน่ง</label>
          <select id="employeeRole" class="form-control">
            <option value="Shift Supervisor (S)" ${employee?.position === 'Shift Supervisor (S)' || employee?.roleCategory === 'Shift Supervisor' ? 'selected' : ''}>หัวหน้ากะ (Shift Supervisor - S)</option>
            <option value="Boardman (DCS)" ${employee?.position === 'Boardman (DCS)' ? 'selected' : ''}>พนักงานกะ: Boardman (DCS)</option>
            <option value="Field Operator" ${employee?.position === 'Field Operator' || (!employee?.position && employee?.roleCategory !== 'Shift Supervisor') ? 'selected' : ''}>พนักงานกะ: Field Operator</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="employeePhone">เบอร์ติดต่อ</label>
        <input id="employeePhone" class="form-control" value="${employee?.phone || ''}" required>
      </div>
    </form>
  `;
  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" form="employeeForm">บันทึกข้อมูล</button>
  `;
  openModal(title, bodyHtml, footerHtml);
}

function saveEmployeeProfile(employeeId) {
  const code = document.getElementById('employeeCode')?.value.trim();
  const name = document.getElementById('employeeName')?.value.trim();
  const team = document.getElementById('employeeTeam')?.value;
  const selectedRole = document.getElementById('employeeRole')?.value;
  const phone = document.getElementById('employeePhone')?.value.trim();
  if (!code || !name || !team || !selectedRole || !phone) return;

  const roleCategory = selectedRole.includes('Supervisor') ? 'Shift Supervisor' : 'Shift Employee';
  const position = selectedRole;

  const targetTeamKey = getTeamKeyByLabel(team);
  const targetTeam = state.shiftsData[targetTeamKey];
  const employee = employeeId ? findEmployeeById(employeeId) : null;
  if (employee) {
    const currentTeamKey = getTeamKeyByLabel(employee.shiftType);
    const currentTeam = state.shiftsData[currentTeamKey];
    currentTeam.employees = currentTeam.employees.filter(item => item.id !== employeeId);
    Object.assign(employee, { name, phone, roleCategory, position, shiftType: team });
    targetTeam.employees.push(employee);
  } else {
    targetTeam.employees.push({
      id: code,
      code,
      name,
      phone,
      initials: name.slice(0, 2),
      roleCategory,
      position,
      shiftType: team,
      shifts: Array(31).fill('O')
    });
  }

  closeModal();
  showToast(employee ? 'บันทึกข้อมูลพนักงานแล้ว' : 'เพิ่มพนักงานแล้ว', 'check');
  renderApp();
}

// Export Schedule Data (CSV/Excel) — shared helper reused by all export buttons
function downloadCSV(headers, rows, filename) {
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportMonthlyCSV() {
  const allEmps = getAllEmployees();
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const monthShort = new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('th-TH', { month: 'short' });
  const monthEn = new Date(state.currentYear, state.currentMonth, 1).toLocaleDateString('en-US', { month: 'long' });
  const headers = ['รหัส', 'ชื่อ-นามสกุล', 'กะ', 'บทบาท', ...Array.from({ length: daysInMonth }, (_, i) => `วันที่ ${i + 1} ${monthShort}`)];
  const rows = allEmps.map(e => [e.id, e.name, e.shiftType, e.roleCategory, ...Array.from({ length: daysInMonth }, (_, i) => getShiftCodeForDate(e, state.currentYear, state.currentMonth, i + 1))]);
  downloadCSV(headers, rows, `ShiftFlow-${monthEn}-${state.currentYear}-Shifts.csv`);
  showToast('ส่งออกไฟล์ตารางกะรายเดือน (CSV) เรียบร้อย');
}

// Export Leave Records — ฟีเจอร์ "Export Leave Records" (Design Draft)
function exportLeaveRecordsCSV() {
  const leaveCodes = ['V', 'B', 'S', 'H', 'VG', 'VGh'];
  const allEmps = getAllEmployees();
  const headers = ['รหัส', 'ชื่อ-นามสกุล', 'กะ', 'บทบาท', 'วันที่', 'รหัสการลา', 'รายละเอียด'];
  const rows = [];
  allEmps.forEach(e => {
    e.shifts.forEach((code, idx) => {
      if (leaveCodes.includes(code)) rows.push([e.id, e.name, e.shiftType, e.roleCategory, idx + 1, code, state.shiftDefs[code]?.label || code]);
    });
  });
  downloadCSV(headers, rows, 'ShiftFlow-Leave-Records-2026.csv');
  showToast('ส่งออกประวัติการลา (CSV) เรียบร้อย');
}

// Export OT Records — ฟีเจอร์ "Export OT Records" (Design Draft)
function exportOTRecordsCSV() {
  const otCodes = ['MT', 'NT', 'MTh', 'NTh', 'OT'];
  const allEmps = getAllEmployees();
  const headers = ['รหัส', 'ชื่อ-นามสกุล', 'กะ', 'บทบาท', 'วันที่', 'รหัส OT', 'รายละเอียด'];
  const rows = [];
  allEmps.forEach(e => {
    e.shifts.forEach((code, idx) => {
      if (otCodes.includes(code)) rows.push([e.id, e.name, e.shiftType, e.roleCategory, idx + 1, code, state.shiftDefs[code]?.label || code]);
    });
  });
  downloadCSV(headers, rows, 'ShiftFlow-OT-Records-2026.csv');
  showToast('ส่งออกประวัติการทำ OT (CSV) เรียบร้อย');
}

function switchRole(roleName) {
  state.activeRole = roleName;
  const roleConfig = state.roles[roleName];
  state.activeView = roleConfig.nav.length > 0 ? roleConfig.nav[0].id : 'today';
  renderApp();
}

function switchView(viewId) {
  state.activeView = viewId;
  renderApp();
  toggleSidebar(false);
}

function toggleSidebar(forceState) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;

  const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', isOpen);
  if (backdrop) backdrop.classList.toggle('open', isOpen);
}

function toggleNotifications() {
  const dropdown = document.getElementById('notificationDropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

// ==========================================================================
// MAIN APP RENDER
// ==========================================================================
function renderApp() {
  const role = state.roles[state.activeRole];
  const isDriver = state.activeRole === 'Contractor / Van Driver';

  // Sidebar
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) {
    if (isDriver) {
      sidebarEl.style.display = 'none';
    } else {
      sidebarEl.style.display = 'flex';
      sidebarEl.innerHTML = `
        <div class="brand">
          <div class="brand-mark">✦</div>
          <div class="brand-info">
            <strong>ShiftFlow</strong>
            <small>ระบบจัดการตารางกะฝ่ายผลิต</small>
          </div>
        </div>

        <div class="sidebar-body">
          <div class="nav-section">
            <div class="nav-section-title">เมนูการทำงาน</div>
            ${role.nav.map(item => `
              <button class="nav-link ${state.activeView === item.id ? 'active' : ''}" onclick="switchView('${item.id}')">
                ${getIcon(item.icon)}
                <span>${item.label}</span>
                ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="sidebar-profile">
          <div class="avatar">${role.initials}</div>
          <div class="sidebar-profile-info">
            <strong>${role.name}</strong>
            <small>${role.title}</small>
          </div>
        </div>
      `;
    }
  }

  // Topbar
  const topbarTitle = document.getElementById('topbarTitle');
  const breadcrumbView = document.getElementById('breadcrumbView');
  const roleSelect = document.getElementById('roleSelect');
  const topAvatar = document.getElementById('topAvatar');

  if (roleSelect) roleSelect.value = state.activeRole;
  if (topAvatar) topAvatar.textContent = role.initials;

  const currentNav = role.nav.find(n => n.id === state.activeView);
  const viewTitle = currentNav ? currentNav.label : (isDriver ? 'ตารางรับส่งพนักงานวันนี้' : 'ตารางกะ');

  if (breadcrumbView) breadcrumbView.textContent = viewTitle;
  if (topbarTitle) {
    const isHomeView = state.activeRole === 'Shift Supervisor' && state.activeView === 'overview';
    const firstName = role.name ? role.name.split(' ')[0] : '';
    topbarTitle.textContent = isHomeView
      ? `สวัสดีตอนเช้า, คุณ${firstName}`
      : viewTitle;
  }

  // Content
  const contentRoot = document.getElementById('pageContent');
  if (contentRoot) {
    if (isDriver) {
      contentRoot.innerHTML = renderDriverView();
    } else if (state.activeRole === 'Shift Supervisor') {
      if (state.activeView === 'schedule') contentRoot.innerHTML = renderScheduleView();
      else if (state.activeView === 'overview') contentRoot.innerHTML = renderOverviewView();
      else if (state.activeView === 'requests') contentRoot.innerHTML = renderRequestsView();
      else if (state.activeView === 'history') contentRoot.innerHTML = renderHistoryView();
    } else if (state.activeRole === 'Shift Employee') {
      if (state.activeView === 'team-schedule') {
        contentRoot.innerHTML = state.operatorShowFullGrid
          ? `
            <div class="card" style="margin-bottom:16px">
              <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
                <span style="font-size:13px;color:var(--ink-secondary)">กำลังดูตารางกะเต็มรูปแบบของทุกทีม</span>
                <button class="btn btn-secondary" onclick="toggleOperatorFullGrid(false)">${getIcon('arrowLeft', 'icon-sm')} กลับไปหน้ากะของฉัน (แบบง่าย)</button>
              </div>
            </div>
            ${renderScheduleView()}
          `
          : renderOperatorView();
      }
      else if (state.activeView === 'my-requests') contentRoot.innerHTML = renderRequestsView();
      else if (state.activeView === 'my-history') contentRoot.innerHTML = renderHistoryView();
    } else if (state.activeRole === 'HR') {
      if (state.activeView === 'schedule') contentRoot.innerHTML = renderScheduleView();
      else if (state.activeView === 'hr-export') contentRoot.innerHTML = renderHRView();
      else if (state.activeView === 'hr-audit') contentRoot.innerHTML = renderHistoryView();
    } else if (state.activeRole === 'Manager') {
      if (state.activeView === 'manager-approvals') contentRoot.innerHTML = renderRequestsView();
      else if (state.activeView === 'people') contentRoot.innerHTML = renderPeopleView();
      else if (state.activeView === 'annual-schedule') contentRoot.innerHTML = renderAnnualScheduleView();
      else if (state.activeView === 'manager-settings') contentRoot.innerHTML = renderManagerSettingsView();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});