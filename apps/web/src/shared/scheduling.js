import { h, icon } from './dom.js';
import { monthPicker } from './month-picker.js';
export const teamCodes=['A','B','C','D'];
export function roster(assignments) {return [...new Map(assignments.map(a=>[a.employee_id,a])).values()].sort((a,b)=>a.team_code.localeCompare(b.team_code)||a.employee_id-b.employee_id);}
export function disabledButton(label,reason='รอเชื่อมข้อมูล',symbol) {return h('button',{class:'btn secondary unavailable',disabled:true,title:reason},symbol?icon(symbol):null,label);}
export function heading(title,description,...tools) {return h('div',{class:'page-heading'},h('div',{},h('h1',{},title),h('p',{class:'muted'},description)),...tools);}
export function section(title,description,...body) {return h('section',{class:'panel'},h('div',{class:'panel-heading'},h('div',{},h('h2',{},title),h('p',{class:'muted'},description))),...body);}
export function dataTable(labels,body,caption) {return h('div',{},h('div',{class:'table-scroll',tabindex:'0','aria-label':'เลื่อนเพื่อดูข้อมูลทั้งหมด'},h('table',{class:'data-table'},h('caption',{class:'sr-only'},caption),h('thead',{},h('tr',{},...labels.map(label=>h('th',{scope:'col'},label)))),body)),h('p',{class:'table-scroll-hint'},'เลื่อนซ้าย–ขวาเพื่อดูรายละเอียดทุกคอลัมน์'));}
export const monthControl=monthPicker;
export function teamSummary(assignments) {
  const people=roster(assignments);
  return h('div',{class:'people-summary','aria-label':'สรุปสมาชิกกะในข้อมูลทดสอบ'},...[[`สมาชิกกะทั้งหมด`,people.length],...teamCodes.map(code=>[`ทีม ${code}`,people.filter(a=>a.team_code===code).length])].map(([label,count])=>h('div',{class:'people-stat'},h('span',{},label),h('strong',{},count),h('small',{},'คน'))));
}
