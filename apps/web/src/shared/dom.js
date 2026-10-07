export function h(tag, props={}, ...children) {
  const element=document.createElement(tag);
  for(const [key,value] of Object.entries(props)) {
    if(value===undefined||value===null||value===false) continue;
    if(key==='class') element.className=value;
    else if(key==='text') element.textContent=value;
    else if(key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='value') element.value=value;
    else if(key==='disabled'||key==='hidden'||key==='selected') element[key]=!!value;
    else element.setAttribute(key,String(value));
  }
  for(const child of children.flat(Infinity)) if(child!==null&&child!==undefined&&child!==false) element.append(child instanceof Node?child:document.createTextNode(String(child)));
  return element;
}
export function replace(target,...children) { target.replaceChildren(...children.flat().filter(Boolean)); }
export function date(value) { return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${value}T12:00:00+07:00`)); }
export function time(value) { return value?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(value)):'—'; }
export const roleLabel={MANAGER:'Manager',EMPLOYEE:'Shift employee',SUPERVISOR:'Supervisor',HR:'HR',EXTERNAL:'External user'};
export function accountLabel(actor) {return `${roleLabel[actor.role]}${['EMPLOYEE','SUPERVISOR'].includes(actor.role)?` ${{A:1,B:2,C:3,D:4}[actor.teamCode]??actor.teamCode} · ทีม ${actor.teamCode}`:''}`;}
export function initials(actor) {return {MANAGER:'MG',HR:'HR',EXTERNAL:'EX'}[actor.role]??actor.teamCode??'TNC';}
export const statusLabel={PENDING:'รออนุมัติ',APPROVED:'อนุมัติแล้ว',REJECTED:'ไม่อนุมัติ',CANCELLED:'ยกเลิกแล้ว'};
export const shiftLabel={M:'กะเช้า',N:'กะกลางคืน',O:'วันหยุด'};
export function shiftBadge(code) { return h('span',{class:`shift shift-${code.toLowerCase()}`},h('b',{},code),h('span',{},shiftLabel[code]??code)); }
export function errorBox(error,retry) { return h('div',{class:'notice error',role:'alert'},h('strong',{},error.message??'ไม่สามารถโหลดข้อมูล'),retry?h('button',{class:'btn secondary',onclick:retry},'ลองอีกครั้ง'):null); }
export function toast(message) { const el=document.getElementById('toast'); el.textContent=message; el.hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>{el.hidden=true;},4500); }
export function icon(name) {
  const paths={schedule:'M3 4h18v17H3z M3 9h18 M7 2v4 M17 2v4',requests:'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4',history:'M12 3a9 9 0 1 1-9 9 M3 3v6h6 M12 7v5l3 2',swap:'M4 7h16l-4-4 M20 17H4l4 4',logout:'M9 4H4v16h5 M12 12h9l-4-4 M21 12l-4 4',refresh:'M20 8a8 8 0 1 0 0 8 M20 3v5h-5',bell:'M6 9a6 6 0 0 1 12 0v7l2 2H4l2-2z M10 21h4',arrow:'M5 12h14 M14 7l5 5-5 5',close:'M6 6l12 12 M18 6L6 18',menu:'M4 6h16 M4 12h16 M4 18h16',people:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-3a4 4 0 0 0-3-3.9 M16 2.1a4 4 0 0 1 0 7.8',settings:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',truck:'M2 5h12v12H2z M14 9h5l3 4v4h-8 M7 19a2 2 0 1 0-4 0 2 2 0 0 0 4 0 M21 19a2 2 0 1 0-4 0 2 2 0 0 0 4 0',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',moon:'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5',check:'M5 12l4 4L19 6',left:'M19 12H5 M10 7l-5 5 5 5'};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',class:'icon'})) svg.setAttribute(k,v);
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]??paths.schedule);svg.append(path);return svg;
}
