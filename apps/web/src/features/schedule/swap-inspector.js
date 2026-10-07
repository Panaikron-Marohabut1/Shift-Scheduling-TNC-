import { h,replace,date,icon,shiftBadge } from '../../shared/dom.js';
let sequence=0;
export function swapInspector() {
  const id=`shift-swap-${++sequence}`;
  let active=null,pinned=false,timer,ignoreFocus=false,opening=false,resizeController;
  const popup=h('div',{id,popover:'auto',role:'dialog','aria-label':'รายละเอียดการสลับกะ',class:'shift-swap-popover',
    onpointerenter:()=>clearTimeout(timer),onpointerleave:()=>later(),
    onkeydown:event=>{if(event.key==='Escape'){event.preventDefault();dismiss(true);}},
    onbeforetoggle:event=>{
      if(event.newState==='closed'){ignoreFocus=true;queueMicrotask(()=>{ignoreFocus=false;});}
    },
    ontoggle:event=>{
      active?.setAttribute('aria-expanded',String(event.newState==='open'));
      resizeController?.abort();
      if(event.newState==='open') {position();resizeController=new AbortController();window.addEventListener('resize',position,{signal:resizeController.signal});}
      else {pinned=false;clearTimeout(timer);}
    }});
  function position() {
    if(!active||!popup.matches(':popover-open'))return;
    const anchor=active.getBoundingClientRect(),bounds=popup.getBoundingClientRect();
    popup.style.left=`${Math.max(12,Math.min(anchor.left+(anchor.width-bounds.width)/2,innerWidth-bounds.width-12))}px`;
    const below=anchor.bottom+8,above=anchor.top-bounds.height-8;
    popup.style.top=`${Math.max(12,Math.min(below+bounds.height<=innerHeight-12?below:above,innerHeight-bounds.height-12))}px`;
  }
  function dismiss(restore=false) {
    clearTimeout(timer);pinned=false;
    ignoreFocus=true;
    if(popup.matches(':popover-open'))popup.hidePopover();
    active?.setAttribute('aria-expanded','false');
    if(restore&&active)active.focus({preventScroll:true});
    queueMicrotask(()=>{ignoreFocus=false;});
  }
  function later() {
    clearTimeout(timer);
    if(!pinned)timer=setTimeout(()=>{
      if(!popup.matches(':hover')&&!popup.contains(document.activeElement)&&document.activeElement!==active)dismiss();
    },200);
  }
  function open(trigger,row,lock=false) {
    clearTimeout(timer);
    // Native popover focus restoration can re-enter this handler while showing.
    if(opening)return;
    if(pinned&&!lock&&active!==trigger)return;
    if(active===trigger&&popup.matches(':popover-open')) {
      if(lock){pinned=true;popup.querySelector('.shift-swap-close').focus({preventScroll:true});}
      return;
    }
    opening=true;
    try {
    if(active!==trigger){active?.setAttribute('aria-expanded','false');active=trigger;}
    pinned=lock;
    const swap=row.swap;
    replace(popup,h('div',{class:'shift-swap-heading'},h('span',{},icon('swap'),'สลับกับ'),h('button',{type:'button',class:'shift-swap-close','aria-label':'ปิดรายละเอียดการสลับกะ',onclick:()=>dismiss(true)},icon('close'))),
      h('strong',{class:'shift-swap-partner'},swap.partner.name),h('p',{class:'shift-swap-team'},swap.partner.teamName),
      h('div',{class:'shift-swap-change'},h('span',{},h('small',{},'กะเดิม'),shiftBadge(swap.originalShiftCode)),icon('arrow'),h('span',{},h('small',{},'กะใหม่'),shiftBadge(swap.receivedShiftCode))));
    if(!popup.matches(':popover-open'))popup.showPopover();
    trigger.setAttribute('aria-expanded','true');position();
    if(lock)popup.querySelector('.shift-swap-close').focus({preventScroll:true});
    }finally {opening=false;}
  }
  function attach(trigger,row,badge=trigger,onSelect=null) {
    const mark=h('span',{class:'shift-swap-mark','aria-hidden':'true'},icon('swap'));
    badge.classList.add('has-swap');
    const details=onSelect?h('button',{type:'button',class:'shift-swap-detail','data-swap-detail':row.assignment_id},mark):null;
    if(!details)badge.append(mark);
    bind(trigger,onSelect);
    if(details)bind(details);
    return details;
    function bind(control,select=null) {
    let pointerFocus=false;
    control.dataset.swapRequest=String(row.swap.requestId);
    control.setAttribute('aria-label',select?`${date(row.work_date)} ${row.shift_name} สลับกะแล้ว ขอสลับกะ`:`${date(row.work_date)} ${row.name} สลับกะแล้ว ดูรายละเอียดคู่สลับ`);
    control.setAttribute('aria-haspopup','dialog');control.setAttribute('aria-expanded','false');control.setAttribute('aria-controls',id);
    control.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')open(control,row);});
    control.addEventListener('pointerleave',later);
    // Wait for the click on touch: opening on pointer focus can cover the cell
    // before the gesture finishes when the partner name makes the popup tall.
    control.addEventListener('pointerdown',()=>{pointerFocus=true;});
    control.addEventListener('pointerup',()=>{pointerFocus=false;});
    control.addEventListener('pointercancel',()=>{pointerFocus=false;});
    control.addEventListener('focus',()=>{
      if(ignoreFocus||pointerFocus)return;
      // A different native popover may still be showing/restoring focus.
      // Finish that operation before opening, and only if this cell kept focus.
      queueMicrotask(()=>{if(control.isConnected&&document.activeElement===control)open(control,row);});
    });
    control.addEventListener('blur',later);
    control.addEventListener('click',()=>{if(select){dismiss();select(row.assignment_id);}else open(control,row,true);});
    control.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dismiss(true);}});
    }
  }
  return {popup,attach,dismiss};
}
