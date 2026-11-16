/* ==========================================================================
   ประวัติ — ประวัติจากฐานข้อมูล (/api/audit) รวมกับประวัติของรายการเดโมในเครื่อง
   พนักงานเห็นเหตุการณ์ของคำขอที่เกี่ยวข้อง และการเปลี่ยนแปลงกะของตนเอง
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc, js } from '../../shared/dom.js';
import { currentEmp } from '../../shared/scheduling/employees.js';
import { pageHead } from '../../shared/ui.js';
import { getVisibleRequests } from '../requests/permissions.js';
import { statusCls } from '../requests/list.js';
import { codeClass, shownCode } from '../schedule/codes.js';

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

// จัดกลุ่มประวัติตามคำขอ: หัวกลุ่มบอกว่าเป็นคำขออะไร ใครกับใคร และสถานะ แล้วเรียงเหตุการณ์ใต้หัว
const chipOf = code => `<span class="chip ${codeClass(code)}">${esc(shownCode(code))}</span>`;
function groupHead(request, log) {
  if (!request) {
    return log.requestId != null
      ? `<div class="hist-head"><div class="hist-top"><b class="hist-type">คำขอ #${esc(log.requestId)}</b></div><p class="hist-sub">ไม่อยู่ในรายการที่คุณดูได้</p></div>`
      : '<div class="hist-head"><div class="hist-top"><b class="hist-type">รายการอื่น ๆ</b></div><p class="hist-sub">การเปลี่ยนแปลงที่ไม่ผูกกับคำขอ</p></div>';
  }
  const me = currentEmp();
  const name = n => (me && n === me.name ? 'คุณ' : n);
  const swap = request.currentShift && request.currentShift !== '-';
  const open = request.status && request.status.includes('รอ');
  return `<button type="button" class="hist-head" data-click="openRequestDetails(${js(request.id)})">
      <span class="hist-top"><b class="hist-type">${esc(request.type)}</b><span class="hist-status ${open ? 'open' : ''} st ${statusCls(request)}">${esc(request.status)}</span></span>
      <span class="hist-sub"><span>${esc(request.date)}</span><span class="hist-people">${esc(name(request.person))}${request.targetPerson ? ` <span class="req-pair"><span class="req-arrow">${request.kind === 'leave' ? 'ให้' : '↔'}</span> ${esc(name(request.targetPerson))}</span>` : ''}</span>${swap ? `<span class="req-shift">${chipOf(request.currentShift)}<span aria-label="เป็น">→</span>${chipOf(request.targetShift)}</span>` : ''}</span>
    </button>`;
}

export function historyHtml(title) {
  const isEmp = state.activeRole === 'Shift Employee';
  const visibleRequests = getVisibleRequests();
  const logs = getVisibleAuditLogs(visibleRequests);
  const byKey = new Map(visibleRequests.map(request => [requestKey(request.api, request.id), request]));
  const groups = new Map();
  for (const log of logs) {
    const key = log.requestId != null ? requestKey(log.api, log.requestId) : 'none';
    if (!groups.has(key)) groups.set(key, { request: byKey.get(key), first: log, logs: [] });
    groups.get(key).logs.push(log);
  }
  return `
    ${pageHead(esc(title))}
    ${logs.length ? `<div class="hist">${[...groups.values()].map(g => `
      <section class="hist-group ${g.request && g.request.status && g.request.status.includes('รอ') ? 'open' : ''}">
        ${groupHead(g.request, g.first)}
        <ol class="hist-events">${g.logs.map(log => `
          <li><time class="hist-time"${log.at ? ` datetime="${esc(log.at)}"` : ''}>${esc(log.time)}</time><i class="hist-dot" aria-hidden="true"></i><div class="hist-body"><b>${esc(log.action)}</b><span class="hist-meta">${esc(log.actor)}<span class="hist-time-inline"> · ${esc(log.time)}</span></span>${isEmp ? changeDetails(log) : ''}</div></li>`).join('')}
        </ol>
      </section>`).join('')}</div>` : `<p class="empty">${isEmp ? 'ยังไม่มีประวัติการทำรายการ' : 'ยังไม่มีการเปลี่ยนแปลง'}</p>`}`;
}
