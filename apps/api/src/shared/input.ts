import { BadRequestException } from '@nestjs/common';
export function id(value: unknown, label='รหัสรายการ'): number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1) throw new BadRequestException({code:'INVALID_INPUT', message:`${label}ไม่ถูกต้อง`});
  return value;
}
export function pathId(value: string) { if(!/^\d+$/.test(value)) return id(null); return id(Number(value)); }
export function text(value: unknown, max=500): string {
  if(value===undefined||value===null) return '';
  if(typeof value!=='string'||value.length>max) throw new BadRequestException({code:'INVALID_INPUT',message:'ข้อความไม่ถูกต้องหรือยาวเกินกำหนด'});
  return value.trim();
}
