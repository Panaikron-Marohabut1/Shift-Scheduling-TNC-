/* ==========================================================================
   ประวัติ — ประวัติจากฐานข้อมูล (/api/audit) รวมกับประวัติของรายการเดโมในเครื่อง
   พนักงานเห็นเฉพาะรายการของตัวเอง
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';
import { currentEmp } from '../../shared/scheduling/employees.js';
import { pageHead } from '../../shared/ui.js';

export function getVisibleAuditLogs() {
  if (state.activeRole !== 'Shift Employee') return state.auditLogs;
  const me = currentEmp();
  return state.auditLogs.filter(l => l.userId === state.actor.userId || (me && (l.employeeId === me.id || l.actor === me.name)));
}

export function historyHtml(title) {
  const isEmp = state.activeRole === 'Shift Employee';
  const logs = getVisibleAuditLogs();
  return `
    ${pageHead(esc(title))}
    ${logs.length ? `
      <div class="panel flush tbl-wrap">
        <table class="tbl log">
          <thead><tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>รายการ</th></tr></thead>
          <tbody>${logs.map(l => `<tr><td class="nowrap muted">${esc(l.time)}</td><td class="nowrap">${esc(l.actor)}</td><td>${esc(l.action)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : `<p class="empty">${isEmp ? 'ยังไม่มีประวัติการทำรายการ' : 'ยังไม่มีการเปลี่ยนแปลง'}</p>`}`;
}
