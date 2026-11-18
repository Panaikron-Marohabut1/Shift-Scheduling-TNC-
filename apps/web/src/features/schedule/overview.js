/* ==========================================================================
   ภาพรวมกำลังพล (หัวหน้ากะ) — ตัวเลขจากตารางกะและคำขอจริงของวันนี้
   ========================================================================== */

import { DEMO_TODAY, state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { getAllEmployees, TEAM_KEYS } from '../../shared/scheduling/employees.js';
import { getShiftCodeForDate, getTeamForDate } from '../../shared/scheduling/roster.js';
import { pageHead } from '../../shared/ui.js';
import { famOf } from './codes.js';

// ดูกะของหัวหน้าทีมวันนี้ หรือใช้สมาชิกคนแรกเมื่อยังไม่มีหัวหน้าทีม
function teamShiftToday(employee) {
  if (!employee) return 'O';
  const y = DEMO_TODAY.getFullYear(), m = DEMO_TODAY.getMonth(), d = DEMO_TODAY.getDate();
  const family = famOf(getShiftCodeForDate(employee, y, m, d));
  return family === 'c-M' ? 'M' : family === 'c-N' ? 'N' : 'O';
}

export function overviewHtml() {
  const pending = state.requests.filter(r => r.status.includes('รอ')).length;
  const y = DEMO_TODAY.getFullYear(), m = DEMO_TODAY.getMonth(), d = DEMO_TODAY.getDate();
  const people = getAllEmployees().map(person => ({ person, team: getTeamForDate(person, y, m, d) }));
  const members = TEAM_KEYS.map(k => people.filter(row => row.team === `Shift ${k.slice(-1)}`).map(row => row.person));
  const sizes = members.map(team => team.length);
  const cross = state.requests.filter(r => r.isCrossShift && r.status.includes('รอ')).length;
  const t = state.managerConfig.shiftTimes;
  const time = code => (t[code] || '').split(' ')[0];
  const shiftLabels = { M: 'กะเช้า', N: 'กะดึก', O: 'วันหยุด' };
  const shiftOrder = { M: 0, N: 1, O: 2 };
  const teams = TEAM_KEYS.map((k, i) => {
    const team = state.shiftsData[k];
    const sup = members[i].find(e => e.id === team.supervisorId) || members[i].find(e => e.roleCategory === 'Shift Supervisor');
    const code = teamShiftToday(sup || members[i][0]);
    const hours = code === 'O' ? '' : time(code);
    const status = code === 'O' ? 'พักตามรอบ' : code === 'N' ? `เริ่ม ${hours.split('–')[0]} น.` : 'กำลังเข้ากะ';
    return { name: String(team.name).replace(/"/g, ''), code, hours, sup: sup ? sup.name : '-', size: sizes[i], status, live: code === 'M' };
  });
  // ทีมที่กำลังเข้ากะอยู่ขึ้นก่อน แล้วตามด้วยทีมที่จะเริ่มกะดึก
  const rows = teams.sort((a, b) => shiftOrder[a.code] - shiftOrder[b.code]);
  return `
    ${pageHead('ภาพรวมกำลังพล', `<span class="muted">${esc(DEMO_TODAY.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>`)}
    <section class="panel flush ov-now">
      <div class="panel-h pad"><h2>วันนี้ใครอยู่กะ</h2><button class="link" data-click="switchView('schedule')">ตารางเต็มเดือน</button></div>
      <div class="ov-head" aria-hidden="true"><span>ทีม</span><span>กะวันนี้</span><span>หัวหน้ากะ</span><span>กำลังพล</span><span>สถานะ</span></div>
      <ul class="ov-teams">
        ${rows.map(r => `<li class="${r.live ? 'live' : ''}">
          <b class="ov-name">${esc(r.name)}</b>
          <span class="ov-shift"><span class="chip ${famOf(r.code)}">${r.code}</span>${shiftLabels[r.code]}${r.hours ? ` ${esc(r.hours)}` : ''}</span>
          <span class="ov-sup"><span class="sr">หัวหน้ากะ </span>${esc(r.sup)}</span>
          <span class="ov-size"><b>${r.size}</b> คน</span>
          <span class="ov-status st ${r.live ? 'ok' : ''}">${esc(r.status)}</span>
        </li>`).join('')}
      </ul>
    </section>
    <p class="ov-sum">
      กำลังพลทั้งระบบ <b>${sizes.reduce((total, size) => total + size, 0)}</b> คน (A ${sizes[0]} · B ${sizes[1]} · C ${sizes[2]} · D ${sizes[3]})
      <span aria-hidden="true">·</span> <button class="link" data-click="switchView('requests')">คำขอรอดำเนินการ <b>${pending}</b> รายการ</button>
      ${cross ? `<span aria-hidden="true">·</span> ข้ามชุดกะรอยืนยัน <b>${cross}</b> รายการ` : ''}
    </p>`;
}
