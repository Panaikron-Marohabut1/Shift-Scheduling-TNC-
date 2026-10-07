import { api } from '../api/client.js';
import { ui,data } from './state.js';
import { profiles,allowedView,viewTitle } from './profiles.js';
import { h,replace,icon,accountLabel,initials,errorBox,time,toast } from '../shared/dom.js';
import { showLogin } from '../features/session/view.js';
import { scheduleView } from '../features/schedule/view.js';
import { overviewView } from '../features/schedule/overview.js';
import { swapView } from '../features/swap/view.js';
import { requestsView } from '../features/requests/view.js';
import { historyView } from '../features/history/view.js';
import { personalHistoryView } from '../features/history/personal-view.js';
import { peopleView,annualView,settingsView } from '../features/manager/view.js';
import { hrExportView,hrAuditView } from '../features/hr/view.js';
import { driverView } from '../features/external/view.js';

const root=document.getElementById('app');let stage,version=0;
function navigate(view,assignmentId=null) {
  if(ui.saving||!data.actor||!allowedView(data.actor,view))return;
  ui.view=view;ui.assignmentId=assignmentId;ui.drawer=false;shell();void render();
}
function onMonth(month) {ui.month=month;void render();}
function notificationItems(records) {
  return [h('h3',{},'การแจ้งเตือนของคุณ'),...records.slice(0,8).map(n=>h('button',{class:'notification',onclick:()=>navigate('requests')},h('strong',{},n.title),h('small',{},`${n.message} · ${time(n.created_at)}`))),records.length?null:h('p',{class:'muted'},'ยังไม่มีการแจ้งเตือน')];
}
async function logout() {
  if(ui.saving)return;
  try {await api('/auth/logout',{method:'POST'});data.actor=null;data.schedule=null;data.requests=[];data.notifications=[];version++;await showLogin(root,login);}catch(e){toast(e.message);}
}
function closeDrawer(focus=false) {
  ui.drawer=false;document.querySelector('.sidebar')?.classList.remove('open');document.querySelector('.sidebar-backdrop')?.classList.remove('open');
  const menu=document.querySelector('.mobile-menu');menu?.setAttribute('aria-expanded','false');if(focus)menu?.focus();
}
function shell() {
  const actor=data.actor,external=actor.role==='EXTERNAL',profile=profiles[actor.role];
  const sidebar=external?null:h('aside',{id:'sidebar',class:`sidebar ${ui.drawer?'open':''}`,'aria-label':'เมนูหลัก'},
    h('a',{class:'brand',href:'#main'},h('span',{class:'brand-mark'},icon('schedule')),h('span',{class:'brand-info'},h('strong',{},'Shift schedule TNC'),h('small',{},'ระบบจัดการตารางกะฝ่ายผลิต'))),
    h('div',{class:'sidebar-body'},h('nav',{},h('p',{class:'nav-section-title'},'เมนูการทำงาน'),...profile.nav.map(([view,label,symbol])=>h('button',{class:`nav-link ${ui.view===view||(view==='schedule'&&ui.view==='swap')?'active':''}`,onclick:()=>navigate(view),'aria-current':ui.view===view?'page':undefined},icon(symbol),label)))),
    h('div',{class:'sidebar-profile'},h('span',{class:'avatar'},initials(actor)),h('div',{},h('strong',{},actor.name),h('small',{},accountLabel(actor)))));
  stage=h('main',{id:'main',class:'page-content',tabindex:'-1'});
  const alerts=['EMPLOYEE','SUPERVISOR','MANAGER'].includes(actor.role)?h('details',{class:'notifications'},h('summary',{class:'icon-btn','aria-label':'เปิดการแจ้งเตือน',title:'การแจ้งเตือน'},icon('bell')),h('div',{class:'notification-popover'},...notificationItems(data.notifications))):null;
  const topbar=h('header',{class:'topbar'},h('div',{class:'topbar-left'},external?null:h('button',{class:'icon-btn mobile-menu','aria-label':'เปิดเมนู','aria-controls':'sidebar','aria-expanded':String(ui.drawer),onclick:event=>{
    ui.drawer=!ui.drawer;document.querySelector('.sidebar').classList.toggle('open',ui.drawer);document.querySelector('.sidebar-backdrop').classList.toggle('open',ui.drawer);event.currentTarget.setAttribute('aria-expanded',String(ui.drawer));
  }},icon('menu')),h('div',{},h('div',{class:'breadcrumb'},external?'Shift schedule TNC':'ฝ่ายผลิต',h('span',{},'/'),actor.role==='HR'?'ฝ่ายบุคคล':actor.teamName??accountLabel(actor)),h('p',{class:'topbar-title'},viewTitle(actor,ui.view)))),
    h('div',{class:'top-actions'},h('button',{class:'icon-btn','aria-label':'โหลดล่าสุด',title:'โหลดล่าสุด',onclick:()=>{if(!ui.saving){shell();void render();}}},icon('refresh')),alerts,
      h('button',{class:'btn account-switch','aria-label':'เปลี่ยนบัญชี',title:'เปลี่ยนบัญชีเดโม',onclick:logout},h('span',{class:'account-switch-label'},'เปลี่ยนบัญชี'),h('span',{},accountLabel(actor)),icon('logout')),h('span',{class:'avatar top-avatar',title:actor.name},initials(actor))));
  replace(root,h('div',{class:`app-layout ${external?'external-layout':''}`},external?null:h('button',{class:`sidebar-backdrop ${ui.drawer?'open':''}`,'aria-label':'ปิดเมนู',tabindex:'-1',onclick:()=>closeDrawer()}),sidebar,h('div',{class:'main-wrapper'},topbar,stage)));
}
async function login(actor) {
  data.actor=actor;ui.view=profiles[actor.role].initial;ui.month='2026-10';ui.year=2026;ui.teamFilter='ALL';ui.peopleSearch='';ui.peopleTeam='ALL';ui.drawer=false;ui.assignmentId=null;
  data.notifications=[];data.requests=[];data.schedule=null;shell();await render();
}
async function loadRecords(view) {
  if(view==='driver')return null;
  if(view==='requests')return api('/requests');
  if(view==='history'&&data.actor.role==='EMPLOYEE')return api('/audit?view=personal');
  if(view==='history'||view==='audit')return api('/audit?view=activity');
  if(view==='annual')return Promise.all(Array.from({length:12},(_,i)=>api(`/schedules?month=${ui.year}-${String(i+1).padStart(2,'0')}`)));
  return api(`/schedules?month=${ui.month}`);
}
async function render(background=false) {
  const stamp=++version,view=ui.view,actor=data.actor,container=stage;
  if(!actor)return;
  if(!background)replace(container,h('div',{class:'loading',role:'status'},'กำลังโหลดข้อมูลล่าสุด…'));
  try {
    if(view==='swap') {await swapView(container,ui.assignmentId,()=>navigate('requests'),()=>navigate('schedule'));return;}
    const [records,notifications,requests]=await Promise.all([
      loadRecords(view),['EMPLOYEE','SUPERVISOR','MANAGER'].includes(actor.role)?api('/notifications'):Promise.resolve([]),
      (view==='schedule'&&actor.role==='EMPLOYEE')||view==='overview'?api('/requests'):Promise.resolve([])
    ]);
    if(stamp!==version||data.actor?.userId!==actor.userId)return;
    data.notifications=notifications;
    function tableContent() {
      return scheduleView(actor,records,id=>navigate('swap',id),onMonth,requests,()=>navigate('requests'),ui.teamFilter,team=>{
        ui.teamFilter=team;if(ui.view==='schedule'&&data.actor?.userId===actor.userId){replace(container,tableContent());document.getElementById('team-filter')?.focus({preventScroll:true});}
      });
    }
    let content;
    if(view==='schedule') {data.schedule=records;content=tableContent();}
    else if(view==='requests') {data.requests=records;content=requestsView(actor,records,()=>navigate('requests'),()=>navigate('schedule'));}
    else if(view==='people')content=peopleView(records);
    else if(view==='annual')content=annualView(records,ui.year,year=>{ui.year=year;void render();},month=>{ui.month=month;navigate('schedule');});
    else if(view==='settings')content=settingsView(records,navigate);
    else if(view==='overview')content=overviewView(records,requests,onMonth,()=>navigate('requests'));
    else if(view==='export')content=hrExportView(records,onMonth);
    else if(view==='audit')content=hrAuditView(records);
    else if(view==='driver')content=driverView();
    else content=actor.role==='EMPLOYEE'?personalHistoryView(actor,records):historyView(records);
    replace(container,content);
    const popover=document.querySelector('.notification-popover');if(popover)replace(popover,...notificationItems(notifications));
  }catch(e){if(stamp===version&&data.actor)replace(container,errorBox(e,()=>render()));}
}
window.addEventListener('session-expired',()=>{if(data.actor){data.actor=null;version++;void showLogin(root,login);}});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&ui.drawer)closeDrawer(true);});
setInterval(()=>{
  const tag=document.activeElement?.tagName;
  if(data.actor&&['schedule','requests','history','audit','overview'].includes(ui.view)&&!ui.saving&&!document.querySelector('.decision-confirm')&&!document.querySelector('.employee-request-detail-button[aria-expanded="true"]')&&!document.querySelector('.month-popover:popover-open')&&!document.querySelector('.shift-swap-popover:popover-open')&&!['INPUT','SELECT','TEXTAREA'].includes(tag))void render(true);
},30000);
try {const session=await api('/me');await login(session.actor);}catch{await showLogin(root,login);}
