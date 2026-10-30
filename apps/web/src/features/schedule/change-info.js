/* ==========================================================================
   ช่องกะที่ถูกเปลี่ยน: เปลี่ยนเพราะคำขอไหน ใครกับใคร และใครอนุมัติ
   --------------------------------------------------------------------------
   คำขอเดโม (LOCAL) จดช่องที่เปลี่ยนไว้ใน req.applied ตอนอนุมัติ
   คำขอสลับกะจากฐานข้อมูล ดูจากผู้ยื่น/คู่สลับ และวันที่ของคำขอที่อนุมัติแล้ว
   ========================================================================== */

import { state } from '../../app/state.js';
import { esc } from '../../shared/dom.js';

// คำขอที่อนุมัติแล้วซึ่งทำให้ช่องนี้เปลี่ยน (ล่าสุดก่อน)
export function changeSource(emp, y, m, d) {
  const approved = state.requests.filter(r => r.status === 'อนุมัติแล้ว');
  const local = approved.find(r => !r.api && (r.applied || []).some(a => a.empId === emp.id && a.y === y && a.m === m && a.d === d));
  if (local) return local;
  return approved.find(r => r.api && r.y === y && r.m === m && r.day === d && (r.requesterId === emp.id || r.targetId === emp.id)) || null;
}

const approvedBy = req => (req.approvers || []).filter(a => a.status === 'approved').map(a => `${a.role}${a.at ? ` (${a.at})` : ''}`).join(' · ');

// แถวในหน้าต่างช่องกะ (อยู่ใน <dl class="facts plain">)
export function changeInfoRows(req, emp, y, m, d) {
  if (!req) return '';
  const others = [req.person, req.targetPerson, ...(req.helpers || []).map(h => h.name)].filter(n => n && n !== emp.name);
  const applied = (req.applied || []).find(a => a.empId === emp.id && a.y === y && a.m === m && a.d === d);
  return `
    <div><dt>เปลี่ยนตามคำขอ</dt><dd>${esc(req.type)} · ยื่นโดย ${esc(req.person)} เมื่อ ${esc(req.submittedAt)}</dd></div>
    ${others.length ? `<div><dt>คนที่เกี่ยวข้อง</dt><dd>${esc(others.join(', '))}</dd></div>` : ''}
    ${applied ? `<div><dt>กะเดิม → ใหม่</dt><dd>${esc(applied.from || applied.prev || 'ตามตารางเดิม')} → ${esc(applied.code)}</dd></div>` : ''}
    <div><dt>รายละเอียด</dt><dd>${esc(req.reason)}</dd></div>
    <div><dt>อนุมัติโดย</dt><dd>${esc(approvedBy(req) || '-')}</dd></div>`;
}
