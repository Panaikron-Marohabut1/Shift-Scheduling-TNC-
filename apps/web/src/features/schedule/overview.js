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
    return [team.name, night ? 'กะดึก' : 'กะเช้า', night ? time('N') : time('M'), sup ? sup.name : '-', sizes[i], status, now.fam];
  });
  return `
    ${pageHead('ภาพรวมกำลังพล', `<span class="muted">วันที่ ${esc(DEMO_TODAY.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }))}</span>`)}
    <div class="kpis kpis3">
      <button class="kpi" data-click="switchView('schedule')"><span>กำลังพลรวมทั้งระบบ</span><b>${all.length} คน</b><small>Shift A (${sizes[0]}) · B (${sizes[1]}) · C (${sizes[2]}) · D (${sizes[3]})</small></button>
      <button class="kpi" data-click="switchView('requests')"><span>คำขอรอดำเนินการ</span><b class="${pending ? 'warn' : ''}">${String(pending).padStart(2, '0')} รายการ</b><small>สลับกะ / ขอลา / เปลี่ยนวันหยุด</small></button>
      <button class="kpi" data-click="switchView('requests')"><span>คำขอสลับข้ามชุดกะ</span><b>${String(cross).padStart(2, '0')} รายการ</b><small>รอการยืนยันจากหัวหน้ากะทั้ง 2 ฝ่าย</small></button>
    </div>
    <section class="panel flush">
      <div class="panel-h pad"><h2>สถานะกะการทำงานวันนี้</h2><button class="link" data-click="switchView('schedule')">ดูตารางเต็มเดือน</button></div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>ชุดกะ</th><th>กะ</th><th>หัวหน้ากะ</th><th class="num">กำลังพล</th><th>สถานะ</th></tr></thead>
          <tbody>
            ${teams.map(r => `<tr><th scope="row">${esc(r[0])}</th><td><span class="sw"><i class="cd ${r[6]}"></i>${r[1]} ${esc(r[2])}</span></td><td>${esc(r[3])}</td><td class="num">${r[4]} คน <small>หัวหน้ากะ 1 + พนักงานกะ ${Math.max(0, r[4] - 1)}</small></td><td><span class="st ${r[5] === 'กำลังเข้ากะ' ? 'ok' : ''}">${r[5]}</span></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}
