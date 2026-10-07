export class ApiError extends Error { constructor(message,status,code,details) { super(message);this.status=status;this.code=code;this.details=details; } }
export async function api(path,{method='GET',body,key}={}) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(`/api${path}`,{method,credentials:'same-origin',signal:controller.signal,headers:{...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const payload=await response.json();
    if(!response.ok) { if(response.status===401) window.dispatchEvent(new Event('session-expired')); throw new ApiError(payload.message??'ไม่สามารถดำเนินการได้',response.status,payload.code,payload); }
    return payload;
  } catch(e) {
    if(e instanceof ApiError) throw e;
    throw new ApiError('เชื่อมต่อไม่สำเร็จ ตรวจว่าแอปและ PostgreSQL ยังเปิดอยู่ แล้วลองอีกครั้ง',0,'NETWORK_ERROR');
  } finally { clearTimeout(timeout); }
}
