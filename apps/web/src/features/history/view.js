/* ==========================================================================
   ประวัติ — ประวัติจากฐานข้อมูล (/api/audit) รวมกับประวัติของรายการเดโมในเครื่อง
   พนักงานเห็นเหตุการณ์ของคำขอที่เกี่ยวข้อง และการเปลี่ยนแปลงกะของตนเอง
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { currentEmp } from '../../shared/scheduling/employees.js';
import { pageHead } from '../../shared/ui.js';
import { getVisibleRequests } from '../requests/permissions.js';

export function getVisibleAuditLogs(visibleRequests = getVisibleRequests()) {
  if (state.activeRole !== 'Shift Employee') return state.auditLogs;
  const me = currentEmp();
  const localIds = new Set(visibleRequests.filter(request => !request.api).map(request => request.id));
  return state.auditLogs.flatMap(log => {
    if (log.api) return [log];
    if (me && localIds.has(log.requestId) && log.employeeAction) {
      const changes = (log.changes || []).filter(change => change.empId === me.id);
      const action = changes.length ? log.rosterAction : log.employeeAction;
      return [{ ...log, action, changes }];
    }
    return log.userId === state.actor.userId || (me && (log.employeeId === me.id || log.actor === me.name)) ? [log] : [];
  });
}

const workDateLabel = date => new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric'
});

const requestKey = (api, id) => `${!!api}:${id}`;
const changeDetails = log => (log.changes || []).map(change =>
  `<small>${esc(workDateLabel(change.workDate))} · ${esc(change.from)} → ${esc(change.to)}</small>`).join('');

export function historyHtml(title) {
  const isEmp = state.activeRole === 'Shift Employee';
  const visibleRequests = getVisibleRequests();
  const logs = getVisibleAuditLogs(visibleRequests);
  const requestKeys = new Set(visibleRequests.map(request => requestKey(request.api, request.id)));
  const requestLink = log => requestKeys.has(requestKey(log.api, log.requestId))
    ? `<button class="btn sm" data-click="openRequestDetails(${js(log.requestId)})">ดูคำขอ${log.api ? ` #${esc(log.requestId)}` : ''}</button>`
    : (log.requestId && log.api ? `<small>คำขอ #${esc(log.requestId)}</small>` : '');
  return `
    ${pageHead(esc(title))}
    ${logs.length ? `
      <div class="panel flush tbl-wrap">
        <table class="tbl log ${isEmp ? 'personal-history' : ''}">
          <thead><tr><th scope="col">เวลา</th><th scope="col">ผู้ทำรายการ</th><th scope="col">รายการ</th><th scope="col" class="act" aria-label="คำขอ"></th></tr></thead>
          <tbody>${logs.map(log => `<tr><td class="muted"><time${log.at ? ` datetime="${esc(log.at)}"` : ''}>${esc(log.time)}</time></td><td>${esc(log.actor)}</td>
            <td>${esc(log.action)}${isEmp ? changeDetails(log) : ''}</td>
            <td class="act">${requestLink(log)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : `<p class="empty">${isEmp ? 'ยังไม่มีประวัติการทำรายการ' : 'ยังไม่มีการเปลี่ยนแปลง'}</p>`}`;
}
