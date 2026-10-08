import { h, icon, accountLabel, initials, errorBox, replace } from '../../shared/dom.js';
import { api } from '../../api/client.js';
export async function showLogin(root,onLogin) {
  const list=h('div',{class:'account-list',role:'group','aria-label':'บัญชีทดสอบ'});
  const message=h('div',{'aria-live':'polite'});
  replace(root,h('main',{id:'main',class:'login'},
    h('header',{class:'login-header'},h('div',{class:'brand'},h('img',{class:'brand-logo',src:'/assets/tnc-logo.png',alt:'','aria-hidden':'true'}),h('span',{class:'brand-info'},h('strong',{},'Shift schedule TNC'),h('small',{},'ระบบจัดการตารางกะฝ่ายผลิต'))),h('p',{},'Alpha Demo · ข้อมูลสมมติเท่านั้น')),
    h('section',{class:'login-panel'},h('div',{class:'login-intro'},h('h1',{},'เลือกบัญชีเพื่อเริ่มใช้งาน'),h('p',{class:'muted'},'เลือกพนักงานเพื่อยื่นคำขอ หรือหัวหน้าทีมเพื่อทดลองอนุมัติ')),message,list,
      h('p',{class:'login-note'},'ระบบ Login บริษัทและ Power Apps อยู่ระหว่างรอข้อมูลยืนยัน เดโมนี้ใช้ข้อมูลทดสอบเท่านั้น'))));
  async function load() {
    replace(list,h('p',{role:'status',class:'muted'},'กำลังโหลดบัญชี…'));
    try {
      const accounts=await api('/demo/accounts');
      if(!accounts.length){replace(list,h('div',{class:'notice'},'ยังไม่มีบัญชีทดสอบ กรุณาให้ทีมเตรียมข้อมูลเดโมก่อนเริ่มใช้งาน'));return;}
      accounts.sort((a,b)=>a.demoOrder-b.demoOrder);
      const groups={MANAGER:['Manager','ติดตามภาพรวม'],SUPERVISOR:['Supervisor','ตรวจและอนุมัติคำขอ'],EMPLOYEE:['Shift employee','ยื่นคำขอสลับกะ'],HR:['HR','ตารางรวมและข้อมูล'],EXTERNAL:['External user','ตารางรับส่ง']};
      replace(list,...['MANAGER','SUPERVISOR','EMPLOYEE','HR','EXTERNAL'].filter(role=>accounts.some(actor=>actor.role===role)).map(role=>h('section',{class:'account-group','aria-labelledby':`account-role-${role}`},
        h('div',{class:'account-group-heading'},h('h2',{id:`account-role-${role}`},groups[role][0]),h('p',{},groups[role][1])),
        h('div',{class:'account-group-options'},...accounts.filter(actor=>actor.role===role).map(actor=>h('button',{type:'button',class:'account',onclick:async event=>{
        list.querySelectorAll('button').forEach(b=>b.disabled=true); event.currentTarget.setAttribute('aria-busy','true'); replace(message);
        try {const session=await api('/demo/session',{method:'POST',body:{userId:actor.userId}});await onLogin(session.actor);}
        catch(e) {replace(message,errorBox(e));list.querySelectorAll('button').forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');});}
      }},h('span',{class:'avatar','aria-hidden':'true'},initials(actor)),h('span',{class:'account-identity'},h('strong',{},accountLabel(actor)),h('small',{},actor.name)),icon('arrow'))))
      )));
    } catch(e) {replace(list,errorBox(e,load));}
  }
  await load();
}
