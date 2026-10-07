import { h,replace,icon,shiftBadge } from '../../shared/dom.js';
let instance=0;

// The search query is UI state; only a selected assignment is sent to the API.
export function partnerPicker(candidates,onSelect,hours) {
  const id=`partner-picker-${++instance}`;
  let selected=null,visible=candidates,active=-1,disabled=false;
  const label=b=>`${b.name} · ${b.team_name} · ${b.shift_name}`;
  const content=h('span',{class:'partner-trigger-content'},'เลือกพนักงานที่ต้องการสลับ');
  const trigger=h('button',{type:'button',class:'partner-trigger','aria-label':'เลือกคู่สลับ','aria-haspopup':'dialog','aria-expanded':'false',popovertarget:id},content,h('span',{class:'partner-chevron'},icon('arrow')));
  const list=h('div',{id:`${id}-list`,role:'listbox','aria-label':'รายชื่อคู่สลับ',class:'partner-list'});
  const status=h('p',{class:'partner-count',role:'status'});
  const search=h('input',{type:'search',role:'combobox','aria-label':'ค้นหาคู่สลับ','aria-controls':list.id,'aria-expanded':'false','aria-autocomplete':'list',autocomplete:'off',placeholder:'ค้นหาชื่อหรือรหัสพนักงาน',oninput:()=>{
    const query=search.value.trim().toLocaleLowerCase('th');
    visible=candidates.filter(b=>`${b.name} ${b.employee_code} ${b.team_name}`.toLocaleLowerCase('th').includes(query));
    active=visible.length?0:-1;render();
  },onkeydown:event=>{
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();
      if(visible.length){active=event.key==='Home'?0:event.key==='End'?visible.length-1:(active+(event.key==='ArrowDown'?1:-1)+visible.length)%visible.length;highlight();}
    }else if(event.key==='Enter') {
      event.preventDefault();if(visible[active])choose(visible[active]);
    }else if(event.key==='Escape') {
      event.preventDefault();event.stopPropagation();popup.hidePopover();trigger.focus();
    }else if(event.key==='Tab')popup.hidePopover();
  }});
  const popup=h('div',{id,popover:'auto',role:'dialog','aria-label':'เลือกคู่สลับ',class:'partner-popover',onbeforetoggle:event=>{
    if(event.newState==='open') {
      search.value='';visible=candidates;active=Math.max(0,candidates.indexOf(selected));list.style.maxHeight='240px';render();
      const bounds=trigger.getBoundingClientRect(),width=Math.min(bounds.width,window.innerWidth-24);
      popup.style.width=`${width}px`;popup.style.left=`${Math.max(12,Math.min(bounds.left,window.innerWidth-width-12))}px`;
      popup.style.top=`${bounds.bottom+6}px`;
    }
  },ontoggle:event=>{
    const open=event.newState==='open';trigger.setAttribute('aria-expanded',String(open));search.setAttribute('aria-expanded',String(open));
    if(open) {
      position();
      search.focus({preventScroll:true});highlight();
    }else search.removeAttribute('aria-activedescendant');
  }},h('div',{class:'partner-search'},search,icon('people')),list,status);
  trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!disabled)popup.showPopover();}});
  function position() {
    const bounds=trigger.getBoundingClientRect(),height=popup.getBoundingClientRect().height;
    const below=window.innerHeight-bounds.bottom-18,above=bounds.top-18,opensBelow=below>=height||below>=above;
    list.style.maxHeight=`${Math.max(72,Math.min(240,(opensBelow?below:above)-102))}px`;
    const fitted=popup.getBoundingClientRect().height;
    popup.style.top=`${Math.max(12,Math.min(opensBelow?bounds.bottom+6:bounds.top-fitted-6,window.innerHeight-fitted-12))}px`;
  }
  function highlight() {
    list.querySelectorAll('[role="option"]').forEach((option,i)=>option.classList.toggle('active',i===active));
    const option=list.children[active];
    if(option?.getAttribute('role')==='option'){search.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
    else search.removeAttribute('aria-activedescendant');
  }
  function render() {
    replace(list,...visible.map((b,i)=>h('button',{id:`${id}-option-${b.assignment_id}`,type:'button',role:'option',tabindex:'-1','aria-label':label(b),'aria-selected':String(b.assignment_id===selected?.assignment_id),class:'partner-list-option',onclick:()=>choose(b),onpointermove:()=>{active=i;highlight();}},
      h('span',{class:'partner-person'},h('strong',{},b.name),h('small',{},`${b.employee_code} · ${b.team_name}`)),h('span',{class:'partner-shift'},shiftBadge(b.shift_code),h('small',{},hours(b))))));
    if(!visible.length)list.append(h('p',{class:'partner-no-results'},'ไม่พบชื่อหรือรหัสที่ค้นหา'));
    status.textContent=`${visible.length} คน${search.value.trim()?` จาก ${candidates.length} คน`:''}`;
    if(popup.matches(':popover-open'))position();highlight();
  }
  function choose(b) {
    if(disabled)return;selected=b;
    replace(content,h('span',{class:'partner-person'},h('strong',{},b.name),h('small',{},`${b.employee_code} · ${b.team_name}`)),h('span',{class:'partner-shift'},shiftBadge(b.shift_code),h('small',{},hours(b))));
    trigger.classList.add('has-selection');popup.hidePopover();trigger.focus();onSelect(b);
  }
  return {element:h('div',{class:'partner-picker'},trigger,popup),setDisabled(value){disabled=value;trigger.disabled=value;if(value&&popup.matches(':popover-open'))popup.hidePopover();},reset(){selected=null;replace(content,'เลือกพนักงานที่ต้องการสลับ');trigger.classList.remove('has-selection');}};
}
