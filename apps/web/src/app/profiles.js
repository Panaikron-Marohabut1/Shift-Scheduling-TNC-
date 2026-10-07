// Menus follow the preserved prototype. API authorization remains authoritative.
export const profiles={
  MANAGER:{initial:'requests',nav:[['requests','ติดตามสถานะคำขอ','requests'],['people','พนักงานและทีม','people'],['annual','ตารางรายปี (Annual Schedule)','schedule'],['settings','ตั้งค่าระบบ (Settings)','settings']]},
  SUPERVISOR:{initial:'requests',nav:[['schedule','ตารางกะ','schedule'],['overview','ภาพรวมกำลังพล','people'],['requests','คำขอที่ต้องตรวจสอบ','requests'],['history','ประวัติ','history']]},
  EMPLOYEE:{initial:'schedule',nav:[['schedule','กะของฉัน','schedule'],['requests','คำขอของฉัน','requests'],['history','ประวัติของฉัน','history']]},
  HR:{initial:'schedule',nav:[['schedule','ตารางกะรวม (Schedule)','schedule'],['export','ข้อมูลและส่งออก CSV','download'],['audit','ตรวจสอบ OT และประวัติ','history']]},
  EXTERNAL:{initial:'driver',nav:[]}
};
export function allowedView(actor,view) {return profiles[actor.role].nav.some(([id])=>id===view)||(actor.role==='EMPLOYEE'&&view==='swap')||(actor.role==='MANAGER'&&view==='schedule')||(actor.role==='EXTERNAL'&&view==='driver');}
export function viewTitle(actor,view) {return profiles[actor.role].nav.find(([id])=>id===view)?.[1]??({swap:'ขอสลับกะข้ามทีม',schedule:'ตารางกะ',driver:'ตารางรับส่งพนักงานวันนี้'}[view]??'Shift schedule TNC');}
