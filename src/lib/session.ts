import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
const COOKIE='gt_session';
export const SESSION_MAX_AGE=7*24*60*60;
function signingKey(){const k=process.env.SESSION_SECRET;if(!k || k.length<32) throw Error('SESSION_SECRET must be >= 32 characters');return k;}
export function signSession(userId:string,now=Date.now()){
  const payload=Buffer.from(JSON.stringify({uid:userId,exp:Math.floor(now/1000)+SESSION_MAX_AGE})).toString('base64url');
  const sig=createHmac('sha256',signingKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifySession(token:string,now=Date.now()):string|null{
  try{const [payload,signature,...rest]=token.split('.');if(!payload||!signature||rest.length)return null;
    const expected=createHmac('sha256',signingKey()).update(payload).digest();const actual=Buffer.from(signature,'base64url');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
    const p=JSON.parse(Buffer.from(payload,'base64url').toString());
    if(typeof p.uid!=='string'||!(/^[a-f0-9-]{36}$/i).test(p.uid)||!Number.isSafeInteger(p.exp)||p.exp<=Math.floor(now/1000))return null;
    return p.uid;
  }catch{return null;}
}
export async function currentUserId(){return verifySession((await cookies()).get(COOKIE)?.value||'');}
export async function setSession(userId:string){(await cookies()).set(COOKIE,signSession(userId),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:SESSION_MAX_AGE});}
export async function clearSession(){(await cookies()).delete(COOKIE);}
