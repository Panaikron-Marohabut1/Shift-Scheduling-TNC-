/* ==========================================================================
   ภาพรวมกำลังพล (หัวหน้ากะ) — ตัวเลขจากตารางกะและคำขอจริงของวันนี้
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { getAllEmployees, TEAM_KEYS } from '../../shared/scheduling/employees.js';
import { getShiftCodeForDate } from '../../shared/scheduling/roster.js';
import { pageHead } from '../../shared/ui.js';
import { famOf } from './codes.js';

// กะของทีมในวันนี้: ดูจากหัวหน้ากะ ถ้าวันนี้หยุดให้บอกกะถัดไปของรอบ
function teamToday(team) {
  const sup = team.employees.find(e => e.id === team.supervisorId) || team.employees[0];
  if (!sup) return { fam: 'c-M', working: false };
  const y = DEMO_TODAY.getFullYear(), m = DEMO_TODAY.getMonth(), d = DEMO_TODAY.getDate();
  const today = famOf(getShiftCodeForDate(sup, y, m, d));
  if (today === 'c-M' || today === 'c-N') return { fam: today, working: true };
  for (let i = 1; i <= 8; i++) {
    const dt = new Date(y, m, d + i);
    const f = famOf(getShiftCodeForDate(sup, dt.getFullYear(), dt.getMonth(), dt.getDate()));
    if (f === 'c-M' || f === 'c-N') return { fam: f, working: false };
  }
  return { fam: 'c-M', working: false };
}

export function overviewHtml() {
  const pending = state.requests.filter(r => r.status.includes('รอ')).length;
  const all = getAllEmployees();
  const sizes = TEAM_KEYS.map(k => state.shiftsData[k].employees.length);
  const cross = state.requests.filter(r => r.isCrossShift && r.status.includes('รอ')).length;
  const t = state.managerConfig.shiftTimes;
  const time = code => (t[code] || '').split(' ')[0];
  const teams = TEAM_KEYS.map((k, i) => {
    const team = state.shiftsData[k];
    const sup = team.employees.find(e => e.id === team.supervisorId);
    const now = teamToday(team);
    const night = now.fam === 'c-N';
    const status = !now.working ? 'พักตามรอบ' : night ? `เริ่ม ${time('N').split('–')[0]} น.` : 'กำลังเข้ากะ';
    return { name: String(team.name).replace(/"/g, ''), shift: night ? 'กะดึก' : 'กะเช้า', hours: night ? time('N') : time('M'), sup: sup ? sup.name : '-', size: sizes[i], status, fam: now.fam, live: now.working && !night };
  });
  // ทีมที่กำลังเข้ากะอยู่ขึ้นก่อน แล้วตามด้วยทีมที่จะเริ่มกะดึก
  const order = r => (r.live ? 0 : r.fam === 'c-N' && r.status.startsWith('เริ่ม') ? 1 : 2);
  const rows = [...teams].sort((a, b) => order(a) - order(b));
  return `
    ${pageHead('ภาพรวมกำลังพล', `<span class="muted">${esc(DEMO_TODAY.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>`)}
    <section class="panel flush ov-now">
      <div class="panel-h pad"><h2>วันนี้ใครอยู่กะ</h2><button class="link" data-click="switchView('schedule')">ตารางเต็มเดือน</button></div>
      <div class="ov-head" aria-hidden="true"><span>ทีม</span><span>กะวันนี้</span><span>หัวหน้ากะ</span><span>กำลังพล</span><span>สถานะ</span></div>
      <ul class="ov-teams">
        ${rows.map(r => `<li class="${r.live ? 'live' : ''}">
          <b class="ov-name">${esc(r.name)}</b>
          <span class="ov-shift"><span class="chip ${r.fam}">${r.fam === 'c-N' ? 'N' : 'M'}</span>${esc(r.shift)} ${esc(r.hours)}</span>
          <span class="ov-sup"><span class="sr">หัวหน้ากะ </span>${esc(r.sup)}</span>
          <span class="ov-size"><b>${r.size}</b> คน</span>
          <span class="ov-status st ${r.live ? 'ok' : ''}">${esc(r.status)}</span>
        </li>`).join('')}
      </ul>
    </section>
    <p class="ov-sum">
      กำลังพลทั้งระบบ <b>${all.length}</b> คน (A ${sizes[0]} · B ${sizes[1]} · C ${sizes[2]} · D ${sizes[3]})
      <span aria-hidden="true">·</span> <button class="link" data-click="switchView('requests')">คำขอรอดำเนินการ <b>${pending}</b> รายการ</button>
      ${cross ? `<span aria-hidden="true">·</span> ข้ามชุดกะรอยืนยัน <b>${cross}</b> รายการ` : ''}
    </p>`;
}
