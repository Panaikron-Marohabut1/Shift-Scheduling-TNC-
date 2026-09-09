/**
 * ShiftFlow — Interactive Application Logic & Business Rules Engine
 * Implements authoritative specs from .docs/02-design/prototype/index.md
 * Redesigned Shift Schedule Layout: Clean, Modern, Shift-Grouped (Morning vs Night) & Week-Separated
 */

// Global App State
const state = {
  activeRole: 'Supervisor',
  activeView: 'schedule',
  currentYear: 2026,
  currentMonth: 7, // 0-indexed: 7 = August (สิงหาคม 2569)
  currentDay: 12, // Demo reference day for request validation
  selectedShiftFilter: 'ALL', // 'ALL', 'A', 'B'
  employeeTeamFilter: 'ALL',
  employeeSearch: '',
  scheduleDrafts: 0,
  unreadNotifications: 2,
  hrDateFilter: '2026-08',
  driverAcknowledged: false,
  driverAckTime: null,
  
  // Backlog & Excel Shift Codes
  shiftDefs: {
    M: { label: 'กะเช้า (Morning)', time: '07:30–19:30', family: 'M', ot: false, leave: false },
    MT: { label: 'กะเช้า + OT', time: '07:30–19:30 + OT', family: 'M', ot: true, leave: false },
    N: { label: 'กะดึก (Night)', time: '19:30–07:30', family: 'N', ot: false, leave: false },
    NT: { label: 'กะดึก + OT', time: '19:30–07:30 + OT', family: 'N', ot: true, leave: false },
    'N/M': { label: 'สลับดึก/เช้า', time: 'Shift Swap', family: 'N', ot: false, leave: false },
    'M/O': { label: 'เช้า/หยุด', time: 'Adjustment', family: 'M', ot: false, leave: false },
    'O/N': { label: 'หยุด/ดึก', time: 'Adjustment', family: 'N', ot: false, leave: false },
    O: { label: 'วันหยุด (Off)', time: 'พักผ่อน', family: 'O', ot: false, leave: false },
    V: { label: 'ลาพักร้อน (Vacation)', time: 'Leave', family: 'V', ot: false, leave: true },
    S: { label: 'ลาป่วย (Sick Leave)', time: 'Leave', family: 'S', ot: false, leave: true },
    H: { label: 'วันหยุดนักขัตฯ', time: 'Holiday', family: 'H', ot: false, leave: false }
  },

  // Role Profiles
  roles: {
    Supervisor: {
      initials: 'NP',
      name: 'ณัฐพล ดวงประเสริฐ',
      title: 'Shift Supervisor (Shift A)',
      short: 'หัวหน้างาน',
      nav: [
        { id: 'schedule', label: 'ตารางกะ (Shift Schedule)', icon: 'calendar' },
        { id: 'overview', label: 'ภาพรวมกำลังพล', icon: 'grid' },
        { id: 'people', label: 'พนักงานและทีม', icon: 'users' },
        { id: 'requests', label: 'คิวคำขอตรวจสอบ', icon: 'check-square', badge: 3 },
        { id: 'history', label: 'ประวัติการเปลี่ยนแปลง', icon: 'history' }
      ]
    },
    'Shift Operator': {
      initials: 'VN',
      name: 'วราเทพ นิยากูล',
      title: 'Shift Employee (Shift A)',
      short: 'พนักงานปฏิบัติการ',
      nav: [
        { id: 'team-schedule', label: 'ตารางกะรวม (Schedule)', icon: 'calendar' },
        { id: 'my-requests', label: 'คำขอของฉัน', icon: 'inbox', badge: 1 },
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
      title: 'พนักงานขับรถตู้รับส่ง (สายหลัก)',
      short: 'คนขับรถรับส่ง',
      nav: []
    }
  },

  // Shift A & Shift B Roster Data (August 2026: 31 Days, 2-on 2-off rotating pattern)
  shiftsData: {
    shiftA: {
      id: 'shiftA',
      name: 'Shift "A"',
      thaiName: 'กะชุด A',
      supervisorId: '0130',
      employees: [
        {
          id: '0130',
          code: '0130',
          name: 'ณัฐพล ดวงประเสริฐ',
          phone: '081-575-5353',
          initials: 'นด',
          roleCategory: 'Shift Supervisor',
          shiftType: 'Shift A',
          shifts: ['O', 'V', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'N', 'N', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N']
        },
        {
          id: '0140',
          code: '0140',
          name: 'วราเทพ นิยากูล',
          phone: '096-959-6293',
          initials: 'วน',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift A',
          shifts: ['O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'N', 'N', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'V', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N']
        },
        {
          id: '0110',
          code: '0110',
          name: 'สมหวัง ศรีเฆมะ',
          phone: '098-251-7614',
          initials: 'สศ',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift A',
          shifts: ['O', 'M', 'M', 'MT', 'MT', 'N', 'N', 'O', 'O', 'N', 'N', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'V', 'V', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N']
        },
        {
          id: '0147',
          code: '0147',
          name: 'สิทธิชัย เมฆาหลับ',
          phone: '094-425-5864',
          initials: 'สม',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift A',
          shifts: ['MT', 'S', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'N/M', 'N/M', 'O', 'O', 'V', 'V', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N']
        },
        {
          id: '0198',
          code: '0198',
          name: 'ปภวิชญ์ สมุทรเขตร',
          phone: '088-261-4190',
          initials: 'ปส',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift A',
          shifts: ['O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'N/O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'O/N', 'V', 'O', 'O', 'M', 'M', 'O', 'M/O', 'N', 'O/N']
        },
        {
          id: '0218',
          code: '0218',
          name: 'นันทวัฒน์ รัตนศรี',
          phone: '085-162-7756',
          initials: 'นร',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift A',
          shifts: ['MT', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'N/M', 'N/M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'V', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N']
        }
      ]
    },
    shiftB: {
      id: 'shiftB',
      name: 'Shift "B"',
      thaiName: 'กะชุด B',
      supervisorId: '0138',
      employees: [
        {
          id: '0138',
          code: '0138',
          name: 'สุระศักดิ์ สงเคราะห์',
          phone: '065-246-3145',
          initials: 'สส',
          roleCategory: 'Shift Supervisor',
          shiftType: 'Shift B',
          shifts: ['N/M', 'MT', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O']
        },
        {
          id: '0164',
          code: '0164',
          name: 'ธุรนันท์ พรหมจรรย์',
          phone: '062-899-8171',
          initials: 'ธพ',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift B',
          shifts: ['N', 'O', 'O', 'V', 'V', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'NT', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O']
        },
        {
          id: '0177',
          code: '0177',
          name: 'วรเดกร ชิมศิริ',
          phone: '063-659-4695',
          initials: 'วช',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift B',
          shifts: ['N', 'O', 'O', 'M', 'M', 'MT', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'M/O', 'O', 'N', 'N', 'O', 'MT', 'M', 'O/M', 'NT', 'NT', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O']
        },
        {
          id: '0181',
          code: '0181',
          name: 'กัณฑ์เอนก สุวัณณกุล',
          phone: '086-287-7832',
          initials: 'กส',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift B',
          shifts: ['M', 'MT', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'MT', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'O/M', 'N/O', 'O']
        },
        {
          id: '0201',
          code: '0201',
          name: 'เสกสรรค์ ศิริโภย',
          phone: '094-962-9632',
          initials: 'สศ',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift B',
          shifts: ['N', 'O', 'O', 'M', 'M', 'O', 'O', 'O/N', 'N', 'O', 'M/O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'O']
        },
        {
          id: '0205',
          code: '0205',
          name: 'วัชรพงศ์ ช่องกา',
          phone: '064-979-6650',
          initials: 'วช',
          roleCategory: 'Shift Employee',
          shiftType: 'Shift B',
          shifts: ['M', 'O', 'O', 'M', 'M', 'MT', 'O', 'N', 'N', 'O', 'O', 'M', 'M', 'MT', 'NT', 'N', 'N', 'O', 'O', 'M', 'M', 'O', 'NT', 'N', 'N', 'O', 'O', 'M', 'M', 'MT', 'O']
        }
      ]
    }
  },

  // Requests Queue Data
  requests: [
    {
      id: 101,
      type: 'สลับกะ',
      person: 'วราเทพ นิยากูล',
      requesterId: '0140',
      initials: 'วน',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: 'สิทธิชัย เมฆาหลับ',
      targetRole: 'Shift Employee (Shift A)',
      date: '04 ส.ค. 2569',
      currentShift: 'M',
      targetShift: 'MT',
      reason: 'สลับเข้ากะเช้าพร้อม OT ส่งต่องานกะบ่าย',
      isCrossShift: false,
      approvers: [{ role: 'Shift Supervisor (ณัฐพล)', status: 'pending' }],
      status: 'รอดำเนินการ',
      submittedAt: '12 นาทีที่แล้ว',
      quotaUsed: '1 / 2 ครั้ง'
    },
    {
      id: 102,
      type: 'เปลี่ยนวันหยุด',
      person: 'ธุรนันท์ พรหมจรรย์',
      initials: 'ธพ',
      roleCategory: 'Shift Employee (Shift B)',
      targetPerson: null,
      targetRole: null,
      date: '04 ส.ค. 2569',
      currentShift: 'M',
      targetShift: 'V',
      reason: 'ขอใช้วันลาพักร้อนประจำปีต่อเนื่อง',
      isCrossShift: false,
      approvers: [{ role: 'Shift Supervisor (สุระศักดิ์)', status: 'pending' }],
      status: 'รอดำเนินการ',
      submittedAt: '35 นาทีที่แล้ว',
      quotaUsed: '-'
    },
    {
      id: 103,
      type: 'สลับกะข้ามทีม (Shift A ↔ Shift B)',
      person: 'นันทวัฒน์ รัตนศรี',
      initials: 'นร',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: 'กัณฑ์เอนก สุวัณณกุล',
      targetRole: 'Shift Employee (Shift B)',
      date: '10 ส.ค. 2569',
      currentShift: 'N',
      targetShift: 'M',
      reason: 'สลับเวรดูแลสายการผลิตพิเศษ (N/M Swap)',
      isCrossShift: true,
      approvers: [
        { role: 'Shift Supervisor A (ณัฐพล)', status: 'approved', at: '08:15' },
        { role: 'Shift Supervisor B (สุระศักดิ์)', status: 'pending' }
      ],
      status: 'รออนุมัติครบ 2 ฝ่าย',
      submittedAt: '1 ชั่วโมงที่แล้ว',
      quotaUsed: '1 / 2 ครั้ง'
    }
  ],

  // Audit History Logs
  auditLogs: [
    { id: 4, actor: 'วราเทพ นิยากูล', employeeId: '0140', avatar: 'วน', action: 'ยื่นคำขอสลับกะวันที่ 04 ส.ค. 2569', time: 'วันนี้ 08:35 น.' },
    { id: 1, actor: 'ณัฐพล ดวงประเสริฐ', avatar: 'นด', action: 'อนุมัติตารางกะประจำเดือนสิงหาคม 2569 (August 2026 Official)', time: 'วันนี้ 08:42 น.' },
    { id: 2, actor: 'ธุรนันท์ พรหมจรรย์', avatar: 'ธพ', action: 'ยื่นคำขอลาพักร้อน (V) วันที่ 04–05 ส.ค.', time: 'วันนี้ 08:18 น.' },
    { id: 3, actor: 'สุระศักดิ์ สงเคราะห์', avatar: 'สส', action: 'ยืนยันกะดึก OT ของวรเดกรและวัชรพงศ์', time: 'เมื่อวาน 17:30 น.' }
  ]
};

// Helper to get all employees
function getAllEmployees() {
  return [
    ...state.shiftsData.shiftA.employees,
    ...state.shiftsData.shiftB.employees
  ];
}

function findEmployeeById(id) {
  return getAllEmployees().find(e => e.id === id);
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
    alert: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>'
  };

  const svgInner = icons[name] || icons.grid;
  return `<svg class="${className}" viewBox="0 0 24 24">${svgInner}</svg>`;
}

// Business Rules Validation Engine (§7 & E04: 2-on 2-off rotating & Max 6 days)
function validateShiftAssignment(empId, targetDay, targetShiftCode) {
  const emp = findEmployeeById(empId);
  if (!emp) return { valid: false, errors: ['ไม่พบข้อมูลพนักงาน'] };

  const results = [];
  let hasHardBlock = false;

  // Rule 1: Max 6 consecutive working days (ต้องไม่เกิน 6 วัน และต้องมีวันหยุดพักผ่อน)
  const shiftsCopy = [...emp.shifts];
  shiftsCopy[targetDay - 1] = targetShiftCode;
  
  let maxConsecutive = 0;
  let currentStreak = 0;
  for (let s of shiftsCopy) {
    if (s !== 'O' && !['V', 'B', 'S', 'H'].includes(s)) {
      currentStreak++;
      if (currentStreak > maxConsecutive) maxConsecutive = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  if (maxConsecutive > 6) {
    results.push({ rule: 'วันทำงานติดต่อกันสูงสุด (Max 6 Days)', status: 'fail', msg: `เกินเกณฑ์ 6 วันติดต่อกัน (นับได้ ${maxConsecutive} วัน) — ฝ่าฝืนกฎความปลอดภัยและกฎหมายแรงงาน` });
    hasHardBlock = true;
  } else if (maxConsecutive >= 4) {
    results.push({ rule: 'วันทำงานติดต่อกัน', status: 'warn', msg: `ทำงานต่อเนื่อง ${maxConsecutive}/6 วัน (ใกล้ครบกำหนด ต้องจัดวันหยุดชดเชย)` });
  } else {
    results.push({ rule: 'รอบการเข้ากะ (2-on 2-off Pattern)', status: 'pass', msg: `สอดคล้องกับรอบหมุนเวียน (ทำงานต่อเนื่อง ${maxConsecutive}/6 วัน)` });
  }

  // Rule 2: Shift A vs Shift B Qualification
  if (['MT', 'NT'].includes(targetShiftCode)) {
    results.push({ rule: 'ชั่วโมงล่วงเวลา (OT Check)', status: 'pass', msg: 'มีชั่วโมง OT ส่งต่องานกะ (เพิ่ม 2 ชม. เข้า Payroll)' });
  } else {
    results.push({ rule: 'สังกัดชุดกะ', status: 'pass', msg: `ตรงตามรหัสพนักงาน ${emp.code} (${emp.shiftType})` });
  }

  // Rule 3: Allowed Change Window (±7 Days)
  const diff = Math.abs(targetDay - state.currentDay);
  if (diff > 7) {
    results.push({ rule: 'กรอบเวลาการขอปรับเปลี่ยน (±7 วัน)', status: 'warn', msg: `วันที่ ${targetDay} ส.ค. อยู่นอกกรอบ ±7 วันจากปัจจุบัน (${state.currentDay} ส.ค.)` });
  } else {
    results.push({ rule: 'กรอบเวลายื่นเรื่อง', status: 'pass', msg: 'อยู่ภายในกรอบเวลาที่ระบบอนุญาต (±7 วัน)' });
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

// Render Shift Badge Component (Clean & Scannable for Excel-Grid)
function renderShiftBadge(code, isInteractive = false, dayNum = null, empId = null) {
  const def = state.shiftDefs[code] || state.shiftDefs.O;
  const isLeave = ['V', 'B', 'S', 'H'].includes(code);
  const badgeClass = isLeave ? 'leave' : code;
  const interactiveAttr = isInteractive ? `onclick="openShiftEditor('${empId}', ${dayNum})"` : '';
  
  return `
    <span class="shift-badge-cell ${badgeClass}" 
          ${interactiveAttr} 
          title="${def.label} (${def.time}) · คลิกเพื่อแก้ไข">
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

  // Grouped by Shift A & Shift B
  const shiftSections = [];
  if (state.selectedShiftFilter === 'ALL' || state.selectedShiftFilter === 'A') {
    shiftSections.push(state.shiftsData.shiftA);
  }
  if (state.selectedShiftFilter === 'ALL' || state.selectedShiftFilter === 'B') {
    shiftSections.push(state.shiftsData.shiftB);
  }

  const allEmployees = getAllEmployees();
  const currentViewerId = ['Supervisor', 'Shift Operator'].includes(state.activeRole)
    ? allEmployees.find(employee => employee.name === state.roles[state.activeRole].name)?.id
    : null;
  const today = new Date();
  const isCurrentDate = d => d === today.getDate()
    && state.currentMonth === today.getMonth()
    && state.currentYear === today.getFullYear();
  const currentDateLabel = `วันที่ ${today.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}`;

  return `
    <div style="display:flex;flex-direction:column;gap:20px">
      <!-- Focused schedule header -->
      <div class="card schedule-header">
        <div class="schedule-header-title">
          <h2>ตารางกะฝ่ายผลิต</h2>
          <span>${currentDateLabel}</span>
        </div>

        <div class="schedule-header-controls">
          <!-- Month navigation -->
          <div class="schedule-month-picker" aria-label="เลือกเดือนของตารางกะ">
            <button class="month-nav-btn" type="button" onclick="changeScheduleMonth(-1)" aria-label="เดือนก่อนหน้า">
              ${getIcon('arrowLeft', 'icon-sm')}
            </button>
            <strong>${monthLabel}</strong>
            <button class="month-nav-btn" type="button" onclick="changeScheduleMonth(1)" aria-label="เดือนถัดไป">
              ${getIcon('arrowRight', 'icon-sm')}
            </button>
          </div>

          <!-- Filter Shift -->
          <label class="schedule-filter role-switch-pill">
            <span class="role-switch-label">ชุดกะ</span>
            <select class="role-select" onchange="filterScheduleShiftType(this.value)">
              <option value="ALL" ${state.selectedShiftFilter === 'ALL' ? 'selected' : ''}>ทั้ง 2 ชุดกะ (Shift A & B)</option>
              <option value="A" ${state.selectedShiftFilter === 'A' ? 'selected' : ''}>เฉพาะ Shift "A"</option>
              <option value="B" ${state.selectedShiftFilter === 'B' ? 'selected' : ''}>เฉพาะ Shift "B"</option>
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
              <!-- Shift Section Header Banner Row (Shift A / Shift B) -->
              <tr style="background:#0f273d;color:#ffffff">
                <td colspan="2" class="sticky-col-1" style="background:#0f273d !important;color:#ffffff;font-weight:800;font-size:12px;padding:8px 16px;z-index:20">
                  ${section.name} (${section.thaiName})
                </td>
                <td colspan="${daysInMonth + 3}" style="background:#0f273d !important;color:#cbd5e1;font-size:10px;text-align:left;padding-left:12px">
                  รอบการทำงานแบบ 2 วันสลับ 2 วัน (2-on 2-off Rotation) · กะละ 12 ชั่วโมง
                </td>
              </tr>

              <!-- Employees in this Shift Section -->
              ${section.employees.map((emp, empIdx) => {
                const isSupervisor = empIdx === 0;
                const isCurrentViewer = emp.id === currentViewerId;
                const workDays = emp.shifts.filter(s => s !== 'O' && !['V','B','S','H'].includes(s)).length;
                const offDays = emp.shifts.filter(s => s === 'O').length;
                const totalHours = workDays * 12; // 12-hour shifts

                return `
                  <tr class="${isCurrentViewer ? 'current-user-row' : ''}" style="${isSupervisor && !isCurrentViewer ? 'background:#f8fafc;font-weight:600' : ''}">
                    <!-- Col 1: Employee Code & Name -->
                    <td class="sticky-col-1" style="${isSupervisor && !isCurrentViewer ? 'background:#f8fafc !important' : ''}">
                      <div class="person-chip">
                        ${isSupervisor ? `<span style="color:#b91c1c;font-weight:900;font-size:11px;margin-right:2px" title="Supervisor">S</span>` : ''}
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

                    <!-- 31 Days Shift Cells -->
                    ${days.map(d => {
                      const shiftCode = emp.shifts[d - 1] || 'O';
                      const isToday = isCurrentDate(d);
                      const weekend = isWeekend(d);
                      const weekStartClass = isWeekStart(d) ? 'week-start' : '';
                      
                      let tdBg = '';
                      if (weekend) tdBg = 'background:#fefce8;';

                      return `
                        <td class="${isToday ? 'today-col' : ''} ${weekStartClass}" style="${tdBg}">
                          ${renderShiftBadge(shiftCode, true, d, emp.id)}
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
          คำอธิบายสัญลักษณ์และประเภทกะ (Shift Legend)
        </div>
        <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
          <div class="legend-item"><span class="shift-badge-cell M" style="width:26px;height:22px;font-size:10px">M</span> <span style="font-size:11px;color:var(--ink-secondary)">กะเช้า (07:30–19:30)</span></div>
          <div class="legend-item"><span class="shift-badge-cell MT" style="width:26px;height:22px;font-size:10px">MT</span> <span style="font-size:11px;color:var(--ink-secondary)">กะเช้า + OT</span></div>
          <div class="legend-item"><span class="shift-badge-cell N" style="width:26px;height:22px;font-size:10px">N</span> <span style="font-size:11px;color:var(--ink-secondary)">กะดึก (19:30–07:30)</span></div>
          <div class="legend-item"><span class="shift-badge-cell NT" style="width:26px;height:22px;font-size:10px">NT</span> <span style="font-size:11px;color:var(--ink-secondary)">กะดึก + OT</span></div>
          <div class="legend-item"><span class="shift-badge-cell O" style="width:26px;height:22px;font-size:10px">O</span> <span style="font-size:11px;color:var(--ink-secondary)">วันหยุดพักผ่อน</span></div>
          <div class="legend-item"><span class="shift-badge-cell leave" style="width:26px;height:22px;font-size:10px">V</span> <span style="font-size:11px;color:var(--ink-secondary)">ลาพักร้อน</span></div>
          <div class="legend-item"><span class="shift-badge-cell leave" style="width:26px;height:22px;font-size:10px">S</span> <span style="font-size:11px;color:var(--ink-secondary)">ลาป่วย</span></div>
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
  const todayLabel = new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  return `
    <div class="page-header dashboard-page-header">
      <div class="page-headline">
        <h1>ภาพรวมกำลังพล</h1>
        <p>สรุปกำลังพล คำขอ และสถานะกะที่ต้องติดตามวันนี้</p>
      </div>
      <span class="dashboard-date">วันที่ ${todayLabel}</span>
    </div>

    <div class="metrics-grid dashboard-metrics">
      <div class="metric-card" onclick="switchView('schedule')">
        <div class="metric-card-top">
          <div class="metric-icon-box mint">${getIcon('users')}</div>
        </div>
        <div class="metric-value">10 / 12 คน</div>
        <div class="metric-label">กำลังปฏิบัติงานวันนี้</div>
        <div class="metric-sub">Shift "A" (5 คน) + Shift "B" (5 คน)</div>
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
        <div class="metric-value">01 รายการ</div>
        <div class="metric-label">คำขอสลับข้ามชุดกะ (Shift A ↔ B)</div>
        <div class="metric-sub">รอการยืนยันจากหัวหน้ากะทั้ง 2 ฝ่าย</div>
      </div>
    </div>

    <!-- Active Shifts Summary Card -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <h3>สถานะกะการทำงานวันนี้ <span class="pill pill-live">กำลังใช้งาน</span></h3>
          <p>สรุปกำลังพลของทั้ง Shift "A" และ Shift "B"</p>
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
              <p style="font-size:12px;color:#b45309;margin:2px 0 0">หัวหน้ากะ: ณัฐพล ดวงประเสริฐ · พนักงานเข้ากะ 5/6 คน</p>
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
              <p style="font-size:12px;color:#4338ca;margin:2px 0 0">หัวหน้ากะ: สุระศักดิ์ สงเคราะห์ · พนักงานพร้อมเข้ากะ 5/6 คน</p>
            </div>
          </div>
          <span class="pill pill-draft" style="color:#3730a3;font-size:11px;padding:4px 10px">Starts 19:30</span>
        </div>
      </div>
    </div>
  `;
}

function getVisibleRequests() {
  if (state.activeRole !== 'Shift Operator') return state.requests;

  const employee = getAllEmployees().find(item => item.name === state.roles[state.activeRole].name);
  return state.requests.filter(request => request.requesterId === employee?.id || request.person === employee?.name);
}

// Requests View with Interactive Testcase Sandbox Runner
function renderRequestsView() {
  const visibleRequests = getVisibleRequests();
  const isOperatorView = state.activeRole === 'Shift Operator';

  return `
    <div class="requests-page ${isOperatorView ? 'operator-requests' : ''}" style="display:flex;flex-direction:column;gap:20px">
      <!-- Interactive Testcase Sandbox Card -->
      <div class="card" style="padding:18px 24px;background:#f8fafc;border:1.5px solid #cbd5e1">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="avatar avatar-sm" style="background:var(--navy);color:#ffffff">⚡</span>
              <strong style="font-size:14px;color:var(--navy)">Interactive Test Cases Sandbox (ทดสอบ Flow ข้อ 4)</strong>
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
                <span class="pill pill-draft" style="color:#b45309">โควตา $\le$ 2 ครั้ง/เดือน</span>
              </div>
              <p style="font-size:11px;color:var(--muted);margin-top:4px">
                ทดสอบกรณียื่นสลับกะครบ 2/2 ครั้งแล้ว และพยายามส่งคำขอครั้งที่ 3 (ระบบจะบล็อคทันที)
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" style="width:100%;font-weight:700" onclick="simulateQuotaExceeded()">
              ▶ จำลองพนักงานใช้โควตาเกิน 2 ครั้ง
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
                ทดสอบการอนุมัติแบบเป็นขั้น: Supervisor A อนุมัติแล้ว $\to$ รอ Supervisor B กดยืนยันครบถ้วน
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
  const canReview = state.activeRole === 'Supervisor';
  const isApproved = req.status === 'อนุมัติแล้ว';
  const isRejected = req.status === 'ไม่อนุมัติ';

  const statusPill = isApproved 
    ? '<span class="pill pill-approved">✓ อนุมัติเรียบร้อย</span>'
    : isRejected 
    ? '<span class="pill pill-rejected">✕ ไม่อนุมัติ</span>'
    : '<span class="pill pill-pending">⏳ รอดำเนินการ</span>';

  return `
    <div class="request-card" id="request-${req.id}" style="${isRejected ? 'background:#fff8f8;' : isApproved ? 'background:#f0fdf4;' : ''}">
      <div class="avatar" style="${isSupervisorRole(req.person) ? 'background:var(--navy-2);color:#ffffff' : ''}">${req.initials}</div>
      <div class="request-card-body">
        <div class="request-card-head">
          <strong>${req.person}</strong>
          <span class="pill pill-draft" style="font-size:9px">${req.type}</span>
          ${statusPill}
        </div>
        <div class="request-card-desc">
          <strong>${req.date}</strong> · ${req.reason}
        </div>
        
        ${req.rejectReason ? `
          <div style="margin-top:6px;padding:6px 10px;background:#fee2e2;border-radius:var(--radius-sm);color:#991b1b;font-size:11px">
            <strong>เหตุผลที่ไม่อนุมัติ:</strong> ${req.rejectReason}
          </div>
        ` : ''}

        <div class="request-card-meta">
          <span>${getIcon('clock', 'icon-sm')} ยื่นเมื่อ ${req.submittedAt}</span>
          <span>สังกัด: ${req.roleCategory}</span>
          ${req.quotaUsed !== '-' ? `<span>สิทธิ์สลับกะเดือนนี้: <strong>${req.quotaUsed}</strong></span>` : ''}
        </div>

        <!-- Cross-Shift Dual Approval Stepper (US-024) -->
        ${req.isCrossShift ? `
          <div class="approval-stepper" style="margin-top:10px">
            <div class="stepper-step ${req.approvers[0].status === 'approved' ? 'done' : 'active'}">
              ${req.approvers[0].status === 'approved' ? getIcon('check', 'icon-sm') : getIcon('clock', 'icon-sm')}
              ${req.approvers[0].role} (${req.approvers[0].status === 'approved' ? 'อนุมัติแล้ว' : 'รอดำเนินการ'})
            </div>
            <span class="stepper-arrow">›</span>
            <div class="stepper-step ${req.approvers[1].status === 'approved' ? 'done' : req.approvers[0].status === 'approved' ? 'active' : ''}">
              ${req.approvers[1].status === 'approved' ? getIcon('check', 'icon-sm') : getIcon('clock', 'icon-sm')}
              ${req.approvers[1].role} (${req.approvers[1].status === 'approved' ? 'อนุมัติครบแล้ว' : 'รอยืนยันฝ่ายที่ 2'})
            </div>
          </div>
        ` : ''}
      </div>

      ${isPending && canReview ? `
        <div class="request-actions">
          <button class="btn-icon-action btn-icon-reject" title="ปฏิเสธคำขอ (ระบุเหตุผล)" onclick="promptRejectRequest(${req.id})">
            ${getIcon('x', 'icon-sm')}
          </button>
          <button class="btn-icon-action btn-icon-approve" title="อนุมัติคำขอ" onclick="approveRequest(${req.id})">
            ${getIcon('check', 'icon-sm')}
          </button>
        </div>
      ` : state.activeRole === 'Shift Operator' ? `
        <div class="request-view-action">
          <button class="btn btn-secondary btn-sm" onclick="openRequestDetails(${req.id})">ดูรายละเอียด</button>
        </div>
      ` : ''}
    </div>
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
        <div class="request-detail-row request-detail-row-long"><dt>รายละเอียด</dt><dd>${req.reason}</dd></div>
        <div class="request-detail-row"><dt>ส่งคำขอเมื่อ</dt><dd>${req.submittedAt}</dd></div>
        <div class="request-detail-row"><dt>ผู้ตรวจสอบ</dt><dd>${req.approvers.map(approver => approver.role).join(', ')}</dd></div>
        ${req.rejectReason ? `<div class="request-detail-row request-detail-row-long"><dt>เหตุผลที่ไม่อนุมัติ</dt><dd>${req.rejectReason}</dd></div>` : ''}
      </dl>
    </div>
  `;

  openModal('รายละเอียดคำขอ', bodyHtml, '<button class="btn btn-secondary" onclick="closeModal()">ปิด</button>');
}

function isSupervisorRole(name) {
  return ['ณัฐพล ดวงประเสริฐ', 'สุระศักดิ์ สงเคราะห์'].includes(name);
}

// Interactive Testcase Handlers
function simulateQuotaExceeded() {
  const currentQuota = 2; // already 2/2 used
  
  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-md);color:#991b1b">
        <strong style="display:block;font-size:12px">⚠️ ตรวจพบข้อจำกัดโควตา (US-023 Quota Exceeded)</strong>
        <p style="font-size:11px;margin-top:4px">
          พนักงาน <strong>วราเทพ นิยากูล</strong> ได้ใช้สิทธิ์สลับกะในเดือนสิงหาคม 2569 ไปแล้ว <strong>2 / 2 ครั้ง</strong> (ครบโควตาสูงสุดที่ระบบอนุญาต)
        </p>
      </div>

      <div class="form-group">
        <label>พนักงานผู้ยื่นคำขอ</label>
        <input class="form-control" value="วราเทพ นิยากูล (Shift Employee · Shift A)" disabled>
      </div>

      <div class="form-group">
        <label>สิทธิ์คงเหลือเดือนนี้</label>
        <input class="form-control" value="0 / 2 ครั้ง (ใช้สิทธิ์ครบแล้ว)" style="color:#b91c1c;font-weight:700" disabled>
      </div>

      <div class="validation-panel">
        <div class="validation-panel-title">ผลการตรวจสอบสิทธิ์อัตโนมัติ</div>
        <div class="validation-check-item fail">
          ${getIcon('x', 'icon-sm')}
          <span><strong>สิทธิ์สลับกะ:</strong> เกินโควตาสูงสุด 2 ครั้ง/เดือน — ระบบไม่อนุญาตให้ส่งคำขอเพิ่ม</span>
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

  openModal('ทดสอบระบบโควตา: วราเทพ นิยากูล (US-023)', bodyHtml, footerHtml);
}

function simulateDualApprovalStep() {
  const req = state.requests.find(r => r.id === 103);
  if (!req) return;

  if (req.approvers[1].status === 'approved') {
    showToast('คำขอนี้ได้รับการอนุมัติครบ 2 ฝ่ายเรียบร้อยแล้ว');
    return;
  }

  // Complete second approval step
  req.approvers[1].status = 'approved';
  req.approvers[1].at = '09:05';
  req.status = 'อนุมัติแล้ว';

  state.auditLogs.unshift({
    id: Date.now(),
    actor: 'สุระศักดิ์ สงเคราะห์ (Shift Supervisor B)',
    avatar: 'สส',
    action: `อนุมัติคำขอสลับกะข้ามทีม (ฝ่ายที่ 2 ครบสมบูรณ์) ของ ${req.person}`,
    time: 'เมื่อสักครู่'
  });

  showToast('Shift Supervisor B กดยืนยันแล้ว — อนุมัติครบ 2 ฝ่ายเรียบร้อย!', 'check');
  renderApp();
}

function resetTestcases() {
  state.requests = [
    {
      id: 101,
      type: 'สลับกะ',
      person: 'วราเทพ นิยากูล',
      requesterId: '0140',
      initials: 'วน',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: 'สิทธิชัย เมฆาหลับ',
      targetRole: 'Shift Employee (Shift A)',
      date: '04 ส.ค. 2569',
      currentShift: 'M',
      targetShift: 'MT',
      reason: 'สลับเข้ากะเช้าพร้อม OT ส่งต่องานกะบ่าย',
      isCrossShift: false,
      approvers: [{ role: 'Shift Supervisor (ณัฐพล)', status: 'pending' }],
      status: 'รอดำเนินการ',
      submittedAt: '12 นาทีที่แล้ว',
      quotaUsed: '1 / 2 ครั้ง'
    },
    {
      id: 102,
      type: 'เปลี่ยนวันหยุด',
      person: 'ธุรนันท์ พรหมจรรย์',
      initials: 'ธพ',
      roleCategory: 'Shift Employee (Shift B)',
      targetPerson: null,
      targetRole: null,
      date: '04 ส.ค. 2569',
      currentShift: 'M',
      targetShift: 'V',
      reason: 'ขอใช้วันลาพักร้อนประจำปีต่อเนื่อง',
      isCrossShift: false,
      approvers: [{ role: 'Shift Supervisor (สุระศักดิ์)', status: 'pending' }],
      status: 'รอดำเนินการ',
      submittedAt: '35 นาทีที่แล้ว',
      quotaUsed: '-'
    },
    {
      id: 103,
      type: 'สลับกะข้ามทีม (Shift A ↔ Shift B)',
      person: 'นันทวัฒน์ รัตนศรี',
      initials: 'นร',
      roleCategory: 'Shift Employee (Shift A)',
      targetPerson: 'กัณฑ์เอนก สุวัณณกุล',
      targetRole: 'Shift Employee (Shift B)',
      date: '10 ส.ค. 2569',
      currentShift: 'N',
      targetShift: 'M',
      reason: 'สลับเวรดูแลสายการผลิตพิเศษ (N/M Swap)',
      isCrossShift: true,
      approvers: [
        { role: 'Shift Supervisor A (ณัฐพล)', status: 'approved', at: '08:15' },
        { role: 'Shift Supervisor B (สุระศักดิ์)', status: 'pending' }
      ],
      status: 'รออนุมัติครบ 2 ฝ่าย',
      submittedAt: '1 ชั่วโมงที่แล้ว',
      quotaUsed: '1 / 2 ครั้ง'
    }
  ];

  showToast('รีเซ็ตข้อมูลคำขอทดสอบเรียบร้อยแล้ว');
  renderApp();
}

// Operator View
function renderOperatorView() {
  const currentEmp = getAllEmployees().find(employee => employee.name === state.roles['Shift Operator'].name);
  const days = [
    { label: 'ศ. 04', date: '4 ก.ย.', code: 'M', status: 'เข้ากะวันนี้' },
    { label: 'ส. 05', date: '5 ก.ย.', code: 'M', status: 'ได้รับมอบหมาย' },
    { label: 'อา. 06', date: '6 ก.ย.', code: 'MT', status: 'กะเช้า + OT' },
    { label: 'จ. 07', date: '7 ก.ย.', code: 'O', status: 'วันหยุดพักผ่อน' },
    { label: 'อ. 08', date: '8 ก.ย.', code: 'M', status: 'ได้รับมอบหมาย' },
    { label: 'พ. 09', date: '9 ก.ย.', code: 'M', status: 'ได้รับมอบหมาย' },
    { label: 'พฤ. 10', date: '10 ก.ย.', code: 'O', status: 'วันหยุด' }
  ];

  return `
    <div class="grid-2col">
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="operator-hero-card">
          <div class="operator-hero-date">วันศุกร์ที่ 4 กันยายน 2569 · สังกัด Morning Shift</div>
          <div class="operator-hero-shift">กะเช้า (Morning Shift)</div>
          <p style="color:#cbd5e1;font-size:13px">หัวหน้ากะผู้รับผิดชอบ: คุณกัญญา ศรีสวัสดิ์ (Shift Supervisor)</p>
          
          <div class="operator-hero-meta">
            <div class="operator-meta-col">
              <small>เวลาปฏิบัติงาน</small>
              <strong>07:30 – 19:30</strong>
            </div>
            <div class="operator-meta-col">
              <small>จุดรายงานตัว</small>
              <strong>Gate 2 (07:15 น.)</strong>
            </div>
            <div class="operator-meta-col">
              <small>วันทำงานต่อเนื่อง</small>
              <strong>วันที่ 3 / 6 วัน</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <h3>ตารางกะของฉัน 7 วันข้างหน้า</h3>
              <p>คลิกที่การ์ดวันเพื่อยื่นคำขอสลับกะหรือเปลี่ยนวันหยุด</p>
            </div>
          </div>
          <div class="card-body">
            <div class="seven-day-strip">
              ${days.map((d, i) => `
                <div class="day-card ${i === 0 ? 'today' : ''}" onclick="openOperatorRequestModal('${d.date}', '${d.code}')">
                  <div class="day-card-date">${d.label}</div>
                  ${renderShiftBadge(d.code)}
                  <small style="font-size:9px;color:var(--muted);margin-top:2px">${d.status}</small>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <h3>ศูนย์ยื่นคำขอออนไลน์</h3>
              <p>ส่งคำขอถึง Shift Supervisor ตรวจสอบกฎความปลอดภัยให้อัตโนมัติ</p>
            </div>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
            <button class="btn btn-secondary" style="width:100%;height:44px;justify-content:flex-start" onclick="openOperatorRequestModal('07 ก.ย.', 'M')">
              <div class="avatar avatar-sm" style="background:var(--mint-light);color:var(--mint-text)">${getIcon('users', 'icon-sm')}</div>
              <div style="text-align:left;flex:1;margin-left:8px">
                <strong style="display:block;font-size:12px">ยื่นขอสลับกะ (Shift Swap)</strong>
                <small style="color:var(--muted);font-size:10px">เลือกเพื่อนร่วมงานในกะ (สิทธิ์เหลือ 1/2 ครั้ง)</small>
              </div>
              ${getIcon('arrowRight', 'icon-sm')}
            </button>

            <button class="btn btn-secondary" style="width:100%;height:44px;justify-content:flex-start" onclick="showToast('เปิดแบบฟอร์มขอเปลี่ยนวันหยุด')">
              <div class="avatar avatar-sm" style="background:#fffbeb;color:#b45309">${getIcon('calendar', 'icon-sm')}</div>
              <div style="text-align:left;flex:1;margin-left:8px">
                <strong style="display:block;font-size:12px">ขอเปลี่ยนวันหยุด (Day-Off Change)</strong>
                <small style="color:var(--muted);font-size:10px">ย้ายวันหยุดตามกรอบ ±7 วัน</small>
              </div>
              ${getIcon('arrowRight', 'icon-sm')}
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <h3>สถานะคำขอของฉัน</h3>
              <p>ติดตามผลการอนุมัติแบบเรียลไทม์</p>
            </div>
          </div>
          <div class="card-body">
            <div style="padding:12px;border-radius:var(--radius-md);background:var(--bg-subtle);border:1px solid var(--line)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:12px">สลับกะ · 07 ก.ย. 2569</strong>
                <span class="pill pill-pending">รอหัวหน้ากะอนุมัติ</span>
              </div>
              <p style="font-size:11px;color:var(--ink-secondary);margin-top:4px">สลับกะกับ Parichat Sriagsorn</p>
              <small style="display:block;color:var(--muted);margin-top:6px;font-size:10px">ยื่นเมื่อ 12 นาทีที่แล้ว · ตรวจสอบกฎความปลอดภัยผ่านเรียบร้อย</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// HR View
function renderHRView() {
  const allEmps = getAllEmployees();

  return `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-card-top">
          <div class="metric-icon-box mint">${getIcon('file-text')}</div>
        </div>
        <div class="metric-value">360 กะ</div>
        <div class="metric-label">กะที่อนุมัติแล้วประจำเดือน</div>
        <div class="metric-sub">Morning + Night Shift (30 วัน)</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-top">
          <div class="metric-icon-box amber">${getIcon('clock')}</div>
          <span class="pill pill-pending">พร้อมคิดเงิน</span>
        </div>
        <div class="metric-value">12 รายการ</div>
        <div class="metric-label">กะที่มีชั่วโมงล่วงเวลา (OT)</div>
        <div class="metric-sub">MT / NT ส่งต่องานกะ</div>
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
          <span class="pill pill-approved">2 Shifts</span>
        </div>
        <div class="metric-value">12 คน</div>
        <div class="metric-label">จำนวนพนักงานรวมทั้ง 2 กะ</div>
        <div class="metric-sub">Supervisors (2) + Employees (10)</div>
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
                <strong style="display:block;font-size:13px">ตารางกะทั้ง 2 กะรายเดือน</strong>
                <small style="color:var(--muted)">CSV Data Format · Morning + Night Shift</small>
              </div>
              <button class="btn btn-primary btn-sm" onclick="exportMonthlyCSV()">
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
            <p>วันศุกร์ที่ 4 กันยายน 2569 · รถตู้ทะเบียน ฮฮ-8899 กทม.</p>
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

// Employee and Team Management (Supervisor)
function renderPeopleView() {
  const teams = ['ALL', 'Shift A', 'Shift B'];
  const allEmployees = getAllEmployees();
  const employees = allEmployees.filter(employee => {
    const matchesTeam = state.employeeTeamFilter === 'ALL' || employee.shiftType === state.employeeTeamFilter;
    const searchTerm = state.employeeSearch.trim().toLowerCase();
    const matchesSearch = !searchTerm
      || employee.name.toLowerCase().includes(searchTerm)
      || employee.id.includes(searchTerm);
    return matchesTeam && matchesSearch;
  });
  const teamCounts = ['Shift A', 'Shift B'].map(team => ({
    team,
    count: allEmployees.filter(employee => employee.shiftType === team).length
  }));

  return `
    <div class="people-page">
      <div class="people-summary" aria-label="สรุปจำนวนพนักงาน">
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
            <p>แก้ไขข้อมูลหรือย้ายพนักงานระหว่างทีมจากรายการนี้</p>
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
                  <td>${employee.roleCategory}</td>
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
  if (state.activeRole !== 'Shift Operator') return state.auditLogs;

  const employee = getAllEmployees().find(item => item.name === state.roles[state.activeRole].name);
  return state.auditLogs.filter(log => log.employeeId === employee?.id || log.actor === employee?.name);
}

function renderHistoryView() {
  const isOperatorView = state.activeRole === 'Shift Operator';
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
// MODALS & ACTIONS
// ==========================================================================

function openShiftEditor(empId, dayNum) {
  const emp = findEmployeeById(empId);
  if (!emp) return;

  const currentViewer = state.activeRole === 'Shift Operator'
    ? getAllEmployees().find(employee => employee.name === state.roles['Shift Operator'].name)
    : null;
  const isOperatorRequest = state.activeRole === 'Shift Operator';
  const isOwnRow = isOperatorRequest && currentViewer?.id === emp.id;
  const requestMode = isOwnRow ? 'change' : 'swap';
  const currentShift = emp.shifts[dayNum - 1];
  const initialValidation = validateShiftAssignment(empId, dayNum, currentShift);
  const modalTitle = isOperatorRequest
    ? `${isOwnRow ? 'ขอเปลี่ยนกะของฉัน' : 'ขอสลับกะกับเพื่อนร่วมงาน'} · ${emp.name}`
    : `ปรับแก้กะพนักงาน · ${emp.name}`;
  const shiftLabel = isOperatorRequest
    ? (isOwnRow ? 'กะที่ต้องการเปลี่ยน' : 'กะของเพื่อนร่วมงาน')
    : 'ประเภทกะที่มอบหมาย';
  const submitAction = isOperatorRequest
    ? `submitOperatorShiftRequest('${empId}', ${dayNum}, '${requestMode}')`
    : `saveShiftEdit('${empId}', ${dayNum})`;
  const submitLabel = isOperatorRequest
    ? (isOwnRow ? 'ส่งคำขอเปลี่ยนกะ' : 'ส่งคำขอสลับกะ')
    : 'บันทึกการปรับกะ';

  const bodyHtml = `
    <form id="shiftEditForm" onsubmit="event.preventDefault(); ${submitAction}">
      <div class="form-group">
        <label>${isOperatorRequest && !isOwnRow ? 'เพื่อนร่วมงาน' : 'พนักงานในกะ'}</label>
        <input class="form-control" value="${emp.name} (${emp.roleCategory} · ${emp.shiftType})" disabled>
      </div>

      <div class="form-group">
        <label>วันที่</label>
        <input class="form-control" value="${dayNum} กันยายน 2569" disabled>
      </div>

      <div class="form-group">
        <label>${shiftLabel}</label>
        <select class="form-control" id="modalShiftSelect" onchange="runLiveShiftValidation('${empId}', ${dayNum}, this.value)">
          <option value="M" ${currentShift === 'M' ? 'selected' : ''}>M · กะเช้า (07:30–19:30)</option>
          <option value="MT" ${currentShift === 'MT' ? 'selected' : ''}>MT · กะเช้า + OT ส่งต่องาน</option>
          <option value="N" ${currentShift === 'N' ? 'selected' : ''}>N · กะกลางคืน (19:30–07:30)</option>
          <option value="NT" ${currentShift === 'NT' ? 'selected' : ''}>NT · กะดึก + OT ส่งต่องาน</option>
          <option value="O" ${currentShift === 'O' ? 'selected' : ''}>O · วันหยุดพักผ่อน</option>
          <option value="V" ${currentShift === 'V' ? 'selected' : ''}>V · ลาพักร้อน</option>
          <option value="B" ${currentShift === 'B' ? 'selected' : ''}>B · ลากิจ</option>
          <option value="S" ${currentShift === 'S' ? 'selected' : ''}>S · ลาป่วย</option>
          <option value="H" ${currentShift === 'H' ? 'selected' : ''}>H · วันหยุดนักขัตฤกษ์</option>
        </select>
      </div>

      <div class="validation-panel" id="modalValidationPanel">
        ${renderValidationChecks(initialValidation.results)}
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="button" class="btn btn-primary" id="btnSaveShift" onclick="${submitAction}">
      ${submitLabel}
    </button>
  `;

  openModal(modalTitle, bodyHtml, footerHtml);
}

function renderValidationChecks(checks) {
  return `
    <div class="validation-panel-title">ผลการตรวจสอบกฎความปลอดภัยและข้อกำหนด</div>
    ${checks.map(c => `
      <div class="validation-check-item ${c.status}">
        ${c.status === 'pass' ? getIcon('check', 'icon-sm') : c.status === 'warn' ? getIcon('alert', 'icon-sm') : getIcon('x', 'icon-sm')}
        <span><strong>${c.rule}:</strong> ${c.msg}</span>
      </div>
    `).join('')}
  `;
}

function runLiveShiftValidation(empId, dayNum, shiftCode) {
  const validation = validateShiftAssignment(empId, dayNum, shiftCode);
  const panel = document.getElementById('modalValidationPanel');
  const btn = document.getElementById('btnSaveShift');
  
  if (panel) panel.innerHTML = renderValidationChecks(validation.results);
  if (btn) btn.disabled = !validation.valid;
}

function submitOperatorShiftRequest(targetEmpId, dayNum, requestMode) {
  const currentEmp = getAllEmployees().find(employee => employee.name === state.roles['Shift Operator'].name);
  const targetEmp = findEmployeeById(targetEmpId);
  const shiftCode = document.getElementById('modalShiftSelect')?.value;
  if (!currentEmp || !targetEmp || !shiftCode) return;

  const requestType = requestMode === 'change' ? 'ขอเปลี่ยนกะ' : 'ขอสลับกะ';
  const requestId = Date.now();
  const dateLabel = `${dayNum} ก.ย. 2569`;

  state.requests.unshift({
    id: requestId,
    type: requestType,
    person: currentEmp.name,
    requesterId: currentEmp.id,
    initials: currentEmp.initials,
    roleCategory: currentEmp.roleCategory,
    targetPerson: requestMode === 'swap' ? targetEmp.name : null,
    targetRole: requestMode === 'swap' ? targetEmp.roleCategory : null,
    date: dateLabel,
    currentShift: currentEmp.shifts[dayNum - 1],
    targetShift: shiftCode,
    reason: requestMode === 'change'
      ? `ขอเปลี่ยนกะของฉันเป็น ${shiftCode}`
      : `ขอสลับกะกับ ${targetEmp.name}`,
    isCrossShift: requestMode === 'swap' && currentEmp.shiftType !== targetEmp.shiftType,
    approvers: [{ role: `Shift Supervisor (${currentEmp.shiftType})`, status: 'pending' }],
    status: 'รอดำเนินการ',
    submittedAt: 'เมื่อสักครู่',
    quotaUsed: requestMode === 'swap' ? '1 / 2 ครั้ง' : '-'
  });

  state.auditLogs.unshift({
    id: requestId,
    actor: currentEmp.name,
    employeeId: currentEmp.id,
    avatar: currentEmp.initials,
    action: `${requestType}วันที่ ${dateLabel}${requestMode === 'swap' ? ` กับ ${targetEmp.name}` : ''}`,
    time: 'เมื่อสักครู่'
  });

  closeModal();
  showToast(`ส่ง${requestType}เรียบร้อยแล้ว`);
  state.activeView = 'my-requests';
  renderApp();
}

function saveShiftEdit(empId, dayNum) {
  const shiftCode = document.getElementById('modalShiftSelect').value;
  const emp = findEmployeeById(empId);
  if (emp) {
    const oldShift = emp.shifts[dayNum - 1];
    emp.shifts[dayNum - 1] = shiftCode;
    
    state.auditLogs.unshift({
      id: Date.now(),
      actor: state.roles[state.activeRole].name,
      avatar: state.roles[state.activeRole].initials,
      action: `เปลี่ยนกะของ ${emp.name} วันที่ ${dayNum} ก.ย. จาก ${oldShift} เป็น ${shiftCode}`,
      time: 'เมื่อสักครู่'
    });

    closeModal();
    showToast(`อัปเดตตารางกะของ ${emp.name} เรียบร้อยแล้ว`);
    renderApp();
  }
}

// 3-Step Swap Modal for Operator
function openOperatorRequestModal(dateStr, currentShift) {
  const currentEmp = getAllEmployees().find(employee => employee.name === state.roles['Shift Operator'].name);
  const eligibleColleagues = state.shiftsData.shiftA.employees.filter(employee => employee.id !== currentEmp.id);

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label>วันที่ต้องการสลับกะ</label>
        <input class="form-control" value="${dateStr} 2569 (กะเดิมของคุณ: ${currentShift})" disabled>
      </div>

      <div class="form-group">
        <label>เลือกเพื่อนร่วมงานในกะที่ต้องการสลับด้วย</label>
        <select class="form-control" id="swapTargetSelect">
          ${eligibleColleagues.map(c => `
            <option value="${c.id}">${c.name} (${c.roleCategory})</option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>เหตุผลความจำเป็น</label>
        <textarea class="form-control" id="swapReasonInput" rows="2" placeholder="ระบุเหตุผลในการขอสลับกะ"></textarea>
      </div>

      <div class="validation-panel">
        <div class="validation-panel-title">การตรวจสอบสิทธิ์</div>
        <div class="validation-check-item pass">${getIcon('check', 'icon-sm')} <span><strong>สิทธิ์คงเหลือ:</strong> 1/2 ครั้งในเดือนนี้</span></div>
        <div class="validation-check-item pass">${getIcon('check', 'icon-sm')} <span><strong>วันทำงานติดต่อกัน:</strong> ไม่เกินเกณฑ์ 6 วัน</span></div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="button" class="btn btn-primary" onclick="submitSwapRequest('${dateStr}', '${currentShift}')">
      ยืนยันส่งคำขอสลับกะ
    </button>
  `;

  openModal('ยื่นคำขอสลับกะ (Shift Swap Request)', bodyHtml, footerHtml);
}

function submitSwapRequest(dateStr, currentShift) {
  const targetEmpId = document.getElementById('swapTargetSelect').value;
  const reason = document.getElementById('swapReasonInput').value || 'มีความจำเป็นส่วนตัวขอสลับกะ';
  const targetEmp = findEmployeeById(targetEmpId);

  const currentEmp = getAllEmployees().find(employee => employee.name === state.roles['Shift Operator'].name);

  state.requests.unshift({
    id: Date.now(),
    type: 'สลับกะ',
    person: currentEmp.name,
    requesterId: currentEmp.id,
    initials: currentEmp.initials,
    roleCategory: currentEmp.roleCategory,
    targetPerson: targetEmp.name,
    targetRole: targetEmp.roleCategory,
    date: dateStr + ' 2569',
    currentShift: currentShift,
    targetShift: 'MT',
    reason: reason,
    isCrossShift: false,
    approvers: [{ role: 'Shift Supervisor (Kanya)', status: 'pending' }],
    status: 'รอดำเนินการ',
    submittedAt: 'เมื่อสักครู่',
    quotaUsed: '2 / 2 ครั้ง'
  });

  state.auditLogs.unshift({
    id: Date.now(),
    actor: currentEmp.name,
    employeeId: currentEmp.id,
    avatar: currentEmp.initials,
    action: `ยื่นคำขอสลับกะวันที่ ${dateStr} 2569`,
    time: 'เมื่อสักครู่'
  });

  closeModal();
  showToast('ยื่นคำขอสลับกะส่งถึงหัวหน้ากะเรียบร้อยแล้ว');
  renderApp();
}

function approveRequest(reqId) {
  const req = state.requests.find(r => r.id === reqId);
  if (req) {
    req.status = 'อนุมัติแล้ว';
    state.auditLogs.unshift({
      id: Date.now(),
      actor: state.roles[state.activeRole].name,
      avatar: state.roles[state.activeRole].initials,
      action: `อนุมัติคำขอ ${req.type} ของ ${req.person} (วันที่ ${req.date})`,
      time: 'เมื่อสักครู่'
    });

    showToast(`อนุมัติคำขอของ ${req.person} เรียบร้อยแล้ว`);
    renderApp();
  }
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
        <label for="employeeCode">รหัสพนักงาน</label>
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
          </select>
        </div>
        <div class="form-group">
          <label for="employeeRole">ตำแหน่ง</label>
          <select id="employeeRole" class="form-control">
            <option value="Shift Employee" ${employee?.roleCategory === 'Shift Employee' ? 'selected' : ''}>Shift Employee</option>
            <option value="Shift Supervisor" ${employee?.roleCategory === 'Shift Supervisor' ? 'selected' : ''}>Shift Supervisor</option>
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
  const roleCategory = document.getElementById('employeeRole')?.value;
  const phone = document.getElementById('employeePhone')?.value.trim();
  if (!code || !name || !team || !roleCategory || !phone) return;

  const targetTeam = team === 'Shift A' ? state.shiftsData.shiftA : state.shiftsData.shiftB;
  const employee = employeeId ? findEmployeeById(employeeId) : null;
  if (employee) {
    const currentTeam = employee.shiftType === 'Shift A' ? state.shiftsData.shiftA : state.shiftsData.shiftB;
    currentTeam.employees = currentTeam.employees.filter(item => item.id !== employeeId);
    Object.assign(employee, { name, phone, roleCategory, shiftType: team });
    targetTeam.employees.push(employee);
  } else {
    targetTeam.employees.push({
      id: code,
      code,
      name,
      phone,
      initials: name.slice(0, 2),
      roleCategory,
      shiftType: team,
      shifts: Array(31).fill('O')
    });
  }

  closeModal();
  showToast(employee ? 'บันทึกข้อมูลพนักงานแล้ว' : 'เพิ่มพนักงานแล้ว', 'check');
  renderApp();
}

function exportMonthlyCSV() {
  const allEmps = getAllEmployees();
  const headers = ['รหัส', 'ชื่อ-นามสกุล', 'กะ', 'บทบาท', ...Array.from({ length: 30 }, (_, i) => `วันที่ ${i + 1} ก.ย.`)];
  const rows = allEmps.map(e => [e.id, e.name, e.shiftType, e.roleCategory, ...e.shifts]);
  
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'ShiftFlow-September-2026-Shifts.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ส่งออกไฟล์ตารางกะรายเดือน (CSV) เรียบร้อย');
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
    topbarTitle.textContent = state.activeRole === 'Supervisor' && state.activeView === 'overview'
      ? 'สวัสดีตอนเช้า, คุณกัญญา'
      : viewTitle;
  }

  // Content
  const contentRoot = document.getElementById('pageContent');
  if (contentRoot) {
    if (isDriver) {
      contentRoot.innerHTML = renderDriverView();
    } else if (state.activeRole === 'Supervisor') {
      if (state.activeView === 'schedule') contentRoot.innerHTML = renderScheduleView();
      else if (state.activeView === 'overview') contentRoot.innerHTML = renderOverviewView();
      else if (state.activeView === 'people') contentRoot.innerHTML = renderPeopleView();
      else if (state.activeView === 'requests') contentRoot.innerHTML = renderRequestsView();
      else if (state.activeView === 'history') contentRoot.innerHTML = renderHistoryView();
    } else if (state.activeRole === 'Shift Operator') {
      if (state.activeView === 'team-schedule') contentRoot.innerHTML = renderScheduleView();
      else if (state.activeView === 'my-requests') contentRoot.innerHTML = renderRequestsView();
      else if (state.activeView === 'my-history') contentRoot.innerHTML = renderHistoryView();
    } else if (state.activeRole === 'HR') {
      if (state.activeView === 'schedule') contentRoot.innerHTML = renderScheduleView();
      else if (state.activeView === 'hr-export') contentRoot.innerHTML = renderHRView();
      else if (state.activeView === 'hr-audit') contentRoot.innerHTML = renderHistoryView();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});
