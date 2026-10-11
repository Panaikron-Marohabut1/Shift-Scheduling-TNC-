/* ==========================================================================
   หน้าผู้จัดการ: บันทึกข้อมูลเดโมแล้ววาดหน้าจอใหม่
   ========================================================================== */

import { saveLocal } from '../../app/state.js';

export let rerender = () => {};
export function onManagerChange(fn) { rerender = fn; }
export const changed = () => { saveLocal(); rerender(); };
