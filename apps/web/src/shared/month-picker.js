import { h,icon } from './dom.js';
let instance=0;
export function monthPicker(month,onMonth) {
  const id=`month-picker-${++instance}`,year=Number(month.slice(0,4)),index=Number(month.slice(5))-1;
  const label=value=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(`${value}-01T12:00:00+07:00`));
  const previous=`${year}-${String(index).padStart(2,'0')}`,next=`${year}-${String(index+2).padStart(2,'0')}`;
  const trigger=h('button',{type:'button',class:'month-trigger','aria-label':'เลือกเดือน','aria-haspopup':'dialog','aria-expanded':'false',popovertarget:id},icon('schedule'),h('span',{},label(month)));
  const choices=Array.from({length:12},(_,i)=>{
    const value=`${year}-${String(i+1).padStart(2,'0')}`,available=value>='2026-09'&&value<='2026-11';
    return h('button',{type:'button',class:`month-option ${value===month?'selected':''}`,disabled:!available,'aria-label':label(value),'aria-pressed':String(value===month),onclick:()=>{popup.hidePopover();if(value!==month)onMonth(value);}},new Intl.DateTimeFormat('th-TH',{month:'short'}).format(new Date(year,i,1)));
  });
  const popup=h('div',{id,popover:'auto',role:'dialog','aria-label':'เลือกเดือน',class:'month-popover',onbeforetoggle:event=>{
    if(event.newState==='open') {
      const bounds=trigger.getBoundingClientRect(),width=Math.min(296,window.innerWidth-24);
      popup.style.left=`${Math.max(12,Math.min(bounds.right-width,window.innerWidth-width-12))}px`;
      popup.style.top=`${bounds.bottom+8+254>window.innerHeight?Math.max(12,bounds.top-254):bounds.bottom+8}px`;
    }
  },ontoggle:event=>{
    trigger.setAttribute('aria-expanded',String(event.newState==='open'));
    if(event.newState==='open') {
      const bounds=trigger.getBoundingClientRect(),height=popup.getBoundingClientRect().height;
      const desired=bounds.bottom+8+height<=window.innerHeight-12?bounds.bottom+8:bounds.top-height-8;
      popup.style.top=`${Math.max(12,Math.min(desired,window.innerHeight-height-12))}px`;
      choices[index]?.focus({preventScroll:true});
    }
  },onkeydown:event=>{
    if(event.key==='Escape'){popup.hidePopover();trigger.focus();}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();const current=choices.indexOf(document.activeElement),step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[event.key];
      const option=choices[current+step];if(option&&!option.disabled)option.focus();
    }
  }},h('div',{class:'month-popover-heading'},h('strong',{},`พ.ศ. ${year+543}`),h('button',{type:'button',class:'month-close','aria-label':'ปิดตัวเลือกเดือน',onclick:()=>{popup.hidePopover();trigger.focus();}},icon('close'))),h('div',{class:'month-options'},...choices),h('p',{class:'month-availability'},'มีตารางเดือน ก.ย.–พ.ย. 2569'));
  return h('div',{class:'month-picker','data-month':month},trigger,h('div',{class:'month-navigation',role:'group','aria-label':'เลื่อนเดือน'},h('button',{type:'button',class:'month-arrow','aria-label':'เดือนก่อนหน้า',disabled:previous<'2026-09'||previous>'2026-11',onclick:()=>onMonth(previous)},icon('left')),h('button',{type:'button',class:'month-arrow','aria-label':'เดือนถัดไป',disabled:next<'2026-09'||next>'2026-11',onclick:()=>onMonth(next)},icon('arrow'))),popup);
}
