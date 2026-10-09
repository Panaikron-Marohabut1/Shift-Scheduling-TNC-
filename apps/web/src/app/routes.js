/* ==========================================================================
   เลือกหน้าที่จะแสดงตามบทบาทผู้ใช้และเมนูที่กดอยู่
   ========================================================================== */

import { titleOf } from './shell.js';
import { state } from './state.js';
import { isSupervisorRoleName } from '../shared/scheduling/employees.js';
import { driverHtml } from '../features/external/view.js';
import { historyHtml } from '../features/history/view.js';
import { hrHtml } from '../features/hr/view.js';
import { annualHtml } from '../features/manager/annual.js';
import { peopleHtml } from '../features/manager/people.js';
import { settingsHtml } from '../features/manager/settings.js';
import { requestsHtml } from '../features/requests/list.js';
import { myHtml } from '../features/schedule/my-shift.js';
import { overviewHtml } from '../features/schedule/overview.js';
import { scheduleHtml } from '../features/schedule/page.js';

export function viewHtml() {
  const r = state.activeRole, v = state.activeView;
  if (r === 'Contractor / Van Driver') return driverHtml();
  if (isSupervisorRoleName(r)) {
    if (v === 'schedule') return scheduleHtml();
    if (v === 'my-shift') return myHtml();
    if (v === 'overview') return overviewHtml();
    if (v === 'requests' || v === 'my-requests') return requestsHtml(titleOf('requests') || 'คำขอ');
    if (v === 'history') return historyHtml(titleOf('history'));
  } else if (r === 'Shift Employee') {
    if (v === 'schedule') return scheduleHtml();
    if (v === 'team-schedule') return state.operatorShowFullGrid ? scheduleHtml() : myHtml();
    if (v === 'my-requests') return requestsHtml(titleOf('my-requests'));
    if (v === 'my-history') return historyHtml(titleOf('my-history'));
  } else if (r === 'HR') {
    if (v === 'schedule') return scheduleHtml();
    if (v === 'hr-export') return hrHtml();
    if (v === 'hr-audit') return historyHtml(titleOf('hr-audit'));
  } else if (r === 'Manager') {
    if (v === 'manager-monitoring') return requestsHtml(titleOf('manager-monitoring'));
    if (v === 'people') return peopleHtml();
    if (v === 'annual-schedule') return annualHtml();
    if (v === 'schedule') return scheduleHtml();
    if (v === 'manager-settings') return settingsHtml();
  }
  return '';
}
